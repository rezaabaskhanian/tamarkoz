import {
  bySubject,
  changePercent,
  completion,
  secondsPerDay,
  streak,
  type StatSession,
} from '../src/services/stats';
import { findOverlap } from '../src/db/schedule';

const day = (d: number, h = 10) => new Date(2026, 9, d, h).getTime();

const s = (over: Partial<StatSession>): StatSession => ({
  subject_id: 1,
  subject_name: 'فیزیک',
  subject_color: '#000',
  actual_seconds: 3600,
  started_at: day(7),
  end_reason: 'completed',
  source: 'manual',
  blocked_attempts: 0,
  tests_count: null,
  ...over,
});

test('a session past midnight counts for its start day', () => {
  const sessions = [s({ started_at: day(7, 23), actual_seconds: 7200 })];
  expect(secondsPerDay(sessions, new Date(2026, 9, 3).getTime(), 7)).toEqual([
    0, 0, 0, 0, 7200, 0, 0,
  ]);
});

test('bySubject sorts by time', () => {
  const r = bySubject([
    s({ subject_id: 1, actual_seconds: 100 }),
    s({ subject_id: 2, subject_name: 'شیمی', actual_seconds: 500 }),
    s({ subject_id: 1, actual_seconds: 100 }),
  ]);
  expect(r.map(x => [x.subjectId, x.seconds])).toEqual([
    [2, 500],
    [1, 200],
  ]);
});

test('completion ignores manual logs', () => {
  expect(
    completion([
      s({}),
      s({ end_reason: 'ended_early' }),
      s({ end_reason: 'broken' }),
      s({ source: 'manual_log' }),
    ]),
  ).toEqual({ completed: 1, incomplete: 2 });
});

test('streak counts consecutive goal days', () => {
  const sessions = [
    s({ started_at: day(4), actual_seconds: 3600 }),
    s({ started_at: day(5), actual_seconds: 3600 }),
    s({ started_at: day(6), actual_seconds: 3600 }),
  ];
  // today (7th) not yet reached: streak alive from yesterday
  expect(streak(sessions, 60, day(7, 18))).toEqual({ days: 3, todayMet: false });
  expect(streak([...sessions, s({ started_at: day(7) })], 60, day(7, 18))).toEqual({
    days: 4,
    todayMet: true,
  });
  expect(streak(sessions, 120, day(7, 18)).days).toBe(0);
});

test('changePercent', () => {
  expect(changePercent(150, 100)).toBe(50);
  expect(changePercent(10, 0)).toBeNull();
});

test('schedule blocks may not overlap, including across Friday midnight', () => {
  const blocks = [
    { id: 1, weekday: 0, start_minute: 600, duration_minutes: 60, subject_id: null, mode: 'normal' as const, enabled: 1 },
    { id: 2, weekday: 6, start_minute: 1380, duration_minutes: 120, subject_id: null, mode: 'normal' as const, enabled: 1 },
  ];
  expect(findOverlap(blocks, { weekday: 0, start_minute: 630, duration_minutes: 30 })?.id).toBe(1);
  expect(findOverlap(blocks, { weekday: 0, start_minute: 660, duration_minutes: 30 })).toBeNull();
  // Friday 23:00 + 2h runs into Saturday 01:00
  expect(findOverlap(blocks, { weekday: 0, start_minute: 30, duration_minutes: 30 })?.id).toBe(2);
  // editing a block does not collide with itself
  expect(findOverlap(blocks, { weekday: 0, start_minute: 600, duration_minutes: 90 }, 1)).toBeNull();
});
