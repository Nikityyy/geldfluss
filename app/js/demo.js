// Sample data to look around with: one person with 2.900 € net, six months of
// history and the current month up to today. Every item carries demo: true,
// so "Beispieldaten entfernen" takes exactly these away and nothing else.

import { addMonths, dayInMonth, daysInMonth, monthOf } from './dates.js';
import { normalize } from './model.js';

// A small seeded generator, so the sample looks the same every time.
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHOPS = {
  lebensmittel: ['Billa', 'Spar', 'Hofer', 'Lidl', 'Markt am Yppenplatz', 'Bäckerei Ströck', 'Penny'],
  'essen-gehen': ['Pizzeria Riva', 'Kebap am Eck', 'Café Prückel', 'Sushi-Bar', 'Mittagsmenü', 'Würstelstand'],
  freizeit: ['Kino', 'Konzertkarte', 'Kletterhalle', 'Buch', 'Steam-Spiel', 'Museumsquartier'],
  kleidung: ['Laufschuhe', 'Jeans', 'Winterjacke', 'T-Shirts'],
  mobilitaet: ['Tanken', 'ÖBB nach Graz', 'Taxi', 'Fahrradservice'],
  haushalt: ['dm', 'IKEA', 'Bipa', 'Glühbirnen'],
  gesundheit: ['Apotheke', 'Physiotherapie', 'Zahnarzt Selbstbehalt'],
  geschenke: ['Geburtstag Mama', 'Hochzeitsgeschenk', 'Blumen'],
};

export function demoState(today) {
  const rand = random(20261025);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const cents = (min, max) => Math.round((min + rand() * (max - min)) * 100);

  const current = monthOf(today);
  const start = addMonths(current, -6);
  const r = (id, name, type, categoryId, amount, extra = {}) => ({
    id: `demo-r-${id}`, name, type, categoryId, every: 1, day: 1, start, end: null,
    amounts: [{ from: start, cents: amount }], skips: [], overrides: {}, note: '', demo: true, ...extra,
  });

  const recurring = [
    r('gehalt', 'Gehalt', 'income', 'gehalt', 290000, { day: 1 }),
    r('miete', 'Miete', 'expense', 'wohnen', 78000, { day: 1 }),
    r('bk', 'Betriebskosten', 'expense', 'wohnen', 11000, { day: 1 }),
    r('strom', 'Strom & Gas', 'expense', 'energie', 9600, { day: 5, amounts: [{ from: start, cents: 8900 }, { from: addMonths(start, 3), cents: 9600 }] }),
    r('internet', 'Internet', 'expense', 'handy-internet', 3999, { day: 3 }),
    r('handy', 'Handy', 'expense', 'handy-internet', 1499, { day: 3 }),
    r('haushalt-vers', 'Haushaltsversicherung', 'expense', 'versicherungen', 1838, { day: 15 }),
    r('kranken', 'Zusatzversicherung', 'expense', 'versicherungen', 5300, { day: 28 }),
    r('spotify', 'Spotify', 'expense', 'abos', 1099, { day: 12 }),
    r('netflix', 'Netflix', 'expense', 'abos', 1399, { day: 19 }),
    r('icloud', 'iCloud', 'expense', 'abos', 299, { day: 22 }),
    r('fitness', 'Fitnessstudio', 'expense', 'freizeit', 2990, { day: 2 }),
    r('etf', 'ETF-Sparplan', 'expense', 'sparen', 30000, { day: 2 }),
    r('klimaticket', 'KlimaTicket Ö', 'expense', 'mobilitaet', 117900, { day: 14, every: 12, start: addMonths(current, -4) }),
    r('orf', 'ORF-Beitrag', 'expense', 'abos', 4590, { day: 20, every: 3, start: addMonths(current, -5) }),
  ];
  for (const item of recurring) if (item.amounts[0].from !== item.start) item.amounts[0].from = item.start;

  const entries = [];
  let n = 0;
  const add = (date, categoryId, amount, note) => {
    if (date > today) return;
    entries.push({ id: `demo-e-${n++}`, date, cents: amount, type: 'expense', categoryId, note, created: n, demo: true });
  };

  for (let k = start; k <= current; k = addMonths(k, 1)) {
    const days = daysInMonth(k);
    // Groceries about twice a week.
    for (let d = 2; d <= days; d += 3 + Math.floor(rand() * 2)) add(dayInMonth(k, d), 'lebensmittel', cents(14, 68), pick(SHOPS.lebensmittel));
    const eats = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < eats; i++) add(dayInMonth(k, 1 + Math.floor(rand() * days)), 'essen-gehen', cents(9, 46), pick(SHOPS['essen-gehen']));
    const fun = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < fun; i++) add(dayInMonth(k, 1 + Math.floor(rand() * days)), 'freizeit', cents(12, 49), pick(SHOPS.freizeit));
    add(dayInMonth(k, 4 + Math.floor(rand() * 20)), 'haushalt', cents(11, 38), pick(SHOPS.haushalt));
    if (rand() < 0.6) add(dayInMonth(k, 1 + Math.floor(rand() * days)), 'kleidung', cents(25, 90), pick(SHOPS.kleidung));
    if (rand() < 0.7) add(dayInMonth(k, 1 + Math.floor(rand() * days)), 'mobilitaet', cents(18, 62), pick(SHOPS.mobilitaet));
    if (rand() < 0.4) add(dayInMonth(k, 1 + Math.floor(rand() * days)), 'gesundheit', cents(8, 45), pick(SHOPS.gesundheit));
    if (rand() < 0.35) add(dayInMonth(k, 1 + Math.floor(rand() * days)), 'geschenke', cents(20, 60), pick(SHOPS.geschenke));
  }
  // One summer trip, so the history has a month that stands out.
  const trip = addMonths(current, -3);
  add(dayInMonth(trip, 8), 'urlaub', 41260, 'Ferienwohnung Kroatien');
  add(dayInMonth(trip, 9), 'urlaub', 8740, 'Fähre und Maut');

  return { recurring, entries };
}

/** Adds the sample to a state (which keeps the person's own data). */
export function withDemo(state, today) {
  const { recurring, entries } = demoState(today);
  const next = structuredClone(state);
  next.recurring = next.recurring.filter((r) => !r.demo).concat(recurring);
  next.entries = next.entries.filter((e) => !e.demo).concat(entries);
  next.settings.demo = true;
  next.settings.onboarded = true;
  return normalize(next);
}
