import { jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js';
import { pad2Fa, toFaDigits } from './digits';

// All timestamps in the app are epoch milliseconds; conversion to the Jalali
// calendar happens only for display, using the phone's local time zone.

export type JalaliDate = { jy: number; jm: number; jd: number };

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

/** Index 0 is Saturday, matching schedule_blocks.weekday. */
export const WEEKDAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function toJalali(ms: number): JalaliDate {
  const d = new Date(ms);
  return toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Local midnight of the given Jalali date, in epoch ms. */
export function jalaliToMs({ jy, jm, jd }: JalaliDate): number {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd).getTime();
}

/** Weekday with Saturday = 0 … Friday = 6. */
export function weekdayIndex(ms: number): number {
  return (new Date(ms).getDay() + 1) % 7;
}

/** Local midnight of the day containing `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Local midnight of the Saturday that starts the week containing `ms`. */
export function startOfWeek(ms: number): number {
  const d = new Date(ms);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - weekdayIndex(ms),
  ).getTime();
}

/** Whole calendar days from the day of `fromMs` to the day of `toMs` (DST-safe). */
export function daysBetween(fromMs: number, toMs: number): number {
  return Math.round((startOfDay(toMs) - startOfDay(fromMs)) / DAY_MS);
}

/** e.g. «۱۵ مهر ۱۴۰۵» */
export function formatJalaliDate(ms: number): string {
  const { jy, jm, jd } = toJalali(ms);
  return `${toFaDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toFaDigits(jy)}`;
}

/** e.g. «چهارشنبه ۱۵ مهر ۱۴۰۵» */
export function formatJalaliDateWithWeekday(ms: number): string {
  return `${WEEKDAYS[weekdayIndex(ms)]} ${formatJalaliDate(ms)}`;
}

/** Same clock time, `n` calendar days later (DST-safe). */
export function addDays(ms: number, n: number): number {
  const d = new Date(ms);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + n,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  ).getTime();
}

/** Local calendar day as "yyyy-MM-dd" (same format the native side uses). */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  return jalaaliMonthLength(jy, jm);
}

/** Minute of day → «۱۶:۰۵». */
export function formatMinuteOfDay(minute: number): string {
  return `${pad2Fa(Math.floor(minute / 60))}:${pad2Fa(minute % 60)}`;
}

/** Epoch ms → «۱۶:۰۵» in local time. */
export function formatTimeOfDay(ms: number): string {
  const d = new Date(ms);
  return formatMinuteOfDay(d.getHours() * 60 + d.getMinutes());
}

/** «۱۵ مهر» */
export function formatJalaliDayMonth(ms: number): string {
  const { jm, jd } = toJalali(ms);
  return `${toFaDigits(jd)} ${JALALI_MONTHS[jm - 1]}`;
}
