jest.mock('../src/native/NativeFocus', () => ({}));

import { SETTING_DEFAULTS } from '../src/db/settings';
import { buildReportPdf } from '../src/services/reportPdf';
import type { PeriodReport } from '../src/services/reports';

const from = new Date(2026, 9, 3).getTime(); // Saturday 11 Mehr 1405
const session = (day: number, sec: number, extra = {}) => ({
  id: day,
  subject_id: 1,
  subject_name: 'شیمی',
  subject_color: '#8B5CF6',
  mode: 'normal' as const,
  source: 'manual' as const,
  planned_minutes: 60,
  actual_seconds: sec,
  started_at: new Date(2026, 9, day, 10).getTime(),
  ended_at: null,
  end_reason: 'completed' as const,
  blocked_attempts: 0,
  tests_count: null,
  schedule_block_id: null,
  native_id: null,
  topic: null,
  kind: 'study' as const,
  activity: 'study',
  activity_name: null,
  ...extra,
});

const report: PeriodReport = {
  from,
  to: new Date(2026, 9, 10).getTime(),
  total: 9000,
  perDay: [3600, 0, 5400, 0, 0, 0, 0],
  subjects: [{ subjectId: 1, name: 'شیمی', color: '#8B5CF6', seconds: 9000 }],
  prevTotal: 6000,
  change: 50,
  completed: 1,
  incomplete: 0,
  skippedBlocks: 0,
  attempts: 2,
  tests: 0,
  sessions: [session(5, 5400, { source: 'manual_log' }), session(3, 3600)],
};

test('weekly PDF content is Persian and in chronological order', () => {
  const pdf = buildReportPdf(report, 'week', { ...SETTING_DEFAULTS, field: 'tajrobi' });
  expect(pdf.title).toBe('گزارش هفتگی مطالعه');
  expect(pdf.field).toBe('رشته: تجربی');
  expect(pdf.summary[0]).toEqual({ label: 'مجموع مطالعه', value: '۲ ساعت و ۳۰ دقیقه' });
  expect(pdf.summary[1].value).toBe('▲ ۵۰٪');
  expect(pdf.summary[3].value).toBe('۲ از ۷ روز');
  expect(pdf.days[0]).toEqual({ label: 'شنبه ۱۱ مهر', minutes: 60, text: '۱ ساعت' });
  expect(pdf.days[1].text).toBe('—');
  expect(pdf.sessions.map(x => x.note)).toEqual(['', 'دستی']);
  expect(pdf.fileName).toBe('tamarkoz-week-2026-10-03.pdf');
});
