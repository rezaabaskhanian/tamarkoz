import { addDays, daysBetween, startOfDay } from '../utils/jalali';

// Pure aggregation helpers over session rows (unit-tested). A session counts entirely
// for the day it started on, even if it runs past midnight.

export type StatSession = {
  subject_id: number;
  subject_name: string;
  subject_color: string;
  actual_seconds: number;
  started_at: number;
  end_reason: string | null;
  source: string;
  blocked_attempts: number;
  tests_count: number | null;
};

export type SubjectShare = { subjectId: number; name: string; color: string; seconds: number };

export function totalSeconds(sessions: StatSession[]): number {
  return sessions.reduce((sum, s) => sum + s.actual_seconds, 0);
}

/** Seconds per day for `days` days starting at local midnight `from`. */
export function secondsPerDay(sessions: StatSession[], from: number, days: number): number[] {
  const out = new Array<number>(days).fill(0);
  for (const s of sessions) {
    const i = daysBetween(from, s.started_at);
    if (i >= 0 && i < days) out[i] += s.actual_seconds;
  }
  return out;
}

export function bySubject(sessions: StatSession[]): SubjectShare[] {
  const map = new Map<number, SubjectShare>();
  for (const s of sessions) {
    const cur = map.get(s.subject_id) ?? {
      subjectId: s.subject_id,
      name: s.subject_name,
      color: s.subject_color,
      seconds: 0,
    };
    cur.seconds += s.actual_seconds;
    map.set(s.subject_id, cur);
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds);
}

/** Completed vs. not completed timed sessions (manual logs are excluded). */
export function completion(sessions: StatSession[]) {
  let completed = 0;
  let incomplete = 0;
  for (const s of sessions) {
    if (s.source === 'manual_log') continue;
    if (s.end_reason === 'completed') completed++;
    else incomplete++;
  }
  return { completed, incomplete };
}

export function sumAttempts(sessions: StatSession[]) {
  return sessions.reduce((sum, s) => sum + (s.blocked_attempts || 0), 0);
}

export function sumTests(sessions: StatSession[]) {
  return sessions.reduce((sum, s) => sum + (s.tests_count || 0), 0);
}

/**
 * Consecutive days that reached the goal (F20). Today counts if already reached;
 * otherwise the streak is still alive from yesterday.
 */
export function streak(
  sessions: StatSession[],
  goalMinutes: number,
  now: number,
  maxDays = 400,
): { days: number; todayMet: boolean } {
  if (goalMinutes <= 0) return { days: 0, todayMet: false };
  const today = startOfDay(now);
  const from = addDays(today, -(maxDays - 1));
  const perDay = secondsPerDay(sessions, from, maxDays);
  const goal = goalMinutes * 60;
  const todayMet = perDay[maxDays - 1] >= goal;
  let i = todayMet ? maxDays - 1 : maxDays - 2;
  let days = 0;
  while (i >= 0 && perDay[i] >= goal) {
    days++;
    i--;
  }
  return { days, todayMet };
}

/** Percent change vs. previous period, or null when there is nothing to compare with. */
export function changePercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
