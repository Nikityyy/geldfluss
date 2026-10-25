// The four places: Monat, Fixkosten, Verlauf, Einstellungen.

import { app, category, commit, currentMonth, go } from './app.js';
import { addMonths, compareMonths, dayLabel, dayOf, daysInMonth, monthIndex, monthLabel, monthName, monthOf, monthShortName } from './dates.js';
import { describeFlow, mountFlow } from './flow.js';
import { averages, firstMonth, fixedOverview, insight, INTERVALS, series, summarize } from './model.js';
import { formatMoney, formatPercent, formatPlain, formatRound, splitMoney } from './money.js';
import { nextDueLabel, openCategory, openEntry, openOccurrence, openRecurring } from './sheets.js';
import { h, icon, roll } from './ui.js';
import { openExplain } from './settings.js';

const DAY = 86_400_000;
let lastHero = { key: null, cents: null };
let resizeFlow = null;

export function onResize() {
  resizeFlow?.();
}

function heroNumber(el, cents) {
  const m = splitMoney(cents);
  el.replaceChildren(m.minus ? '−' : '', m.euros, h('span', { class: 'c' }, `${m.cents} €`));
}

// ---------------------------------------------------------------------------
// Monat

export function renderMonth(root, key, { animate }) {
  const s = app.state;
  const sum = summarize(s, key, app.today);
  const now = currentMonth();
  const view = h('main', { class: 'view month', id: 'main' });
  root.append(view);

  const colA = h('div', { class: 'col-a' });
  const colB = h('div', { class: 'col-b' });
  view.append(colA, colB);

  // Month switcher: arrows, a swipe on the flow, and the arrow keys.
  const prev = addMonths(key, -1);
  const next = addMonths(key, 1);
  colA.append(h('div', { class: 'top' },
    h('div', { class: 'months' },
      h('a', { class: 'ibtn', href: `#/monat/${prev}`, 'aria-label': `Vorheriger Monat: ${monthLabel(prev)}` }, icon('left')),
      h('h1', { 'aria-live': 'polite' }, monthLabel(key)),
      h('a', { class: 'ibtn', href: `#/monat/${next}`, 'aria-label': `Nächster Monat: ${monthLabel(next)}` }, icon('right'))),
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
      key !== now ? h('a', { class: 'today-link', href: '#/' }, 'Heute') : null,
      h('a', { class: 'ibtn', href: '#/einstellungen', 'aria-label': 'Einstellungen' }, icon('settings')))));

  const empty = sum.income === 0 && sum.out === 0;
  const hasAny = s.entries.length > 0 || s.recurring.length > 0;

  // The hero: what is still free this month.
  const name = monthName(key);
  const heroK = sum.left < 0
    ? (sum.future ? `Fehlt im ${name}, geplant` : `Überzogen im ${name}`)
    : sum.past ? `Übrig geblieben im ${name}` : sum.future ? `Übrig im ${name}, geplant` : `Übrig im ${name}`;
  const heroV = h('p', { class: `hero-v n${sum.left < 0 ? ' neg' : sum.left === 0 ? ' zero' : ''}` });
  const from = animate && lastHero.key === key ? lastHero.cents : null;
  roll(heroV, from, sum.left, (c) => heroNumber(heroV, c));
  lastHero = { key, cents: sum.left };

  let line = null;
  if (sum.current && sum.left > 0) line = `Das sind ${formatMoney(sum.perDay)} pro Tag bis zum ${daysInMonth(key)}.`;
  else if (sum.current && sum.left < 0) line = `Du hast ${formatMoney(-sum.left)} mehr ausgegeben, als reingekommen ist.`;
  else if (sum.future && sum.left > 0) line = `Wenn alle Fixposten bleiben, wie sie sind.`;
  else if (sum.past && sum.income > 0) line = `Das sind ${formatPercent(Math.max(sum.left, 0) + sum.saved, sum.income)} vom Einkommen behalten${sum.saved ? `, mit ${formatMoney(sum.saved)} gespart` : ''}.`;

  const sub = [];
  if (sum.current && sum.planned > 0) {
    const nextItem = sum.items.filter((i) => i.planned && i.type !== 'income').at(-1);
    sub.push(`Noch fällige Fixkosten sind eingerechnet: ${formatMoney(sum.planned)}${nextItem ? `, als Nächstes ${nextItem.note || category(nextItem.categoryId)?.name} am ${dayOf(nextItem.date)}.` : '.'}`);
  }
  const ins = !empty ? insight(s, sum, app.today) : null;

  if (!empty || hasAny) {
    colA.append(h('section', { class: 'hero', 'aria-label': 'Übersicht' },
      h('p', { class: 'hero-k' }, heroK),
      heroV,
      line ? h('p', { class: 'hero-d' }, line) : null,
      sub.map((t) => h('p', { class: 'hero-s' }, t))));
  }

  // Notes: sample data, and the backup reminder (data lives only here).
  const notes = notesFor(sum);
  for (const n of notes) colA.append(n);

  if (empty) {
    colA.append(h('section', { class: 'empty' },
      h('p', { class: 'title', style: { marginTop: '0', color: 'var(--ink)' } }, hasAny ? `Im ${name} fließt noch nichts.` : 'Noch nichts eingetragen.'),
      h('p', { style: { marginTop: '12px' } }, hasAny
        ? (compareMonths(key, now) > 0 ? 'Für diesen Monat ist noch nichts geplant. Fixposten tauchen hier auf, sobald sie fällig werden.' : 'In diesem Monat gibt es keine Buchungen und keine Fixposten.')
        : 'Sag zuerst, wie viel jeden Monat reinkommt. Dann siehst du, wohin es fließt.'),
      hasAny
        ? h('button', { type: 'button', class: 'btn', onclick: () => openEntry() }, icon('plus', 's'), 'Eintragen')
        : h('button', { type: 'button', class: 'btn', onclick: () => openRecurring({ type: 'income' }) }, 'Einkommen eintragen')));
  } else {
    // The flow.
    const incomeLine = h('p', { class: 'flow-in n' },
      sum.incomes.filter((r) => r.cents > 0).map((r) => h('span', {}, `${r.category.name} `, h('b', {}, formatPlain(r.cents)))),
      sum.left < 0 ? h('span', { class: 'neg' }, `Fehlt `, h('b', { class: 'neg' }, formatPlain(-sum.left))) : null,
      sum.income === 0 ? h('span', {}, 'Noch keine Einnahmen') : null);
    const host = h('div', { role: 'img', 'aria-label': describeFlow(sum) });
    colA.append(h('section', { class: 'flow-wrap', 'aria-label': 'Geldfluss' }, incomeLine, host, ins ? h('p', { class: 'flow-cap' }, ins) : null));
    requestAnimationFrame(() => {
      resizeFlow = mountFlow(host, sum, {
        animate,
        onPick: (k, arm) => {
          if (k === '__left') return openExplain();
          openCategory(arm.members ? arm.members[0] : k, key, arm.members || null);
        },
      });
    });
    swipe(host, (dir) => go(`#/monat/${addMonths(key, dir)}`));
  }

  // Where it went: every category with money or a budget.
  if (!empty) {
    const rows = sum.expenses;
    const spentTotal = sum.out;
    colB.append(h('section', { class: 'sec', 'aria-labelledby': 'h-where' },
      h('div', { class: 'sec-h' }, h('h2', { id: 'h-where' }, 'Wohin es ging'), h('span', { class: 'aside n' }, `${formatMoney(spentTotal)} raus`)),
      rows.length ? h('ul', { class: 'rows' }, rows.map((r) => categoryRow(r, sum, key))) : h('p', { class: 'hero-s' }, 'Noch keine Ausgaben.')));

    // Bookings by day.
    const items = sum.items;
    const groups = [];
    for (const it of items) {
      const g = groups.at(-1);
      if (g && g.date === it.date) g.items.push(it);
      else groups.push({ date: it.date, items: [it] });
    }
    const LIMIT = 40;
    let shown = 0;
    const list = h('div', {});
    const renderGroups = (max) => {
      list.replaceChildren();
      shown = 0;
      for (const g of groups) {
        if (shown >= max) break;
        const dayTotal = g.items.reduce((t, i) => t + (i.type === 'income' ? 0 : i.cents), 0);
        const ul = h('ul', { class: 'rows' });
        for (const it of g.items) {
          if (shown >= max) break;
          ul.append(h('li', {}, itemRow(it, key)));
          shown += 1;
        }
        list.append(h('div', { class: 'day' }, h('h3', { class: 'day-h n' }, h('span', {}, dayLabel(g.date, app.today), g.date > app.today ? ' · geplant' : ''), dayTotal ? h('span', {}, formatPlain(dayTotal)) : null), ul));
      }
      if (items.length > max) {
        list.append(h('button', { type: 'button', class: 'btn ghost small more-btn', onclick: () => renderGroups(Infinity) }, `Alle ${items.length} Buchungen zeigen`));
      }
    };
    renderGroups(LIMIT);
    colB.append(h('section', { class: 'sec', 'aria-labelledby': 'h-items' },
      h('div', { class: 'sec-h' }, h('h2', { id: 'h-items' }, 'Buchungen'), h('span', { class: 'aside n' }, `${items.length}`)),
      list));
  }
}

function categoryRow(r, sum, key) {
  const c = r.category;
  const share = sum.income > 0 ? formatPercent(r.cents, sum.income) : formatPercent(r.cents, sum.out);
  let s2 = h('span', { class: 's2' }, share);
  let bar = null;
  if (c.budget) {
    const left = c.budget - r.cents;
    s2 = h('span', { class: `s2 ${left < 0 ? 'warn' : 'ok'}` }, left < 0 ? `${formatPlain(-left)} drüber` : `${formatPlain(left)} frei`);
    const spentPct = Math.min(100, (r.cents / c.budget) * 100);
    bar = h('span', { class: `budget${left < 0 ? ' over' : ''}`, 'aria-hidden': 'true' },
      h('i', { style: { width: `${spentPct}%` } }),
      left > 0 ? h('b', { style: { left: `calc(${spentPct}% + 2px)`, right: '0' } }) : null);
  }
  const sub = [
    c.kind === 'saving' ? 'Sparen' : null,
    `${r.count} ${r.count === 1 ? 'Buchung' : 'Buchungen'}`,
    c.budget ? `Budget ${formatRound(c.budget)}` : null,
    r.planned ? `${formatPlain(r.planned)} geplant` : null,
  ].filter(Boolean).join(' · ');
  return h('li', {}, h('button', { type: 'button', class: 'row', onclick: () => openCategory(c.id, key) },
    h('span', { class: 't' }, c.name),
    h('span', { class: 'v' }, formatPlain(r.cents)),
    h('span', { class: 's' }, sub),
    s2,
    bar));
}

function itemRow(it, key) {
  const c = category(it.categoryId);
  const title = it.note || c?.name || '';
  const sub = [it.note ? c?.name : null, it.kind === 'recurring' && it.overridden ? 'nur diesen Monat geändert' : null].filter(Boolean).join(' · ');
  return h('button', {
    type: 'button',
    class: `row${it.planned ? ' planned' : ''}`,
    onclick: () => (it.kind === 'recurring' ? openOccurrence(it.recurringId, key) : openEntry({ entry: app.state.entries.find((e) => e.id === it.id) })),
  },
  h('span', { class: 't' }, h('span', { class: 'nm' }, title), it.kind === 'recurring' ? h('span', { class: 'tag' }, 'fix') : null),
  h('span', { class: `v${it.type === 'income' ? ' in' : ''}` }, `${it.type === 'income' ? '+' : ''}${formatPlain(it.cents)}`),
  sub ? h('span', { class: 's' }, sub) : null);
}

function notesFor(sum) {
  const s = app.state;
  const out = [];
  if (s.settings.demo) {
    out.push(h('aside', { class: 'note' }, h('div', {},
      h('p', {}, h('b', {}, 'Das sind Beispieldaten. '), 'Schau dich um, trag etwas ein, nichts davon ist echt.'),
      h('div', { class: 'acts' }, h('a', { class: 'link', href: '#/einstellungen' }, 'In den Einstellungen entfernen')))));
    return out;
  }
  const own = s.entries.length + s.recurring.length;
  if (own === 0) return out;
  const last = s.settings.lastBackup;
  const snooze = s.settings.backupSnooze;
  const oldest = Math.min(...s.entries.map((e) => e.created || Date.now()), Date.now());
  const due = (!last && Date.now() - oldest > 3 * DAY && own >= 5) || (last && Date.now() - last > 30 * DAY);
  if (due && (!snooze || Date.now() > snooze)) {
    out.push(h('aside', { class: 'note' }, h('div', {},
      h('p', {}, h('b', {}, 'Deine Daten liegen nur in diesem Browser. '), last ? `Letzte Sicherung vor ${Math.round((Date.now() - last) / DAY)} Tagen.` : 'Eine Sicherung als Datei schützt sie, falls der Browser sie löscht.'),
      h('div', { class: 'acts' },
        h('a', { class: 'link', href: '#/einstellungen/sicherung' }, 'Sicherung speichern'),
        h('button', { type: 'button', class: 'link', onclick: () => commit({ ...s, settings: { ...s.settings, backupSnooze: Date.now() + 14 * DAY } }, { undo: false }) }, 'Später')))));
  }
  return out;
}

function swipe(el, onSwipe) {
  let x0 = null;
  let y0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) onSwipe(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// ---------------------------------------------------------------------------
// Fixkosten

export function renderFixed(root) {
  const key = currentMonth();
  const o = fixedOverview(app.state, key);
  const view = h('main', { class: 'view narrow', id: 'main' });
  root.append(view);
  view.append(h('div', { class: 'top top-row' }, h('span', { class: 'top-title' }, `Stand ${monthLabel(key)}`), h('a', { class: 'ibtn', href: '#/einstellungen', 'aria-label': 'Einstellungen' }, icon('settings'))));
  view.append(h('h1', { class: 'title' }, 'Fixkosten'));

  const any = o.incomes.length + o.expenses.length + o.upcoming.length + o.ended.length > 0;
  if (!any) {
    view.append(h('p', { class: 'lede' }, 'Alles, was regelmäßig kommt oder geht: Gehalt, Miete, Versicherungen, Abos. Einmal eintragen, dann fließt es jeden Monat von selbst mit.'),
      h('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '24px' } },
        h('button', { type: 'button', class: 'btn', onclick: () => openRecurring({ type: 'income' }) }, 'Einkommen eintragen'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => openRecurring({ type: 'expense' }) }, 'Fixe Ausgabe eintragen')));
    return;
  }

  view.append(h('p', { class: 'lede n' },
    'Jeden Monat fix: ', h('b', {}, formatMoney(o.expense)), '. ',
    o.income > 0 ? (o.free >= 0 ? ['Für alles andere bleiben ', h('b', {}, formatMoney(o.free)), '.'] : ['Das sind ', h('b', {}, formatMoney(-o.free)), ' mehr, als fix reinkommt.']) : 'Noch kein festes Einkommen eingetragen.'));

  if (o.income > 0) view.append(splitStrip(o));

  const section = (title, rows, opts = {}) => rows.length ? h('section', { class: 'sec' },
    h('div', { class: 'sec-h' }, h('h2', {}, title), opts.aside ? h('span', { class: 'aside n' }, opts.aside) : null),
    h('ul', { class: 'rows' }, rows.map((row) => fixedRow(row, opts)))) : null;

  view.append(
    section('Einnahmen', o.incomes, { aside: `${formatMoney(o.income)} im Monat` }),
    section('Ausgaben', o.expenses, { aside: `${formatMoney(o.expense)} im Monat` }),
    section('Beginnt später', o.upcoming, { upcoming: true }),
    section('Beendet', o.ended, { ended: true }));

  view.append(h('div', { style: { marginTop: '28px' } }, h('button', { type: 'button', class: 'btn ghost', onclick: () => openRecurring() }, icon('plus', 's'), 'Fixposten')));
}

function fixedRow({ r, category: c, monthly, cents }, opts) {
  const interval = INTERVALS.find((i) => i.every === r.every)?.label || 'Monatlich';
  const due = !opts.ended ? nextDueLabel(r) : null;
  const sub = [c?.name, r.every === 1 ? `am ${r.day}.` : `${interval}, ${formatMoney(cents)}`, opts.ended ? `bis ${monthLabel(r.end)}` : opts.upcoming ? `ab ${monthLabel(r.start)}` : r.every > 1 && due ? `nächstes Mal ${due}` : r.end ? `bis ${monthLabel(r.end)}` : null].filter(Boolean).join(' · ');
  return h('li', {}, h('button', { type: 'button', class: 'row', onclick: () => openRecurring({ recurring: r, from: opts.upcoming ? r.start : currentMonth() }) },
    h('span', { class: 't' }, r.name),
    h('span', { class: 'v' }, `${r.type === 'income' ? '+' : ''}${formatPlain(monthly)}`),
    h('span', { class: 's' }, sub),
    r.every > 1 ? h('span', { class: 's2' }, 'pro Monat') : null));
}

/** Income as one stream that splits in two: fixed, and free for the rest. */
function splitStrip(o) {
  const W = 340;
  const H = 96;
  const total = Math.max(o.income, o.expense);
  const k = 64 / total;
  const hIn = o.income * k;
  const hFix = Math.min(o.expense, total) * k;
  const hFree = Math.max(o.free, 0) * k;
  const y0 = (H - hIn) / 2;
  const x0 = 6;
  const x1 = W - 6;
  const c = (x0 + x1) / 2;
  const fixY = 2;
  const freeY = H - 2 - hFree;
  const p = (sy, ty, hh) => `M${x0} ${sy}C${c} ${sy} ${c} ${ty} ${x1} ${ty}L${x1} ${ty + hh}C${c} ${ty + hh} ${c} ${sy + hh} ${x0} ${sy + hh}Z`;
  const svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" preserveAspectRatio="none" style="height:${H}px">
    <rect class="bar" x="0" y="${y0}" width="6" height="${hIn}"/>
    <path class="a" d="${p(y0, fixY, hFix)}"/>
    ${hFree > 0 ? `<path class="b" d="${p(y0 + hFix, freeY, hFree)}"/>` : ''}
    <rect class="bar" x="${x1}" y="${fixY}" width="6" height="${hFix}"/>
    ${hFree > 0 ? `<rect class="bar" x="${x1}" y="${freeY}" width="6" height="${hFree}" style="fill:var(--accent)"/>` : ''}
  </svg>`;
  return h('div', { class: 'split' }, h('div', { html: svg }),
    h('div', { class: 'split-legend n' },
      h('div', {}, 'Fix', h('b', {}, formatMoney(o.expense))),
      h('div', { class: `free${o.free < 0 ? ' neg' : ''}` }, o.free >= 0 ? 'Frei für den Rest' : 'Fehlt', h('b', {}, formatMoney(Math.abs(o.free))))));
}

// ---------------------------------------------------------------------------
// Verlauf

export function renderHistory(root) {
  const key = currentMonth();
  // From the first month with data, at least six columns, at most twelve.
  const first = firstMonth(app.state);
  const span = first ? Math.min(12, Math.max(6, monthIndex(key) - monthIndex(first) + 1)) : 6;
  const list = series(app.state, key, app.today, span);
  const avg = averages(app.state, key, app.today, 12);
  const now = summarize(app.state, key, app.today);
  const view = h('main', { class: 'view narrow', id: 'main' });
  root.append(view);
  view.append(h('div', { class: 'top top-row' }, h('span', { class: 'top-title' }, 'Die letzten zwölf Monate'), h('a', { class: 'ibtn', href: '#/einstellungen', 'aria-label': 'Einstellungen' }, icon('settings'))));
  view.append(h('h1', { class: 'title' }, 'Verlauf'));

  if (avg.months === 0) {
    view.append(h('p', { class: 'lede' }, `Sobald ein Monat abgeschlossen ist, siehst du hier, wie sich Einnahmen, Ausgaben und das, was übrig bleibt, entwickeln. Der ${monthName(key)} läuft noch.`));
  } else {
    const kept = avg.income > 0 ? formatPercent(Math.max(avg.left, 0) + avg.saved, avg.income) : null;
    view.append(h('p', { class: 'lede n' },
      `In ${avg.months === 1 ? 'einem Monat' : `${avg.months} Monaten`} hast du im Schnitt `, h('b', {}, formatMoney(avg.out)), ' ausgegeben',
      avg.saved ? [' (davon ', h('b', {}, formatMoney(avg.saved)), ' gespart)'] : '',
      avg.income > 0 ? [' und ', h('b', {}, formatMoney(Math.max(avg.left, 0))), ` behalten. Zusammen mit dem Sparen sind das ${kept} vom Einkommen.`] : '.'));
  }

  // The chart: one column per month. Outline = income, filled = out, yellow = kept.
  const max = Math.max(1, ...list.map((m) => Math.max(m.income, m.out)));
  const chart = h('div', { class: 'chart-in' }, list.map((m) => {
    const hp = (c) => `${(c / max) * 100}%`;
    const kept = Math.max(m.income - m.out, 0);
    const over = Math.max(m.out - m.income, 0);
    const label = `${monthLabel(m.key)}: ${formatPlain(m.income)} Euro rein, ${formatPlain(m.out)} Euro raus${kept ? `, ${formatPlain(kept)} Euro übrig` : over ? `, ${formatPlain(over)} Euro zu viel` : ''}`;
    return h('a', { class: `col${m.empty ? ' empty-col' : ''}`, href: `#/monat/${m.key}`, 'aria-current': m.key === key ? 'true' : null, 'aria-label': label, title: label },
      h('span', { class: 'bars' },
        m.income ? h('span', { class: 'inc', style: { height: hp(m.income) } }) : null,
        h('span', { class: 'out', style: { height: hp(Math.min(m.out, m.income || m.out)) } }),
        kept ? h('span', { class: 'kept', style: { bottom: hp(m.out), height: hp(kept) } }) : null,
        over && m.income ? h('span', { class: 'over', style: { bottom: hp(m.income), height: hp(over) } }) : null),
      h('span', { class: 'lbl' }, monthShortName(m.key)));
  }));
  view.append(h('div', { class: 'chart', role: 'group', 'aria-label': 'Einnahmen und Ausgaben pro Monat' }, chart),
    h('div', { class: 'chart-key' }, h('span', {}, h('i', { class: 'k-inc' }), 'Einnahmen'), h('span', {}, h('i', { class: 'k-out' }), 'Ausgaben und Sparen'), h('span', {}, h('i', { class: 'k-kept' }), 'Übrig')));

  // Categories: average per month against this month.
  if (avg.months > 0) {
    const rows = [...avg.byCategory.entries()]
      .map(([id, a]) => ({ c: category(id), a, now: now.expenses.find((r) => r.category.id === id)?.cents || 0 }))
      .filter((r) => r.c)
      .sort((x, y) => y.a - x.a);
    const grid = h('div', { class: 'cmp n' },
      h('span', { class: 'h' }, 'Kategorie'), h('span', { class: 'h r' }, 'Ø Monat'), h('span', { class: 'h r' }, monthName(key)));
    for (const r of rows) {
      const diff = r.a ? r.now / r.a - 1 : 0;
      // The running month can only be judged where it is already above average.
      const cls = diff >= 0.1 ? 'up' : 'same';
      grid.append(
        h('span', { class: 'nm' }, r.c.name),
        h('span', { class: 'r' }, formatPlain(r.a)),
        h('span', { class: `r ${cls}` }, formatPlain(r.now)));
    }
    view.append(h('section', { class: 'sec' },
      h('div', { class: 'sec-h' }, h('h2', {}, 'Im Schnitt'), h('span', { class: 'aside' }, `${avg.months} ${avg.months === 1 ? 'Monat' : 'Monate'}, ohne ${monthName(key)}`)),
      grid,
      h('p', { class: 'hero-s', style: { marginTop: '12px' } }, `Der ${monthName(key)} läuft noch. Rot heißt: schon jetzt über dem Schnitt.`)));
  }
}

export { monthOf };
