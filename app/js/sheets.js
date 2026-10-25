// Every form lives on the shore: a sheet that rises over the water.

import { app, category, commit, currentMonth, viewedMonth } from './app.js';
import { addMonths, compareMonths, dayLabel, dayOf, isDate, monthLabel, monthName, monthOf, shortDate } from './dates.js';
import {
  addCategory, addEntry, addRecurring, amountFor, countUses, deleteCategory, deleteEntry, deleteRecurring, endRecurring,
  FALLBACK, INTERVALS, monthlyEquivalent, nextDue, occurrence, setOccurrence, summarize, updateCategory, updateEntry, updateRecurring,
} from './model.js';
import { formatInput, formatMoney, formatPlain, parseAmount, splitMoney } from './money.js';
import { h, haptic, icon, sheet } from './ui.js';

const kindLabel = { expense: 'Ausgabe', saving: 'Sparen', income: 'Einnahme' };

// ---------------------------------------------------------------------------
// Pieces

function amountField(cents, { label = 'Betrag', autofocus = true } = {}) {
  const input = h('input', {
    class: 'n', type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'done',
    placeholder: '0', 'aria-label': `${label} in Euro`, value: formatInput(cents),
  });
  input.addEventListener('input', () => {
    const clean = input.value.replace(/[^\d.,]/g, '');
    if (clean !== input.value) input.value = clean;
    err.hidden = true;
  });
  const err = h('p', { class: 'err', hidden: true, role: 'alert' });
  const wrap = h('div', {}, h('div', { class: 'amount' }, input, h('span', { class: 'cur', 'aria-hidden': 'true' }, '€')), err);
  if (autofocus) {
    // Focus after the sheet has risen; on phones this opens the keypad.
    setTimeout(() => { input.focus({ preventScroll: true }); input.select(); }, 60);
  }
  return {
    el: wrap,
    input,
    read() {
      const v = parseAmount(input.value);
      if (v == null || v === 0) {
        err.textContent = input.value.trim() ? 'Das ist kein Betrag. Schreib ihn zum Beispiel so: 12,50' : 'Gib einen Betrag ein, zum Beispiel 12,50.';
        err.hidden = false;
        input.focus();
        return null;
      }
      return v;
    },
  };
}

function segmented(options, value, onChange, label) {
  const el = h('div', { class: 'seg', role: 'group', 'aria-label': label });
  const set = (v) => {
    value = v;
    for (const b of el.children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
  };
  for (const [v, text] of options) {
    el.append(h('button', { type: 'button', 'data-v': v, 'aria-pressed': String(v === value), onclick: () => { if (v !== value) { set(v); onChange(v); } } }, text));
  }
  return { el, get: () => value, set };
}

/** Category chips for a type. Includes a chip to make a new category. */
function categoryChips(type, selected, onChange) {
  const el = h('div', { class: 'chips', role: 'group', 'aria-label': 'Kategorie' });
  let value = selected;
  const draw = () => {
    el.replaceChildren();
    const cats = app.state.categories.filter((c) => (type === 'income' ? c.kind === 'income' : c.kind !== 'income'));
    for (const c of cats) {
      el.append(h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(c.id === value),
        onclick: () => { value = c.id; draw(); onChange?.(value); },
      }, c.name));
    }
    el.append(h('button', {
      type: 'button', class: 'chip add', onclick: () => newCategory(type === 'income' ? 'income' : 'expense', (id) => { value = id; draw(); onChange?.(value); }),
    }, icon('plus', 's'), 'Neue Kategorie'));
  };
  draw();
  return {
    el,
    get: () => value,
    reset(nextType, nextValue) { type = nextType; value = nextValue; draw(); },
  };
}

function monthPicker(value, { label, from = -36, to = 24 } = {}) {
  const base = currentMonth();
  const sel = h('select', { class: 'select', 'aria-label': label });
  const first = compareMonths(value, addMonths(base, from)) < 0 ? value : addMonths(base, from);
  const last = compareMonths(value, addMonths(base, to)) > 0 ? value : addMonths(base, to);
  for (let k = first; compareMonths(k, last) <= 0; k = addMonths(k, 1)) {
    sel.append(h('option', { value: k, selected: k === value }, monthLabel(k)));
  }
  sel.value = value;
  return sel;
}

function daySelect(day) {
  const sel = h('select', { class: 'select', 'aria-label': 'Tag im Monat' });
  for (let d = 1; d <= 31; d++) sel.append(h('option', { value: String(d), selected: d === day }, d === 31 ? '31. (oder Monatsletzter)' : `${d}.`));
  sel.value = String(day);
  return sel;
}

function field(label, control, help) {
  return h('label', { class: 'field' }, h('span', {}, label), control, help ? h('p', { class: 'help' }, help) : null);
}

function defaultDate() {
  const m = viewedMonth();
  if (m === monthOf(app.today)) return app.today;
  return compareMonths(m, monthOf(app.today)) < 0 ? `${m}-${String(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate()).padStart(2, '0')}` : `${m}-01`;
}

function lastCategory(type) {
  const id = app.state.settings.lastCategory;
  const c = id && category(id);
  if (c && (type === 'income') === (c.kind === 'income')) return c.id;
  if (type === 'income') return 'gehalt';
  return app.state.categories.find((x) => x.id === 'lebensmittel') ? 'lebensmittel' : FALLBACK.expense;
}

// ---------------------------------------------------------------------------
// New or edited entry

export function openEntry({ entry = null, type = 'expense', categoryId = null } = {}) {
  const editing = Boolean(entry);
  let kind = entry?.type || type;
  const amount = amountField(entry?.cents ?? null);
  const chips = categoryChips(kind, entry?.categoryId || categoryId || lastCategory(kind));
  const seg = segmented([['expense', 'Ausgabe'], ['income', 'Einnahme']], kind, (v) => {
    kind = v;
    chips.reset(v, lastCategory(v));
    title.textContent = v === 'income' ? 'Neue Einnahme' : 'Neue Ausgabe';
    amount.input.focus();
  }, 'Art');

  const date = h('input', { class: 'input n', type: 'date', value: entry?.date || defaultDate(), required: true });
  const notes = [...new Set(app.state.entries.slice(-300).map((e) => e.note).filter(Boolean))].slice(-60);
  const listId = `notes-${Date.now()}`;
  const note = h('input', { class: 'input', type: 'text', value: entry?.note || '', maxlength: '200', placeholder: 'Zum Beispiel Billa oder Kino', list: listId, autocomplete: 'off', enterkeyhint: 'done' });
  note.setAttribute('list', listId);
  const datalist = h('datalist', { id: listId }, notes.map((n) => h('option', { value: n })));
  const repeat = h('input', { type: 'checkbox', role: 'switch' });
  const dateErr = h('p', { class: 'err', hidden: true, role: 'alert' }, 'Wähle ein gültiges Datum.');

  const title = h('span', {}, editing ? (kind === 'income' ? 'Einnahme bearbeiten' : 'Ausgabe bearbeiten') : kind === 'income' ? 'Neue Einnahme' : 'Neue Ausgabe');

  const submit = () => {
    const cents = amount.read();
    if (cents == null) return;
    if (!isDate(date.value)) { dateErr.hidden = false; date.focus(); return; }
    const categoryId = chips.get();
    const data = { date: date.value, cents, type: kind, categoryId, note: note.value.trim() };
    const where = monthLabel(monthOf(date.value));
    s.close();
    haptic();
    if (editing) {
      commit(updateEntry(app.state, entry.id, data), { message: 'Geändert.' });
    } else if (repeat.checked) {
      const name = data.note || category(categoryId)?.name || 'Fixposten';
      commit(addRecurring(app.state, { name, type: kind, categoryId, cents, start: monthOf(data.date), day: dayOf(data.date), every: 1 }), { message: `Fixposten „${name}“ angelegt, ab ${where}.` });
    } else {
      const next = addEntry(app.state, data);
      const other = monthOf(data.date) !== viewedMonth();
      commit(next, { message: other ? `Eingetragen im ${where}.` : `${formatMoney(cents)} eingetragen.` });
    }
  };

  const form = h('form', { onsubmit: (e) => { e.preventDefault(); submit(); } },
    editing ? null : seg.el,
    h('div', { style: { marginTop: editing ? '4px' : '22px' } }, amount.el),
    h('div', { class: 'field' }, h('span', { class: 'field-l' }, 'Kategorie'), chips.el),
    h('div', { class: 'pair' },
      h('label', { class: 'field' }, h('span', {}, 'Datum'), date),
      h('label', { class: 'field' }, h('span', {}, 'Notiz'), note)),
    dateErr,
    datalist,
    editing ? null : h('label', { class: 'switch' }, h('span', {}, h('span', { class: 't' }, 'Jeden Monat wiederholen'), h('span', { class: 's' }, 'Wird ein Fixposten am selben Tag.')), repeat),
    h('button', { type: 'submit', hidden: true, tabindex: '-1' }));

  const foot = [
    editing ? h('button', { type: 'button', class: 'btn danger', onclick: () => {
      s.close();
      commit(deleteEntry(app.state, entry.id), { message: `${entry.note || category(entry.categoryId)?.name || 'Eintrag'} gelöscht.` });
    } }, 'Löschen') : null,
    h('button', { type: 'button', class: 'btn primary', onclick: submit }, editing ? 'Speichern' : 'Eintragen'),
  ];

  const s = sheet({ title, body: form, foot });
  return s;
}

// ---------------------------------------------------------------------------
// One month of a fixed item (tapped in the month's list)

export function openOccurrence(recurringId, key) {
  const r = app.state.recurring.find((x) => x.id === recurringId);
  if (!r) return;
  const occ = occurrence(r, key);
  const regular = amountFor(r, key);
  const c = category(r.categoryId);
  const month = monthName(key);
  const amount = amountField(occ?.cents ?? regular, { autofocus: false });
  const interval = INTERVALS.find((i) => i.every === r.every)?.label || 'Monatlich';

  const body = h('div', {},
    h('p', { class: 'lede' }, `${c?.name || ''} · ${interval} am ${r.day}. · seit ${monthLabel(r.start)}`),
    h('div', { class: 'field' }, h('span', { class: 'field-l' }, `Betrag im ${month}`), amount.el,
      h('p', { class: 'help n' }, occ?.overridden ? `Sonst ${formatMoney(regular)}. Nur der ${month} ist anders.` : `Gilt nur für den ${month}. Die anderen Monate bleiben bei ${formatMoney(regular)}.`)),
    h('div', { class: 'danger-zone' },
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => {
        s.close();
        commit(setOccurrence(app.state, r.id, key, { skip: true }), { message: `${r.name} im ${month} ausgesetzt.` });
      } }, `Im ${month} aussetzen`),
      occ?.overridden ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => {
        s.close();
        commit(setOccurrence(app.state, r.id, key, {}), { message: `${r.name} im ${month} wieder ${formatMoney(regular)}.` });
      } }, 'Normalen Betrag nehmen') : null,
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => { s.close(); setTimeout(() => openRecurring({ recurring: r, from: key }), 300); } }, 'Fixposten bearbeiten')));

  const save = () => {
    const cents = amount.read();
    if (cents == null) return;
    s.close();
    if (cents === (occ?.cents ?? regular)) return;
    commit(setOccurrence(app.state, r.id, key, { cents }), { message: `${r.name} im ${month}: ${formatMoney(cents)}.` });
  };
  const s = sheet({ title: r.name, body: h('form', { onsubmit: (e) => { e.preventDefault(); save(); } }, body), foot: [h('button', { type: 'button', class: 'btn primary', onclick: save }, 'Speichern')] });
}

// ---------------------------------------------------------------------------
// A fixed item: new or edited

export function openRecurring({ recurring = null, type = 'expense', from = null } = {}) {
  const r = recurring;
  const editing = Boolean(r);
  const at = from || viewedMonth();
  let kind = r?.type || type;
  const name = h('input', { class: 'input', type: 'text', value: r?.name || '', maxlength: '60', placeholder: kind === 'income' ? 'Zum Beispiel Gehalt' : 'Zum Beispiel Miete', required: true, autocomplete: 'off', enterkeyhint: 'next' });
  const nameErr = h('p', { class: 'err', hidden: true, role: 'alert' }, 'Gib dem Fixposten einen Namen.');
  const amount = amountField(r ? amountFor(r, at) : null, { autofocus: !editing });
  const chips = categoryChips(kind, r?.categoryId || (kind === 'income' ? 'gehalt' : 'wohnen'));
  const seg = segmented([['expense', 'Ausgabe'], ['income', 'Einnahme']], kind, (v) => {
    kind = v;
    chips.reset(v, v === 'income' ? 'gehalt' : 'wohnen');
    name.placeholder = v === 'income' ? 'Zum Beispiel Gehalt' : 'Zum Beispiel Miete';
    name.focus();
  }, 'Art');
  const every = h('select', { class: 'select', 'aria-label': 'Wie oft' }, INTERVALS.map((i) => h('option', { value: String(i.every) }, i.label)));
  every.value = String(r?.every || 1);
  const day = daySelect(r?.day || (kind === 'income' ? 1 : dayOf(app.today)));
  const start = monthPicker(r?.start || at, { label: 'Erster Monat' });
  const hasEnd = h('input', { type: 'checkbox', role: 'switch', checked: Boolean(r?.end) });
  const end = monthPicker(r?.end || addMonths(at, 11), { label: 'Letzter Monat' });
  const endWrap = h('label', { class: 'field', hidden: !r?.end }, h('span', {}, 'Letzter Monat'), end);
  hasEnd.addEventListener('change', () => { endWrap.hidden = !hasEnd.checked; });
  const fromSel = monthPicker(compareMonths(at, r?.start || at) < 0 ? r.start : at, { label: 'Neuer Betrag gilt ab' });
  const fromWrap = h('label', { class: 'field', hidden: true }, h('span', {}, 'Neuer Betrag gilt ab'), fromSel, h('p', { class: 'help' }, 'Monate davor behalten den alten Betrag.'));
  if (editing) amount.input.addEventListener('input', () => { fromWrap.hidden = parseAmount(amount.input.value) === amountFor(r, at); });

  const perMonth = h('p', { class: 'help n' });
  const updateHint = () => {
    const v = parseAmount(amount.input.value);
    const n = Number(every.value);
    const firstDue = start.value;
    perMonth.textContent = n > 1
      ? `${v ? `Das sind ${formatMoney(Math.round(v / n))} im Monat. ` : ''}Fällig im ${monthName(firstDue)}${n === 12 ? ', jedes Jahr' : ` und dann alle ${n} Monate`}.`
      : '';
  };
  every.addEventListener('change', updateHint);
  start.addEventListener('change', updateHint);
  amount.input.addEventListener('input', updateHint);
  updateHint();

  const submit = () => {
    const n = name.value.trim();
    if (!n) { nameErr.hidden = false; name.focus(); return; }
    const cents = amount.read();
    if (cents == null) return;
    const data = {
      name: n, type: kind, categoryId: chips.get(), every: Number(every.value), day: Number(day.value),
      start: start.value, end: hasEnd.checked ? end.value : null,
    };
    if (data.end && compareMonths(data.end, data.start) < 0) data.end = data.start;
    s.close();
    haptic();
    if (editing) {
      commit(updateRecurring(app.state, r.id, { ...data, cents }, fromSel.value), { message: `${n} gespeichert.` });
    } else {
      commit(addRecurring(app.state, { ...data, cents }), { message: `${n} angelegt.` });
    }
  };

  const nextMonth = addMonths(at, 1);
  const danger = editing ? h('div', { class: 'danger-zone' },
    compareMonths(at, r.start) > 0 || (compareMonths(at, r.start) === 0 && compareMonths(nextMonth, r.start) > 0)
      ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => {
        s.close();
        commit(endRecurring(app.state, r.id, nextMonth), { message: `${r.name} endet nach ${monthLabel(at)}.` });
      } }, `Nach ${monthName(at)} beenden`)
      : null,
    h('button', { type: 'button', class: 'btn danger small', onclick: () => confirmDelete() }, 'Ganz löschen')) : null;

  const confirmDelete = () => {
    s.close();
    setTimeout(() => confirm({
      title: `${r.name} löschen?`,
      text: `Der Fixposten verschwindet auch aus allen vergangenen Monaten. Wenn er nur aufhört, nimm „Beenden“.`,
      action: 'Ganz löschen',
      run: () => commit(deleteRecurring(app.state, r.id), { message: `${r.name} gelöscht.` }),
    }), 300);
  };

  const form = h('form', { onsubmit: (e) => { e.preventDefault(); submit(); } },
    seg.el,
    field('Name', name), nameErr,
    h('div', { class: 'field' }, h('span', { class: 'field-l' }, 'Betrag'), amount.el),
    fromWrap,
    h('div', { class: 'field' }, h('span', { class: 'field-l' }, 'Kategorie'), chips.el),
    h('div', { class: 'pair' }, field('Wie oft', every), field('Am', day)),
    perMonth,
    field(editing ? 'Seit' : 'Ab', start),
    h('label', { class: 'switch' }, h('span', {}, h('span', { class: 't' }, 'Endet'), h('span', { class: 's' }, 'Zum Beispiel ein Vertrag mit fester Laufzeit.')), hasEnd),
    endWrap,
    danger,
    h('button', { type: 'submit', hidden: true, tabindex: '-1' }));

  const s = sheet({ title: editing ? r.name : 'Neuer Fixposten', body: form, foot: [h('button', { type: 'button', class: 'btn primary', onclick: submit }, editing ? 'Speichern' : 'Anlegen')] });
  if (!editing) setTimeout(() => name.focus(), 60);
}

// ---------------------------------------------------------------------------
// A category in a month: what went there, its budget

export function openCategory(categoryId, key, members = null) {
  const ids = members || [categoryId];
  const cats = ids.map((id) => category(id)).filter(Boolean);
  if (!cats.length) return;
  const sum = summarize(app.state, key, app.today);
  const items = sum.items.filter((i) => ids.includes(i.categoryId));
  const total = items.reduce((s, i) => s + i.cents, 0);
  const single = cats.length === 1 ? cats[0] : null;
  const m = splitMoney(total);

  const list = h('ul', { class: 'rows' }, items.length ? items.map((it) => h('li', {}, h('button', {
    type: 'button', class: `row${it.planned ? ' planned' : ''}`,
    onclick: () => { s.close(); setTimeout(() => (it.kind === 'recurring' ? openOccurrence(it.recurringId, key) : openEntry({ entry: app.state.entries.find((e) => e.id === it.id) })), 300); },
  },
  h('span', { class: 't' }, h('span', { class: 'nm' }, it.note || category(it.categoryId)?.name || ''), it.kind === 'recurring' ? h('span', { class: 'tag' }, 'fix') : null),
  h('span', { class: 'v' }, `${it.type === 'income' ? '+' : ''}${formatPlain(it.cents)}`),
  h('span', { class: 's' }, `${it.planned ? 'geplant · ' : ''}${dayLabel(it.date, app.today)}${single ? '' : ` · ${category(it.categoryId)?.name}`}`)))) : h('li', {}, h('p', { class: 'help', style: { padding: '12px 0' } }, `Im ${monthName(key)} noch nichts in ${single?.name || 'diesen Kategorien'}.`)));

  let budgetBlock = null;
  if (single && single.kind !== 'income') {
    const b = h('input', { class: 'input n', type: 'text', inputmode: 'decimal', placeholder: 'Kein Budget', value: single.budget ? formatInput(single.budget) : '', 'aria-label': 'Monatsbudget in Euro', autocomplete: 'off', enterkeyhint: 'done' });
    const bErr = h('p', { class: 'err', hidden: true, role: 'alert' }, 'Das ist kein Betrag. Leer lassen für kein Budget.');
    const saveBudget = () => {
      const text = b.value.trim();
      const v = text ? parseAmount(text) : null;
      if (text && v == null) { bErr.hidden = false; return false; }
      if ((v || null) !== (single.budget || null)) {
        commit(updateCategory(app.state, single.id, { budget: v }), { message: v ? `Budget für ${single.name}: ${formatMoney(v)} im Monat.` : `Budget für ${single.name} entfernt.` });
      }
      return true;
    };
    b.addEventListener('change', () => { saveBudget(); });
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (saveBudget()) s.close(); } });
    const left = single.budget ? single.budget - total : null;
    budgetBlock = h('div', {},
      field('Monatsbudget', b, single.budget
        ? (left >= 0 ? `Noch ${formatMoney(left)} frei im ${monthName(key)}.` : `${formatMoney(-left)} über dem Budget.`)
        : 'Optional. Dann siehst du, wie viel in dieser Kategorie noch frei ist.'),
      bErr);
  }

  const body = h('div', {},
    h('p', { class: 'lede' }, `${monthLabel(key)}${single ? ` · ${kindLabel[single.kind]}` : ''}`),
    h('p', { class: 'big-amount n' }, m.euros, h('span', { class: 'c' }, `${m.cents} €`)),
    budgetBlock,
    h('div', { class: 'field' }, h('span', { class: 'field-l' }, `${items.length} ${items.length === 1 ? 'Buchung' : 'Buchungen'}`), list));

  const foot = [
    h('button', { type: 'button', class: 'btn primary', onclick: () => { s.close(); setTimeout(() => openEntry({ type: single?.kind === 'income' ? 'income' : 'expense', categoryId: single?.id }), 300); } }, icon('plus', 's'), single ? `In ${single.name} eintragen` : 'Eintragen'),
  ];
  const s = sheet({ title: single ? single.name : cats.map((c) => c.name).join(', '), body, foot });
}

// ---------------------------------------------------------------------------
// Categories

export function newCategory(kind, done) {
  const name = h('input', { class: 'input', type: 'text', maxlength: '40', placeholder: 'Zum Beispiel Haustier', required: true, autocomplete: 'off', enterkeyhint: 'done' });
  const err = h('p', { class: 'err', hidden: true, role: 'alert' });
  let k = kind;
  const seg = kind === 'income' ? null : segmented([['expense', 'Ausgabe'], ['saving', 'Sparen']], 'expense', (v) => { k = v; }, 'Art');
  const submit = () => {
    const n = name.value.trim();
    if (!n) { err.textContent = 'Gib der Kategorie einen Namen.'; err.hidden = false; name.focus(); return; }
    if (app.state.categories.some((c) => c.name.toLowerCase() === n.toLowerCase())) { err.textContent = `„${n}“ gibt es schon.`; err.hidden = false; name.focus(); return; }
    const made = addCategory(app.state, { name: n, kind: k });
    s.close();
    commit(made.state, { message: `Kategorie ${n} angelegt.`, undo: false });
    done?.(made.id);
  };
  const s = sheet({
    title: kind === 'income' ? 'Neue Einnahme-Kategorie' : 'Neue Kategorie',
    body: h('form', { onsubmit: (e) => { e.preventDefault(); submit(); } }, field('Name', name), err, seg ? h('div', { class: 'field' }, h('span', { class: 'field-l' }, 'Zählt als'), seg.el, h('p', { class: 'help' }, 'Sparen wird im Fluss gestreift gezeigt, gleich über dem, was übrig bleibt.')) : null),
    foot: [h('button', { type: 'button', class: 'btn primary', onclick: submit }, 'Anlegen')],
  });
  setTimeout(() => name.focus(), 60);
}

export function editCategory(id) {
  const c = category(id);
  if (!c) return;
  const uses = countUses(app.state, id);
  const isFallback = Object.values(FALLBACK).includes(id);
  const name = h('input', { class: 'input', type: 'text', maxlength: '40', value: c.name, autocomplete: 'off', enterkeyhint: 'done' });
  const budget = h('input', { class: 'input n', type: 'text', inputmode: 'decimal', placeholder: 'Kein Budget', value: c.budget ? formatInput(c.budget) : '', autocomplete: 'off' });
  const err = h('p', { class: 'err', hidden: true, role: 'alert' });
  let kind = c.kind;
  const seg = c.kind === 'income' ? null : segmented([['expense', 'Ausgabe'], ['saving', 'Sparen']], c.kind, (v) => { kind = v; }, 'Zählt als');
  const submit = () => {
    const n = name.value.trim();
    if (!n) { err.textContent = 'Gib der Kategorie einen Namen.'; err.hidden = false; return; }
    if (app.state.categories.some((x) => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) { err.textContent = `„${n}“ gibt es schon.`; err.hidden = false; return; }
    const text = budget.value.trim();
    const b = text ? parseAmount(text) : null;
    if (text && b == null) { err.textContent = 'Das Budget ist kein Betrag.'; err.hidden = false; return; }
    s.close();
    commit(updateCategory(app.state, id, { name: n, budget: b, kind }), { message: `${n} gespeichert.` });
  };
  const remove = () => {
    s.close();
    const to = category(c.kind === 'income' ? FALLBACK.income : FALLBACK.expense)?.name;
    commit(deleteCategory(app.state, id), { message: uses ? `${c.name} gelöscht. ${uses} ${uses === 1 ? 'Buchung liegt' : 'Buchungen liegen'} jetzt in ${to}.` : `${c.name} gelöscht.` });
  };
  const s = sheet({
    title: c.name,
    body: h('form', { onsubmit: (e) => { e.preventDefault(); submit(); } },
      field('Name', name),
      c.kind !== 'income' ? field('Monatsbudget', budget, 'Optional.') : null,
      seg ? h('div', { class: 'field' }, h('span', { class: 'field-l' }, 'Zählt als'), seg.el) : null,
      err,
      h('p', { class: 'help', style: { marginTop: '18px' } }, uses ? `${uses} ${uses === 1 ? 'Buchung oder Fixposten nutzt' : 'Buchungen und Fixposten nutzen'} diese Kategorie.` : 'Noch nicht benutzt.'),
      isFallback ? null : h('div', { class: 'danger-zone' }, h('button', { type: 'button', class: 'btn danger small', onclick: remove }, uses ? `Löschen und nach ${category(c.kind === 'income' ? FALLBACK.income : FALLBACK.expense)?.name} verschieben` : 'Löschen'))),
    foot: [h('button', { type: 'button', class: 'btn primary', onclick: submit }, 'Speichern')],
  });
}

// ---------------------------------------------------------------------------
// Confirm: only where undo is not possible.

export function confirm({ title, text, action, run, cancel = 'Abbrechen' }) {
  const s = sheet({
    title,
    body: h('p', { class: 'lede', style: { marginTop: '0' } }, text),
    foot: [
      h('button', { type: 'button', class: 'btn ghost', onclick: () => s.close() }, cancel),
      h('button', { type: 'button', class: 'btn primary', onclick: () => { s.close(); run(); } }, action),
    ],
  });
  return s;
}

export function nextDueLabel(r) {
  const k = nextDue(r, currentMonth());
  if (!k) return null;
  return k === currentMonth() ? `${r.day}. ${monthName(k)}` : monthLabel(k);
}

export { monthlyEquivalent, shortDate };
