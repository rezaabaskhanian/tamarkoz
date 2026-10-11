import { focus } from '../native/focus';
import { FIELDS } from '../db/subjects';
import type { Settings } from '../db/settings';
import { formatDurationFa, toFaDigits } from '../utils/digits';
import {
  addDays,
  dayKey,
  daysBetween,
  formatJalaliDate,
  formatJalaliDateWithWeekday,
  formatJalaliDayMonth,
  JALALI_MONTHS,
  toJalali,
  weekdayIndex,
  WEEKDAYS,
} from '../utils/jalali';
import type { PeriodReport } from './reports';

// Counselor PDF: turns a weekly/monthly report into the JSON that ReportPdf.kt lays out.
// Everything is formatted here (Persian digits, Jalali dates) so the native side only draws.

const minutes = (sec: number) => Math.round(sec / 60);

export function buildReportPdf(r: PeriodReport, kind: 'week' | 'month', settings: Settings) {
  const days = r.perDay.length;
  const studiedDays = r.perDay.filter(x => x >= 60).length;
  const field = FIELDS.find(f => f.id === settings.field)?.label;
  const exam = Number(settings.exam_date) || 0;
  const left = exam ? daysBetween(Date.now(), exam) : -1;
  const { jy, jm } = toJalali(r.from);

  const period =
    kind === 'week'
      ? `${formatJalaliDate(r.from)} تا ${formatJalaliDate(addDays(r.to, -1))}`
      : `${JALALI_MONTHS[jm - 1]} ${toFaDigits(jy)}`;

  const change =
    r.change == null ? '—' : `${r.change >= 0 ? '▲' : '▼'} ${toFaDigits(Math.abs(r.change))}٪`;

  return {
    title: kind === 'week' ? 'گزارش هفتگی مطالعه' : 'گزارش ماهانه‌ی مطالعه',
    period,
    field: field ? `رشته: ${field}` : '',
    examLine: left >= 0 ? `${toFaDigits(left)} روز تا کنکور` : '',
    summary: [
      { label: 'مجموع مطالعه', value: formatDurationFa(minutes(r.total)) },
      { label: kind === 'week' ? 'نسبت به هفته‌ی قبل' : 'نسبت به ماه قبل', value: change },
      { label: 'میانگین روزانه', value: formatDurationFa(minutes(r.total / days)) },
      { label: 'روزهای مطالعه', value: `${toFaDigits(studiedDays)} از ${toFaDigits(days)} روز` },
      { label: 'جلسه‌ی کامل', value: toFaDigits(r.completed) },
      { label: 'جلسه‌ی ناتمام', value: toFaDigits(r.incomplete) },
      { label: 'نوبت ردشده‌ی برنامه', value: toFaDigits(r.skippedBlocks) },
      { label: 'باز کردن اپ ممنوع', value: `${toFaDigits(r.attempts)} بار` },
      { label: 'تست', value: toFaDigits(r.tests) },
    ],
    daysTitle: 'مطالعه‌ی هر روز',
    days: r.perDay.map((sec, i) => {
      const day = addDays(r.from, i);
      return {
        label:
          kind === 'week'
            ? `${WEEKDAYS[weekdayIndex(day)]} ${formatJalaliDayMonth(day)}`
            : formatJalaliDayMonth(day),
        minutes: minutes(sec),
        text: sec >= 60 ? formatDurationFa(minutes(sec)) : '—',
      };
    }),
    subjects: r.subjects.map(s => ({
      name: s.name,
      color: s.color,
      share: r.total ? s.seconds / r.total : 0,
      text: `${formatDurationFa(minutes(s.seconds))} · ${toFaDigits(
        Math.round((s.seconds / (r.total || 1)) * 100),
      )}٪`,
    })),
    sessions: [...r.sessions]
      .sort((a, b) => a.started_at - b.started_at)
      .map(x => ({
        date: formatJalaliDayMonth(x.started_at),
        subject: x.subject_name + (x.tests_count ? ` · ${toFaDigits(x.tests_count)} تست` : ''),
        duration: formatDurationFa(minutes(x.actual_seconds)),
        note:
          x.source === 'manual_log'
            ? 'دستی'
            : x.end_reason && x.end_reason !== 'completed'
              ? 'ناتمام'
              : x.mode === 'strict'
                ? 'حالت سخت'
                : '',
      })),
    note:
      'ساعت‌های این گزارش هنگام قفل بودن گوشی به‌طور خودکار ثبت شده‌اند. جلسه‌های «دستی» را دانش‌آموز خودش وارد کرده است. ' +
      `تاریخ تهیه: ${formatJalaliDateWithWeekday(Date.now())}.`,
    footer: 'ساخته‌شده با اپ تمرکز',
    fileName: `tamarkoz-${kind === 'week' ? 'week' : 'month'}-${dayKey(r.from)}.pdf`,
  };
}

export function shareReportPdf(r: PeriodReport, kind: 'week' | 'month', settings: Settings) {
  return focus.shareReportPdf(buildReportPdf(r, kind, settings));
}
