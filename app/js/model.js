// The data model and every calculation on it. Pure functions only: no DOM,
// no storage, so all of it runs (and is tested) in Node as well.
//
// State, schema 1:
//   categories: [{ id, name, kind: 'expense'|'saving'|'income', budget: cents|null, demo? }]
//   recurring:  [{ id, name, type: 'expense'|'income', categoryId, every: 1|2|3|6|12,
//                  day: 1..31, start: 'YYYY-MM', end: 'YYYY-MM'|null,
//                  amounts: [{ from: 'YYYY-MM', cents }], skips: ['YYYY-MM'],
//                  overrides: { 'YYYY-MM': cents }, note, demo? }]
//   entries:    [{ id, date: 'YYYY-MM-DD', cents, type: 'expense'|'income', categoryId,
//                  note, created, demo? }]
//   settings:   { theme, onboarded, demo, lastBackup, backupSnooze, lastCategory }

import { addMonths, compareMonths, dayInMonth, daysInMonth, daysLeftInMonth, dayOf, isDate, isMonthKey, monthIndex, monthOf } from './dates.js';

export const SCHEMA = 1;
export const APP_ID = 'geldfluss';

export const INTERVALS = [
  { every: 1, label: 'Monatlich' },
  { every: 2, label: 'Alle 2 Monate' },
  { every: 3, label: 'Vierteljährlich' },
  { every: 6, label: 'Halbjährlich' },
  { every: 12, label: 'Jährlich' },
];

const DEFAULT_CATEGORIES = [
  ['wohnen', 'Wohnen', 'expense'],
  ['lebensmittel', 'Lebensmittel', 'expense'],
  ['energie', 'Energie', 'expense'],
  ['handy-internet', 'Handy & Internet', 'expense'],
  ['versicherungen', 'Versicherungen', 'expense'],
  ['mobilitaet', 'Mobilität', 'expense'],
  ['abos', 'Abos', 'expense'],
  ['essen-gehen', 'Essen gehen', 'expense'],
  ['freizeit', 'Freizeit', 'expense'],
  ['kleidung', 'Kleidung', 'expense'],
  ['gesundheit', 'Gesundheit', 'expense'],
  ['haushalt', 'Haushalt', 'expense'],
  ['geschenke', 'Geschenke', 'expense'],
  ['urlaub', 'Urlaub', 'expense'],
  ['sonstiges', 'Sonstiges', 'expense'],
  ['sparen', 'Sparen', 'saving'],
  ['gehalt', 'Gehalt', 'income'],
  ['nebenjob', 'Nebenjob', 'income'],
  ['sonstige-einnahmen', 'Sonstige Einnahmen', 'income'],
];

/** The category that takes entries of a deleted category. */
export const FALLBACK = { expense: 'sonstiges', saving: 'sonstiges', income: 'sonstige-einnahmen' };

export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyState() {
  return {
    app: APP_ID,
    schema: SCHEMA,
    categories: DEFAULT_CATEGORIES.map(([id, name, kind]) => ({ id, name, kind, budget: null })),
    recurring: [],
    entries: [],
    settings: { theme: 'system', onboarded: false, demo: false, lastBackup: null, backupSnooze: null, lastCategory: null },
  };
}

// ---------------------------------------------------------------------------
// Validation and migration. Everything that enters the app (storage, an
// imported file) goes through here, so the rest of the code can trust it.

export class DataError extends Error {}

const isCents = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 99_999_999_99;
const str = (v, max = 120) => (typeof v === 'string' ? v.slice(0, max) : '');

export function normalize(raw) {
  if (!raw || typeof raw !== 'object') throw new DataError('Keine Daten.');
  if (raw.app !== APP_ID) throw new DataError('Diese Datei ist keine Geldfluss-Sicherung.');
  if (!Number.isInteger(raw.schema) || raw.schema > SCHEMA) {
    throw new DataError('Diese Sicherung stammt aus einer neueren Version von Geldfluss. Lade die App neu und versuche es noch einmal.');
  }

  const base = emptyState();
  const categories = [];
  const seen = new Set();
  for (const c of Array.isArray(raw.categories) ? raw.categories : []) {
    if (!c || typeof c.id !== 'string' || seen.has(c.id)) continue;
    if (!['expense', 'saving', 'income'].includes(c.kind)) continue;
    const name = str(c.name, 40).trim();
    if (!name) continue;
    seen.add(c.id);
    categories.push({ id: c.id, name, kind: c.kind, budget: isCents(c.budget) && c.budget > 0 ? c.budget : null, ...(c.demo ? { demo: true } : {}) });
  }
  // The fallback categories must always exist.
  for (const def of base.categories) {
    if (Object.values(FALLBACK).includes(def.id) && !seen.has(def.id)) {
      categories.push(def);
      seen.add(def.id);
    }
  }
  if (categories.length === 0) categories.push(...base.categories);
  const catIds = new Set(categories.map((c) => c.id));
  const kindOf = new Map(categories.map((c) => [c.id, c.kind]));
  const fixCategory = (id, type) => {
    if (catIds.has(id) && (type === 'income') === (kindOf.get(id) === 'income')) return id;
    return type === 'income' ? FALLBACK.income : FALLBACK.expense;
  };

  const recurring = [];
  for (const r of Array.isArray(raw.recurring) ? raw.recurring : []) {
    if (!r || typeof r.id !== 'string') continue;
    const type = r.type === 'income' ? 'income' : r.type === 'expense' ? 'expense' : null;
    if (!type || !isMonthKey(r.start)) continue;
    const amounts = (Array.isArray(r.amounts) ? r.amounts : [])
      .filter((a) => a && isMonthKey(a.from) && isCents(a.cents))
      .sort((a, b) => compareMonths(a.from, b.from));
    if (!amounts.length) continue;
    const every = [1, 2, 3, 6, 12].includes(r.every) ? r.every : 1;
    const end = isMonthKey(r.end) && compareMonths(r.end, r.start) >= 0 ? r.end : null;
    const overrides = {};
    if (r.overrides && typeof r.overrides === 'object') {
      for (const [k, v] of Object.entries(r.overrides)) if (isMonthKey(k) && isCents(v)) overrides[k] = v;
    }
    recurring.push({
      id: r.id,
      name: str(r.name, 60).trim() || 'Fixposten',
      type,
      categoryId: fixCategory(r.categoryId, type),
      every,
      day: Number.isInteger(r.day) && r.day >= 1 && r.day <= 31 ? r.day : 1,
      start: r.start,
      end,
      amounts: dedupeAmounts(amounts),
      skips: [...new Set((Array.isArray(r.skips) ? r.skips : []).filter(isMonthKey))].sort(),
      overrides,
      note: str(r.note, 200),
      ...(r.demo ? { demo: true } : {}),
    });
  }

  const entries = [];
  for (const e of Array.isArray(raw.entries) ? raw.entries : []) {
    if (!e || typeof e.id !== 'string' || !isDate(e.date) || !isCents(e.cents) || e.cents === 0) continue;
    const type = e.type === 'income' ? 'income' : 'expense';
    entries.push({
      id: e.id,
      date: e.date,
      cents: e.cents,
      type,
      categoryId: fixCategory(e.categoryId, type),
      note: str(e.note, 200),
      created: Number.isFinite(e.created) ? e.created : 0,
      ...(e.demo ? { demo: true } : {}),
    });
  }

  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const settings = {
    theme: ['system', 'light', 'dark'].includes(s.theme) ? s.theme : 'system',
    onboarded: Boolean(s.onboarded) || entries.length > 0 || recurring.length > 0,
    demo: Boolean(s.demo),
    lastBackup: Number.isFinite(s.lastBackup) ? s.lastBackup : null,
    backupSnooze: Number.isFinite(s.backupSnooze) ? s.backupSnooze : null,
    lastCategory: catIds.has(s.lastCategory) ? s.lastCategory : null,
  };

  return { app: APP_ID, schema: SCHEMA, categories, recurring, entries, settings };
}

// One amount per month, oldest first, and no step that repeats the amount
// before it.
function dedupeAmounts(amounts) {
  const byMonth = new Map();
  for (const a of amounts) byMonth.set(a.from, a.cents);
  const sorted = [...byMonth.entries()].map(([from, cents]) => ({ from, cents })).sort((a, b) => compareMonths(a.from, b.from));
  return sorted.filter((a, i) => i === 0 || a.cents !== sorted[i - 1].cents);
}

// ---------------------------------------------------------------------------
// Recurring items

/** Whether a recurring item falls due in a month at all. */
export function occursIn(r, key) {
  if (compareMonths(key, r.start) < 0) return false;
  if (r.end && compareMonths(key, r.end) > 0) return false;
  return (monthIndex(key) - monthIndex(r.start)) % r.every === 0;
}

/** The regular amount for a month (before a one-month override). */
export function amountFor(r, key) {
  let cents = r.amounts[0].cents;
  for (const a of r.amounts) if (compareMonths(a.from, key) <= 0) cents = a.cents;
  return cents;
}

/** The occurrence of a recurring item in a month, or null. */
export function occurrence(r, key) {
  if (!occursIn(r, key)) return null;
  const skipped = r.skips.includes(key);
  const cents = key in r.overrides ? r.overrides[key] : amountFor(r, key);
  return { date: dayInMonth(key, r.day), cents, skipped, overridden: key in r.overrides };
}

/** What a recurring item costs per month on average, at the amount valid in `key`. */
export function monthlyEquivalent(r, key) {
  return Math.round(amountFor(r, key) / r.every);
}

/** Whether the item is still running in `key` (started, not ended). */
export function isActive(r, key) {
  return compareMonths(key, r.start) >= 0 && (!r.end || compareMonths(key, r.end) <= 0);
}

/** The next month (from `key` on) in which the item falls due, or null. */
export function nextDue(r, key) {
  let k = compareMonths(key, r.start) < 0 ? r.start : key;
  for (let i = 0; i < 12; i++) {
    if (r.end && compareMonths(k, r.end) > 0) return null;
    if (occursIn(r, k)) return k;
    k = addMonths(k, 1);
  }
  return null;
}

// ---------------------------------------------------------------------------
// A month

/**
 * Everything that happens in a month: entries plus the recurring items that
 * fall due. `today` decides what is booked and what is still planned.
 */
export function monthItems(state, key, today) {
  const items = [];
  for (const e of state.entries) {
    if (monthOf(e.date) !== key) continue;
    items.push({ ...e, kind: 'entry', planned: e.date > today });
  }
  for (const r of state.recurring) {
    const occ = occurrence(r, key);
    if (!occ || occ.skipped || occ.cents === 0) continue;
    items.push({
      id: `r:${r.id}:${key}`,
      kind: 'recurring',
      recurringId: r.id,
      date: occ.date,
      cents: occ.cents,
      type: r.type,
      categoryId: r.categoryId,
      note: r.name,
      overridden: occ.overridden,
      planned: occ.date > today,
      created: 0,
    });
  }
  items.sort((a, b) => (a.date === b.date ? (b.created || 0) - (a.created || 0) : a.date < b.date ? 1 : -1));
  return items;
}

/**
 * The month in numbers. "left" is what stays free once every planned item of
 * the month is paid too, so the number does not jump when rent goes out.
 */
export function summarize(state, key, today) {
  const items = monthItems(state, key, today);
  const cats = new Map(state.categories.map((c) => [c.id, c]));
  let income = 0;
  let spent = 0;
  let saved = 0;
  let planned = 0;
  const byCat = new Map();

  for (const it of items) {
    const cat = cats.get(it.categoryId);
    if (it.type === 'income') {
      income += it.cents;
    } else if (cat?.kind === 'saving') {
      saved += it.cents;
    } else {
      spent += it.cents;
    }
    if (it.type !== 'income' && it.planned) planned += it.cents;
    const row = byCat.get(it.categoryId) || { cents: 0, count: 0, planned: 0 };
    row.cents += it.cents;
    row.count += 1;
    if (it.planned) row.planned += it.cents;
    byCat.set(it.categoryId, row);
  }

  const out = spent + saved;
  const left = income - out;
  const current = monthOf(today) === key;
  const past = compareMonths(key, monthOf(today)) < 0;
  const daysLeft = current ? daysLeftInMonth(today) : past ? 0 : daysInMonth(key);
  const perDay = daysLeft > 0 && left > 0 ? Math.floor(left / daysLeft) : 0;

  const rows = (kind) => state.categories
    .filter((c) => (kind === 'income' ? c.kind === 'income' : c.kind !== 'income'))
    .map((c) => ({ category: c, ...(byCat.get(c.id) || { cents: 0, count: 0, planned: 0 }) }))
    .filter((r) => r.cents > 0 || (kind !== 'income' && r.category.budget))
    .sort((a, b) => b.cents - a.cents || a.category.name.localeCompare(b.category.name, 'de'));

  return {
    key,
    items,
    income,
    spent,
    saved,
    out,
    left,
    planned,
    current,
    past,
    future: !current && !past,
    daysLeft,
    perDay,
    expenses: rows('expense'),
    incomes: rows('income'),
  };
}

/** One sentence that says something true about the month, or null. */
export function insight(state, summary, today) {
  const top = summary.expenses.find((r) => r.cents > 0);
  if (!top || summary.out === 0) return null;

  // A category well above its own average of the last months says more than
  // the largest one, which is usually rent.
  const prev = [];
  for (let i = 1; i <= 6; i++) prev.push(summarize(state, addMonths(summary.key, -i), today));
  const withData = prev.filter((p) => p.out > 0);
  // A running month can only be said to be above its average, not below.
  if (withData.length >= 3 && (summary.past || summary.current)) {
    let best = null;
    for (const row of summary.expenses) {
      if (row.cents < 5000) continue;
      const avg = withData.reduce((sum, p) => sum + (p.expenses.find((r) => r.category.id === row.category.id)?.cents || 0), 0) / withData.length;
      if (avg < 2000) continue;
      const ratio = row.cents / avg - 1;
      if (summary.current && ratio < 0) continue;
      if (Math.abs(ratio) >= 0.25 && Math.abs(row.cents - avg) >= 3000 && (!best || Math.abs(ratio) > Math.abs(best.ratio))) best = { row, ratio };
    }
    if (best) {
      const pct = Math.round(Math.abs(best.ratio) * 100);
      return `${best.row.category.name} liegt ${summary.current ? 'schon ' : ''}${pct} % ${best.ratio > 0 ? 'über' : 'unter'} deinem Schnitt.`;
    }
  }
  const base = summary.income > 0 ? summary.income : summary.out;
  const share = Math.round((top.cents / base) * 100);
  return `${top.category.name} nimmt das größte Stück: ${share} %${summary.income > 0 ? ' vom Einkommen' : ''}.`;
}

// ---------------------------------------------------------------------------
// History

/** The months that hold any data, from the first to `until`. */
export function firstMonth(state) {
  let first = null;
  for (const e of state.entries) {
    const m = monthOf(e.date);
    if (!first || compareMonths(m, first) < 0) first = m;
  }
  for (const r of state.recurring) if (!first || compareMonths(r.start, first) < 0) first = r.start;
  return first;
}

/** The last `count` months up to `until`, oldest first, with their numbers. */
export function series(state, until, today, count = 12) {
  const first = firstMonth(state);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const key = addMonths(until, -i);
    const s = summarize(state, key, today);
    out.push({ key, income: s.income, out: s.out, spent: s.spent, saved: s.saved, left: s.left, empty: !first || compareMonths(key, first) < 0 });
  }
  return out;
}

/** Averages per category over the finished months with data. */
export function averages(state, until, today, count = 12) {
  const months = [];
  for (let i = 1; i <= count; i++) {
    const s = summarize(state, addMonths(until, -i), today);
    if (s.out > 0 || s.income > 0) months.push(s);
  }
  const n = months.length;
  const byCat = new Map();
  let income = 0;
  let out = 0;
  let saved = 0;
  for (const m of months) {
    income += m.income;
    out += m.out;
    saved += m.saved;
    for (const r of m.expenses) byCat.set(r.category.id, (byCat.get(r.category.id) || 0) + r.cents);
  }
  return {
    months: n,
    income: n ? Math.round(income / n) : 0,
    out: n ? Math.round(out / n) : 0,
    saved: n ? Math.round(saved / n) : 0,
    left: n ? Math.round((income - out) / n) : 0,
    byCategory: new Map([...byCat.entries()].map(([id, c]) => [id, Math.round(c / n)])),
  };
}

// ---------------------------------------------------------------------------
// Fixed costs overview

export function fixedOverview(state, key) {
  const cats = new Map(state.categories.map((c) => [c.id, c]));
  const active = state.recurring.filter((r) => isActive(r, key));
  const ended = state.recurring.filter((r) => r.end && compareMonths(key, r.end) > 0);
  const upcoming = state.recurring.filter((r) => compareMonths(key, r.start) < 0);
  let income = 0;
  let expense = 0;
  for (const r of active) {
    const m = monthlyEquivalent(r, key);
    if (r.type === 'income') income += m;
    else expense += m;
  }
  const sortRows = (list) => list
    .map((r) => ({ r, category: cats.get(r.categoryId), monthly: monthlyEquivalent(r, key), cents: amountFor(r, key) }))
    .sort((a, b) => b.monthly - a.monthly || a.r.name.localeCompare(b.r.name, 'de'));
  return {
    income,
    expense,
    free: income - expense,
    incomes: sortRows(active.filter((r) => r.type === 'income')),
    expenses: sortRows(active.filter((r) => r.type === 'expense')),
    upcoming: sortRows(upcoming),
    ended: sortRows(ended),
  };
}

// ---------------------------------------------------------------------------
// Changes. Each returns a new state; the old one stays untouched for undo.

const clone = (s) => structuredClone(s);

export function addEntry(state, entry) {
  const next = clone(state);
  next.entries.push({ id: uid(), created: Date.now(), note: '', ...entry });
  if (entry.type === 'expense' || entry.type === 'income') next.settings.lastCategory = entry.categoryId;
  next.settings.onboarded = true;
  return next;
}

export function updateEntry(state, id, patch) {
  const next = clone(state);
  const e = next.entries.find((x) => x.id === id);
  if (e) Object.assign(e, patch);
  return next;
}

export function deleteEntry(state, id) {
  const next = clone(state);
  next.entries = next.entries.filter((e) => e.id !== id);
  return next;
}

export function addRecurring(state, item) {
  const next = clone(state);
  const { cents, ...rest } = item;
  next.recurring.push({
    id: uid(), every: 1, day: 1, end: null, skips: [], overrides: {}, note: '',
    ...rest,
    amounts: [{ from: item.start, cents }],
  });
  next.settings.onboarded = true;
  return next;
}

/**
 * Changes a recurring item. Name, category, interval and day change for all
 * months; a new amount applies from `from` on, so past months keep theirs.
 */
export function updateRecurring(state, id, patch, from) {
  const next = clone(state);
  const r = next.recurring.find((x) => x.id === id);
  if (!r) return next;
  const { cents, ...rest } = patch;
  Object.assign(r, rest);
  if (cents != null && cents !== amountFor(r, from)) {
    const effective = compareMonths(from, r.start) < 0 ? r.start : from;
    r.amounts = r.amounts.filter((a) => compareMonths(a.from, effective) < 0);
    r.amounts.push({ from: effective, cents });
    r.amounts = dedupeAmounts(r.amounts);
    // Overrides from that month on would hide the new amount.
    for (const k of Object.keys(r.overrides)) if (compareMonths(k, effective) >= 0) delete r.overrides[k];
  }
  if (rest.start) {
    r.amounts[0].from = r.start;
    r.amounts = dedupeAmounts(r.amounts.map((a) => (compareMonths(a.from, r.start) < 0 ? { ...a, from: r.start } : a)));
  }
  if (r.end && compareMonths(r.end, r.start) < 0) r.end = r.start;
  return next;
}

/** One month only: a different amount, or skip it, or back to normal. */
export function setOccurrence(state, id, key, change) {
  const next = clone(state);
  const r = next.recurring.find((x) => x.id === id);
  if (!r) return next;
  r.skips = r.skips.filter((k) => k !== key);
  delete r.overrides[key];
  if (change.skip) r.skips.push(key);
  else if (change.cents != null && change.cents !== amountFor(r, key)) r.overrides[key] = change.cents;
  r.skips.sort();
  return next;
}

/** Ends an item after the month before `key`; earlier months keep it. */
export function endRecurring(state, id, key) {
  const next = clone(state);
  const r = next.recurring.find((x) => x.id === id);
  if (!r) return next;
  const last = addMonths(key, -1);
  if (compareMonths(last, r.start) < 0) {
    next.recurring = next.recurring.filter((x) => x.id !== id);
  } else {
    r.end = last;
  }
  return next;
}

export function deleteRecurring(state, id) {
  const next = clone(state);
  next.recurring = next.recurring.filter((r) => r.id !== id);
  return next;
}

export function addCategory(state, { name, kind, budget = null }) {
  const next = clone(state);
  const id = `c-${uid().slice(0, 8)}`;
  next.categories.push({ id, name: name.trim().slice(0, 40), kind, budget });
  return { state: next, id };
}

export function updateCategory(state, id, patch) {
  const next = clone(state);
  const c = next.categories.find((x) => x.id === id);
  if (!c) return next;
  if (patch.name != null) c.name = patch.name.trim().slice(0, 40) || c.name;
  if ('budget' in patch) c.budget = patch.budget && patch.budget > 0 ? patch.budget : null;
  if (patch.kind && c.kind !== 'income' && patch.kind !== 'income') c.kind = patch.kind;
  return next;
}

/** Deletes a category; its entries and fixed costs move to the fallback. */
export function deleteCategory(state, id) {
  if (Object.values(FALLBACK).includes(id)) return state;
  const next = clone(state);
  const c = next.categories.find((x) => x.id === id);
  if (!c) return next;
  const to = c.kind === 'income' ? FALLBACK.income : FALLBACK.expense;
  for (const e of next.entries) if (e.categoryId === id) e.categoryId = to;
  for (const r of next.recurring) if (r.categoryId === id) r.categoryId = to;
  next.categories = next.categories.filter((x) => x.id !== id);
  if (next.settings.lastCategory === id) next.settings.lastCategory = null;
  return next;
}

export function countUses(state, categoryId) {
  return state.entries.filter((e) => e.categoryId === categoryId).length
    + state.recurring.filter((r) => r.categoryId === categoryId).length;
}

/** Merges an imported state into the current one: same ids are replaced. */
export function merge(current, incoming) {
  const next = clone(current);
  const put = (list, items) => {
    const index = new Map(list.map((x, i) => [x.id, i]));
    for (const it of items) {
      if (index.has(it.id)) list[index.get(it.id)] = it;
      else list.push(it);
    }
  };
  put(next.categories, incoming.categories);
  put(next.recurring, incoming.recurring);
  put(next.entries, incoming.entries);
  next.settings.onboarded = true;
  return normalize(next);
}

export function removeDemo(state) {
  const next = clone(state);
  next.entries = next.entries.filter((e) => !e.demo);
  next.recurring = next.recurring.filter((r) => !r.demo);
  next.categories = next.categories.filter((c) => !c.demo);
  next.settings.demo = false;
  next.settings.onboarded = next.entries.length > 0 || next.recurring.length > 0;
  return normalize(next);
}

// ---------------------------------------------------------------------------
// Export

/** All bookings as CSV (semicolon-separated, as German Excel expects). */
export function toCSV(state, today) {
  const cats = new Map(state.categories.map((c) => [c.id, c]));
  const first = firstMonth(state);
  const rows = [['Datum', 'Art', 'Kategorie', 'Betrag', 'Notiz', 'Fixposten']];
  if (first) {
    const last = monthOf(today);
    const lastData = state.entries.reduce((m, e) => (compareMonths(monthOf(e.date), m) > 0 ? monthOf(e.date) : m), last);
    for (let k = first; compareMonths(k, lastData) <= 0; k = addMonths(k, 1)) {
      const items = monthItems(state, k, today).slice().reverse();
      for (const it of items) {
        const cat = cats.get(it.categoryId);
        const kind = it.type === 'income' ? 'Einnahme' : cat?.kind === 'saving' ? 'Sparen' : 'Ausgabe';
        const amount = (it.type === 'income' ? it.cents : -it.cents) / 100;
        rows.push([it.date, kind, cat?.name || '', amount.toFixed(2).replace('.', ','), it.note || '', it.kind === 'recurring' ? 'ja' : 'nein']);
      }
    }
  }
  const cell = (v) => {
    const s = String(v);
    return /[";\n\r]/.test(s) || /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `"${s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"` : s;
  };
  return `﻿${rows.map((r) => r.map(cell).join(';')).join('\r\n')}\r\n`;
}
