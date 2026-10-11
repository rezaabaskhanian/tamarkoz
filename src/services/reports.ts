import { skipsBetween } from '../db/schedule';
import { sessionsBetween, type SessionWithSubject } from '../db/sessions';
import {
  addDays,
  jalaliMonthLength,
  jalaliToMs,
  startOfDay,
  startOfWeek,
} from '../utils/jalali';
import {
  bySubject,
  changePercent,
  completion,
  secondsPerDay,
  streak,
  sumAttempts,
  sumTests,
  totalSeconds,
  type SubjectShare,
} from './stats';

export type PeriodReport = {
  from: number;
  to: number;
  total: number;
  perDay: number[];
  subjects: SubjectShare[];
  prevTotal: number;
  change: number | null;
  completed: number;
  incomplete: number;
  skippedBlocks: number;
  attempts: number;
  tests: number;
  sessions: SessionWithSubject[];
};

async function periodReport(from: number, to: number, prevFrom: number): Promise<PeriodReport> {
  const [sessions, prev, skipped] = await Promise.all([
    sessionsBetween(from, to),
    sessionsBetween(prevFrom, from),
    skipsBetween(from, to),
  ]);
  const total = totalSeconds(sessions);
  const prevTotal = totalSeconds(prev);
  return {
    from,
    to,
    total,
    perDay: secondsPerDay(sessions, from, Math.max(1, Math.round((to - from) / 86_400_000))),
    subjects: bySubject(sessions),
    prevTotal,
    change: changePercent(total, prevTotal),
    ...completion(sessions),
    skippedBlocks: skipped,
    attempts: sumAttempts(sessions),
    tests: sumTests(sessions),
    sessions,
  };
}

/** F14: Saturday-to-Friday week. `offset` 0 = this week, -1 = last week … */
export function weeklyReport(offset: number, now = Date.now()) {
  const from = addDays(startOfWeek(now), offset * 7);
  return periodReport(from, addDays(from, 7), addDays(from, -7));
}

/** F26: a Jalali month. */
export async function monthlyReport(jy: number, jm: number) {
  const from = jalaliToMs({ jy, jm, jd: 1 });
  const next = jm === 12 ? { jy: jy + 1, jm: 1 } : { jy, jm: jm + 1 };
  const prev = jm === 1 ? { jy: jy - 1, jm: 12 } : { jy, jm: jm - 1 };
  const to = jalaliToMs({ ...next, jd: 1 });
  const report = await periodReport(from, to, jalaliToMs({ ...prev, jd: 1 }));
  return { ...report, days: jalaliMonthLength(jy, jm) };
}

/** Seconds per subject in each 7-day slice of a period (monthly per-subject trend). */
export function subjectTrend(report: PeriodReport) {
  const slices = Math.ceil(report.perDay.length / 7);
  const map = new Map<number, { name: string; color: string; weeks: number[] }>();
  for (const s of report.sessions) {
    const i = Math.min(
      slices - 1,
      Math.floor((startOfDay(s.started_at) - report.from) / (7 * 86_400_000)),
    );
    if (i < 0) continue;
    const cur = map.get(s.subject_id) ?? {
      name: s.subject_name,
      color: s.subject_color,
      weeks: new Array<number>(slices).fill(0),
    };
    cur.weeks[i] += s.actual_seconds;
    map.set(s.subject_id, cur);
  }
  return [...map.values()];
}

export async function todaySummary(now = Date.now()) {
  const from = startOfDay(now);
  const sessions = await sessionsBetween(from, addDays(from, 1));
  return { total: totalSeconds(sessions), subjects: bySubject(sessions) };
}

export async function goalStreak(goalMinutes: number, now = Date.now()) {
  if (goalMinutes <= 0) return { days: 0, todayMet: false };
  const from = addDays(startOfDay(now), -399);
  const sessions = await sessionsBetween(from, addDays(startOfDay(now), 1));
  return streak(sessions, goalMinutes, now);
}
