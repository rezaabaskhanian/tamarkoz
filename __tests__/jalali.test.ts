import {
  daysBetween,
  formatJalaliDate,
  formatJalaliDateWithWeekday,
  jalaliToMs,
  startOfWeek,
  toJalali,
  weekdayIndex,
} from '../src/utils/jalali';

// Wednesday 7 October 2026 = 15 Mehr 1405, local time.
const WED = new Date(2026, 9, 7, 15, 30).getTime();

test('toJalali / jalaliToMs round trip', () => {
  expect(toJalali(WED)).toEqual({ jy: 1405, jm: 7, jd: 15 });
  expect(jalaliToMs({ jy: 1405, jm: 7, jd: 15 })).toBe(
    new Date(2026, 9, 7).getTime(),
  );
  expect(toJalali(jalaliToMs({ jy: 1405, jm: 1, jd: 1 }))).toEqual({
    jy: 1405,
    jm: 1,
    jd: 1,
  });
});

test('weeks start on Saturday', () => {
  expect(weekdayIndex(WED)).toBe(4);
  expect(weekdayIndex(new Date(2026, 9, 3).getTime())).toBe(0); // Saturday
  expect(weekdayIndex(new Date(2026, 9, 9).getTime())).toBe(6); // Friday
  expect(startOfWeek(WED)).toBe(new Date(2026, 9, 3).getTime());
  expect(startOfWeek(new Date(2026, 9, 3, 0, 0).getTime())).toBe(
    new Date(2026, 9, 3).getTime(),
  );
});

test('formatting', () => {
  expect(formatJalaliDate(WED)).toBe('۱۵ مهر ۱۴۰۵');
  expect(formatJalaliDateWithWeekday(WED)).toBe('چهارشنبه ۱۵ مهر ۱۴۰۵');
});

test('daysBetween counts calendar days', () => {
  expect(daysBetween(WED, new Date(2026, 9, 8, 0, 1).getTime())).toBe(1);
  expect(daysBetween(WED, WED)).toBe(0);
});
