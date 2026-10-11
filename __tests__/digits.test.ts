import {
  formatClockFa,
  formatDurationFa,
  toEnDigits,
  toFaDigits,
} from '../src/utils/digits';

test('toFaDigits converts Latin and Arabic-Indic digits', () => {
  expect(toFaDigits(1405)).toBe('۱۴۰۵');
  expect(toFaDigits('12:30')).toBe('۱۲:۳۰');
  expect(toFaDigits('٤٥')).toBe('۴۵');
});

test('toEnDigits reverses Persian digits', () => {
  expect(toEnDigits('۱۲۰')).toBe('120');
  expect(toEnDigits('٤٥')).toBe('45');
});

test('formatDurationFa', () => {
  expect(formatDurationFa(45)).toBe('۴۵ دقیقه');
  expect(formatDurationFa(120)).toBe('۲ ساعت');
  expect(formatDurationFa(135)).toBe('۲ ساعت و ۱۵ دقیقه');
  expect(formatDurationFa(-3)).toBe('۰ دقیقه');
});

test('formatClockFa', () => {
  expect(formatClockFa(125)).toBe('۰۲:۰۵');
  expect(formatClockFa(3725)).toBe('۱:۰۲:۰۵');
});
