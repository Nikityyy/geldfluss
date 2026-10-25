// Money is stored as whole cents (integers) everywhere, so sums never drift.
// Formatting is fixed to the German convention (1.234,56 €) so the app reads
// the same on every device, whatever the browser's locale.

const NBSP = ' ';

/**
 * Reads an amount typed by a person: "12", "12,5", "1.234,56", "1234.56",
 * "1 234,50 €", "-12,00" (the sign is ignored; the type decides the sign).
 * Returns whole cents, or null when the text is not an amount.
 */
export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(Math.abs(input) * 100) : null;
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/€|eur|euro/gi, '').replace(/[\s  ']/g, '').replace(/^[-+−]/, '');
  if (!s) return null;
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let intPart;
  let fracPart = '';

  if (lastComma >= 0 && lastDot >= 0) {
    // Both appear: whichever comes last is the decimal mark.
    const dec = lastComma > lastDot ? ',' : '.';
    const thou = dec === ',' ? '.' : ',';
    const [a, b = ''] = s.split(dec);
    if (s.split(dec).length > 2) return null;
    if (!validGroups(a, thou)) return null;
    intPart = a.split(thou).join('');
    fracPart = b;
  } else if (lastComma >= 0 || lastDot >= 0) {
    const mark = lastComma >= 0 ? ',' : '.';
    const parts = s.split(mark);
    if (parts.length === 2 && parts[1].length !== 3) {
      // "12,5" or "12.50": a decimal mark.
      [intPart, fracPart] = parts;
    } else if (parts.length === 2 && mark === ',') {
      // "1,234" with a comma: in German that is 1 euro and 234 thousandths,
      // which is not an amount; read it as a decimal with too many digits.
      return null;
    } else {
      // "1.234" or "1.234.567": thousands separators.
      if (!validGroups(s, mark)) return null;
      intPart = parts.join('');
    }
  } else {
    intPart = s;
  }

  if (intPart === '') intPart = '0';
  if (!/^\d+$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;
  if (fracPart.length > 2) return null;
  const cents = Number(intPart) * 100 + Number((fracPart + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents > 99_999_999_99) return null;
  return cents;
}

function validGroups(text, sep) {
  if (!text.includes(sep)) return /^\d+$/.test(text);
  const groups = text.split(sep);
  return /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every((g) => /^\d{3}$/.test(g));
}

function group(intString) {
  return intString.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "1.234,56" */
export function formatPlain(cents) {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  return `${neg ? '−' : ''}${group(String(euros))},${rest}`;
}

/** "1.234,56 €", with a non-breaking space before the sign. */
export function formatMoney(cents, { sign = false } = {}) {
  const text = `${formatPlain(Math.abs(cents))}${NBSP}€`;
  if (cents < 0) return `−${text}`;
  if (sign && cents > 0) return `+${text}`;
  return text;
}

/** "1.235 €": rounded to whole euros, for labels where cents are noise. */
export function formatRound(cents) {
  const neg = cents < 0;
  const euros = Math.round(Math.abs(cents) / 100);
  return `${neg ? '−' : ''}${group(String(euros))}${NBSP}€`;
}

/** Splits for the hero number: { minus, euros: "745", cents: ",10" }. */
export function splitMoney(cents) {
  const abs = Math.abs(Math.round(cents));
  return {
    minus: cents < 0,
    euros: group(String(Math.floor(abs / 100))),
    cents: `,${String(abs % 100).padStart(2, '0')}`,
  };
}

/** The value an amount field shows when editing: "12,50" (no grouping). */
export function formatInput(cents) {
  if (cents == null) return '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  return rest === 0 ? String(euros) : `${euros},${String(rest).padStart(2, '0')}`;
}

/** Share as a whole percent, "31 %". */
export function formatPercent(part, whole) {
  if (!whole) return `0${NBSP}%`;
  const p = (part / whole) * 100;
  const shown = p > 0 && p < 1 ? '<1' : String(Math.round(p));
  return `${shown}${NBSP}%`;
}
