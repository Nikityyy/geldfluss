import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatInput, formatMoney, formatPercent, formatPlain, formatRound, parseAmount, splitMoney } from '../app/js/money.js';

test('parses the ways people type amounts', () => {
  const cases = {
    '12': 1200, '12,5': 1250, '12,50': 1250, '12.50': 1250, '0,99': 99, ',5': 50,
    '1.234,56': 123456, '1,234.56': 123456, '1.234': 123400, '1.234.567': 123456700,
    '1 234,50 €': 123450, '€ 7,10': 710, '2900': 290000, '-12,00': 1200, '  89,9  ': 8990,
  };
  for (const [input, cents] of Object.entries(cases)) assert.equal(parseAmount(input), cents, input);
});

test('refuses what is not an amount', () => {
  for (const input of ['', 'abc', '12,345', '1.23.4', '12,5,0', '1.2345', '12a', '..', '1,2,3', null, undefined]) {
    assert.equal(parseAmount(input), null, String(input));
  }
});

test('formats like German money', () => {
  assert.equal(formatPlain(123456), '1.234,56');
  assert.equal(formatPlain(5), '0,05');
  assert.equal(formatMoney(290000), '2.900,00 €');
  assert.equal(formatMoney(-7510), '−75,10 €');
  assert.equal(formatMoney(100, { sign: true }), '+1,00 €');
  assert.equal(formatRound(123456), '1.235 €');
  assert.deepEqual(splitMoney(74510), { minus: false, euros: '745', cents: ',10' });
  assert.deepEqual(splitMoney(-123405), { minus: true, euros: '1.234', cents: ',05' });
  assert.equal(formatInput(1250), '12,50');
  assert.equal(formatInput(1200), '12');
  assert.equal(formatPercent(1, 3), '33 %');
  assert.equal(formatPercent(1, 1000), '<1 %');
  assert.equal(formatPercent(5, 0), '0 %');
});

test('every formatted amount parses back to itself', () => {
  for (const cents of [1, 99, 100, 1250, 74510, 123456, 99999999]) {
    assert.equal(parseAmount(formatPlain(cents)), cents);
    assert.equal(parseAmount(formatInput(cents)), cents);
  }
});
