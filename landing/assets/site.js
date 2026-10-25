// The "try it" flow: the same layout and animation as the app, fed by the
// visitor's own numbers. Nothing is stored.

import { mountFlow } from '../app/js/flow.js';
import { formatMoney, parseAmount } from '../app/js/money.js';

const POSTS = [
  { id: 'wohnen', name: 'Wohnen', kind: 'expense', cents: 89000, max: 250000 },
  { id: 'lebensmittel', name: 'Lebensmittel', kind: 'expense', cents: 38000, max: 120000 },
  { id: 'freizeit', name: 'Freizeit und Essen gehen', kind: 'expense', cents: 26000, max: 100000 },
  { id: 'abos', name: 'Abos und Handy', kind: 'expense', cents: 8500, max: 40000 },
  { id: 'mobil', name: 'Mobilität', kind: 'expense', cents: 9800, max: 80000 },
  { id: 'sparen', name: 'Sparen', kind: 'saving', cents: 30000, max: 150000 },
];

const income = document.getElementById('t-income');
const sliders = document.getElementById('sliders');
const leftLine = document.getElementById('t-left');
const host = document.getElementById('t-flow');

const fmtShort = (c) => `${Math.round(c / 100).toLocaleString('de-AT')} €`;

for (const p of POSTS) {
  const id = `s-${p.id}`;
  const out = document.createElement('output');
  out.htmlFor = id;
  out.textContent = fmtShort(p.cents);
  const input = Object.assign(document.createElement('input'), { type: 'range', id, min: 0, max: p.max, step: 500, value: p.cents });
  input.style.setProperty('--p', `${(p.cents / p.max) * 100}%`);
  input.addEventListener('input', () => {
    p.cents = Number(input.value);
    out.textContent = fmtShort(p.cents);
    input.style.setProperty('--p', `${(p.cents / p.max) * 100}%`);
    schedule();
  });
  const row = document.createElement('div');
  row.className = 'slider';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = p.name;
  row.append(label, out, input);
  sliders.append(row);
}

function summary() {
  const inc = parseAmount(income.value) ?? 0;
  const expenses = POSTS.map((p) => ({ category: { id: p.id, name: p.name, kind: p.kind }, cents: p.cents })).filter((r) => r.cents > 0)
    .sort((a, b) => (a.category.kind === 'saving') - (b.category.kind === 'saving') || b.cents - a.cents);
  const out = expenses.reduce((s, r) => s + r.cents, 0);
  return {
    income: inc,
    out,
    left: inc - out,
    expenses,
    incomes: inc > 0 ? [{ category: { id: 'netto', name: 'Netto', kind: 'income' }, cents: inc }] : [],
  };
}

let redraw = () => {};
let frame = 0;
function draw() {
  const s = summary();
  redraw = mountFlow(host, s, { animate: true });
  const days = 30;
  leftLine.replaceChildren();
  const b = document.createElement('b');
  if (s.left >= 0) {
    b.textContent = formatMoney(s.left);
    leftLine.append('Dir bleiben ', b, ` im Monat, rund ${formatMoney(Math.floor(s.left / days))} pro Tag.`);
    leftLine.classList.remove('neg');
  } else {
    b.textContent = formatMoney(-s.left);
    leftLine.append('Es fehlen ', b, ' im Monat.');
    leftLine.classList.add('neg');
  }
}
function schedule() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
}

income.addEventListener('input', () => {
  const clean = income.value.replace(/[^\d.,]/g, '');
  if (clean !== income.value) income.value = clean;
  schedule();
});
income.addEventListener('blur', () => {
  const v = parseAmount(income.value);
  if (v != null) income.value = (v / 100).toLocaleString('de-AT', { maximumFractionDigits: 2 });
});

let resizeTimer = 0;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => redraw(), 100); });

// Draw once the section is near, so the first morph is seen, not missed.
const io = new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) { io.disconnect(); draw(); }
}, { rootMargin: '200px' });
io.observe(host);
