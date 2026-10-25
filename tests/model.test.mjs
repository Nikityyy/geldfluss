import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, daysInMonth, dayInMonth, dayLabel, isDate, monthLabel, useAustrianMonths } from '../app/js/dates.js';
import {
  addCategory, addEntry, addRecurring, averages, DataError, deleteCategory, emptyState, endRecurring, fixedOverview,
  insight, merge, monthItems, monthlyEquivalent, normalize, occurrence, removeDemo, series, setOccurrence, summarize,
  toCSV, updateRecurring,
} from '../app/js/model.js';
import { withDemo } from '../app/js/demo.js';

const TODAY = '2026-10-25';

function sample() {
  let s = emptyState();
  s = addRecurring(s, { name: 'Gehalt', type: 'income', categoryId: 'gehalt', cents: 290000, start: '2026-08', day: 1 });
  s = addRecurring(s, { name: 'Miete', type: 'expense', categoryId: 'wohnen', cents: 89000, start: '2026-08', day: 1 });
  s = addRecurring(s, { name: 'Versicherung', type: 'expense', categoryId: 'versicherungen', cents: 7138, start: '2026-08', day: 28 });
  s = addRecurring(s, { name: 'ETF', type: 'expense', categoryId: 'sparen', cents: 30000, start: '2026-08', day: 2 });
  s = addRecurring(s, { name: 'KlimaTicket', type: 'expense', categoryId: 'mobilitaet', cents: 117900, start: '2026-09', day: 14, every: 12 });
  s = addEntry(s, { date: '2026-10-03', cents: 4782, type: 'expense', categoryId: 'lebensmittel', note: 'Billa' });
  s = addEntry(s, { date: '2026-10-20', cents: 2260, type: 'expense', categoryId: 'essen-gehen', note: '' });
  return s;
}

test('dates: month arithmetic and labels', () => {
  assert.equal(addMonths('2026-11', 3), '2027-02');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(daysInMonth('2028-02'), 29);
  assert.equal(dayInMonth('2026-02', 31), '2026-02-28');
  assert.equal(isDate('2026-02-30'), false);
  assert.equal(isDate('2026-10-25'), true);
  assert.equal(dayLabel('2026-10-25', TODAY), 'Heute');
  assert.equal(dayLabel('2026-10-24', TODAY), 'Gestern');
  assert.equal(dayLabel('2026-10-23', TODAY), 'Freitag, 23. Oktober');
  useAustrianMonths(true);
  assert.equal(monthLabel('2027-01'), 'Jänner 2027');
  useAustrianMonths(false);
  assert.equal(monthLabel('2027-01'), 'Januar 2027');
});

test('recurring items fall due by their interval', () => {
  const s = sample();
  const ticket = s.recurring.find((r) => r.name === 'KlimaTicket');
  assert.equal(occurrence(ticket, '2026-08'), null);
  assert.equal(occurrence(ticket, '2026-09').cents, 117900);
  assert.equal(occurrence(ticket, '2026-10'), null);
  assert.equal(occurrence(ticket, '2027-09').date, '2027-09-14');
  assert.equal(monthlyEquivalent(ticket, '2026-10'), 9825);
});

test('a month adds up, with planned items counted as spent', () => {
  const sum = summarize(sample(), '2026-10', TODAY);
  assert.equal(sum.income, 290000);
  assert.equal(sum.saved, 30000);
  assert.equal(sum.spent, 89000 + 7138 + 4782 + 2260);
  assert.equal(sum.left, 290000 - 30000 - 89000 - 7138 - 4782 - 2260);
  assert.equal(sum.planned, 7138, 'the insurance on the 28th is still to come');
  assert.equal(sum.daysLeft, 7);
  assert.equal(sum.perDay, Math.floor(sum.left / 7));
  assert.equal(sum.expenses[0].category.id, 'wohnen');
  const items = monthItems(sample(), '2026-10', TODAY);
  assert.equal(items[0].date, '2026-10-28');
  assert.ok(items[0].planned);
});

test('an amount change applies from its month on only', () => {
  let s = sample();
  const id = s.recurring.find((r) => r.name === 'Miete').id;
  s = updateRecurring(s, id, { cents: 92000 }, '2026-10');
  assert.equal(summarize(s, '2026-09', TODAY).expenses.find((r) => r.category.id === 'wohnen').cents, 89000);
  assert.equal(summarize(s, '2026-10', TODAY).expenses.find((r) => r.category.id === 'wohnen').cents, 92000);
  s = updateRecurring(s, id, { cents: 89000 }, '2026-10');
  assert.equal(s.recurring.find((r) => r.id === id).amounts.length, 1, 'going back merges the history');
});

test('one month can be skipped or changed without touching the others', () => {
  let s = sample();
  const id = s.recurring.find((r) => r.name === 'Versicherung').id;
  s = setOccurrence(s, id, '2026-10', { skip: true });
  assert.equal(summarize(s, '2026-10', TODAY).planned, 0);
  s = setOccurrence(s, id, '2026-10', { cents: 9000 });
  assert.equal(summarize(s, '2026-10', TODAY).planned, 9000);
  assert.equal(summarize(s, '2026-11', TODAY).planned, 89000 + 7138 + 30000);
  s = setOccurrence(s, id, '2026-10', {});
  assert.equal(summarize(s, '2026-10', TODAY).planned, 7138);
});

test('ending an item keeps the past', () => {
  let s = sample();
  const id = s.recurring.find((r) => r.name === 'Miete').id;
  s = endRecurring(s, id, '2026-11');
  assert.equal(s.recurring.find((r) => r.id === id).end, '2026-10');
  assert.equal(summarize(s, '2026-11', TODAY).spent, 7138);
  s = endRecurring(s, id, '2026-08');
  assert.equal(s.recurring.find((r) => r.id === id), undefined, 'ending before the start removes it');
});

test('an overspent month goes negative and has no per-day amount', () => {
  let s = sample();
  s = addEntry(s, { date: '2026-10-21', cents: 250000, type: 'expense', categoryId: 'urlaub' });
  const sum = summarize(s, '2026-10', TODAY);
  assert.ok(sum.left < 0);
  assert.equal(sum.perDay, 0);
});

test('fixed costs overview converts every interval to a month', () => {
  const o = fixedOverview(sample(), '2026-10');
  assert.equal(o.income, 290000);
  assert.equal(o.expense, 89000 + 7138 + 30000 + 9825);
  assert.equal(o.free, o.income - o.expense);
});

test('deleting a category moves its bookings to Sonstiges', () => {
  let s = sample();
  const made = addCategory(s, { name: 'Hund', kind: 'expense' });
  s = addEntry(made.state, { date: '2026-10-05', cents: 3999, type: 'expense', categoryId: made.id });
  s = deleteCategory(s, made.id);
  assert.equal(s.entries.find((e) => e.cents === 3999).categoryId, 'sonstiges');
  assert.equal(deleteCategory(s, 'sonstiges'), s, 'the fallback cannot be deleted');
});

test('normalize repairs or refuses what it gets', () => {
  assert.throws(() => normalize({ app: 'other' }), DataError);
  assert.throws(() => normalize({ app: 'geldfluss', schema: 99 }), DataError);
  const fixed = normalize({
    app: 'geldfluss', schema: 1,
    categories: [{ id: 'x', name: 'X', kind: 'expense' }],
    entries: [
      { id: 'a', date: '2026-10-01', cents: 500, type: 'expense', categoryId: 'missing' },
      { id: 'b', date: '2026-13-01', cents: 500, type: 'expense', categoryId: 'x' },
      { id: 'c', date: '2026-10-01', cents: -5, type: 'expense', categoryId: 'x' },
    ],
    recurring: [{ id: 'r', type: 'expense', start: '2026-10', amounts: [{ from: '2026-10', cents: 100 }], every: 5 }],
  });
  assert.equal(fixed.entries.length, 1);
  assert.equal(fixed.entries[0].categoryId, 'sonstiges');
  assert.ok(fixed.categories.some((c) => c.id === 'sonstiges'));
  assert.equal(fixed.recurring[0].every, 1);
  assert.equal(fixed.settings.onboarded, true);
});

test('a saved state survives a round trip through JSON', () => {
  const s = sample();
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))), s);
});

test('merge replaces same ids and keeps the rest', () => {
  const a = sample();
  const b = structuredClone(a);
  b.entries[0].cents = 1;
  b.entries.push({ id: 'new', date: '2026-10-10', cents: 700, type: 'expense', categoryId: 'freizeit', note: '', created: 1 });
  const m = merge(a, b);
  assert.equal(m.entries.length, a.entries.length + 1);
  assert.equal(m.entries.find((e) => e.id === a.entries[0].id).cents, 1);
});

test('the sample data looks like a believable month and can be removed', () => {
  const s = withDemo(emptyState(), TODAY);
  const sum = summarize(s, '2026-10', TODAY);
  assert.equal(sum.income, 290000);
  assert.ok(sum.left > 0 && sum.left < 150000, `left ${sum.left}`);
  assert.ok(s.entries.every((e) => e.date <= TODAY));
  assert.ok(insight(s, sum, TODAY));
  const clean = removeDemo(addEntry(s, { date: TODAY, cents: 100, type: 'expense', categoryId: 'freizeit' }));
  assert.equal(clean.recurring.length, 0);
  assert.equal(clean.entries.length, 1, 'own entries stay');
});

test('history and averages', () => {
  const s = withDemo(emptyState(), TODAY);
  const list = series(s, '2026-10', TODAY, 12);
  assert.equal(list.length, 12);
  assert.equal(list.at(-1).key, '2026-10');
  assert.ok(list[0].empty);
  const avg = averages(s, '2026-10', TODAY, 12);
  assert.equal(avg.months, 6);
  assert.equal(avg.income, 290000);
});

test('CSV export is safe for spreadsheets', () => {
  let s = sample();
  s = addEntry(s, { date: '2026-10-04', cents: 100, type: 'expense', categoryId: 'freizeit', note: '=HYPERLINK("x")' });
  const csv = toCSV(s, TODAY);
  assert.ok(csv.startsWith('﻿Datum;Art;Kategorie;Betrag;Notiz;Fixposten'));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(csv.includes('2026-10-01;Einnahme;Gehalt;2900,00;Gehalt;ja'));
  assert.ok(csv.includes('2026-09-14;Ausgabe;Mobilität;-1179,00;KlimaTicket;ja'));
});
