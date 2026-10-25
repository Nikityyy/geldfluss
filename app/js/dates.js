// Months are keys like "2026-10", days are ISO dates like "2026-10-25", both
// in the person's local time. Plain strings keep storage, sorting and
// comparison simple and free of time-zone surprises.

export const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const MONTHS_SHORT = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// Austrian German says "Jänner"; everyone else "Januar". The app follows the
// browser's language region once, at start.
let monthNames = MONTHS_DE;
let monthShort = ['Jan', ...MONTHS_SHORT.slice(1)];
export function useAustrianMonths(on) {
  monthNames = on ? MONTHS : MONTHS_DE;
  monthShort = on ? MONTHS_SHORT : ['Jan', ...MONTHS_SHORT.slice(1)];
}

const pad = (n) => String(n).padStart(2, '0');

export function isMonthKey(key) {
  return typeof key === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
}

export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(`${y}-${pad(m)}`);
}

export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function monthOf(date) {
  return date.slice(0, 7);
}

export function monthIndex(key) {
  const [y, m] = key.split('-').map(Number);
  return y * 12 + (m - 1);
}

export function monthFromIndex(index) {
  const y = Math.floor(index / 12);
  const m = index - y * 12 + 1;
  return `${y}-${pad(m)}`;
}

export function addMonths(key, n) {
  return monthFromIndex(monthIndex(key) + n);
}

export function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** The date of a given day in a month, clamped to the month's last day. */
export function dayInMonth(key, day) {
  return `${key}-${pad(Math.min(Math.max(1, day), daysInMonth(key)))}`;
}

export function dayOf(date) {
  return Number(date.slice(8, 10));
}

export function compareMonths(a, b) {
  return monthIndex(a) - monthIndex(b);
}

export function monthName(key) {
  return monthNames[Number(key.slice(5, 7)) - 1];
}

export function monthShortName(key) {
  return monthShort[Number(key.slice(5, 7)) - 1];
}

/** "Oktober 2026" */
export function monthLabel(key) {
  return `${monthName(key)} ${key.slice(0, 4)}`;
}

/** "Heute", "Gestern", "Morgen", or "Freitag, 23. Oktober" */
export function dayLabel(date, today) {
  if (date === today) return 'Heute';
  const d = new Date(`${date}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  const diff = Math.round((d - t) / 86_400_000);
  if (diff === -1) return 'Gestern';
  if (diff === 1) return 'Morgen';
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${monthNames[d.getMonth()]}`;
}

/** "23. Okt." */
export function shortDate(date) {
  const d = Number(date.slice(8, 10));
  return `${d}. ${monthShort[Number(date.slice(5, 7)) - 1]}.`;
}

/** Days from `today` to the end of its month, today included. */
export function daysLeftInMonth(today) {
  return daysInMonth(monthOf(today)) - dayOf(today) + 1;
}
