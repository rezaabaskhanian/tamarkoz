import { query } from '../db';
import { listSubjects, type Subject } from '../db/subjects';
import type { SessionKind } from '../db/topics';
import { startOfWeek } from '../utils/jalali';

// Per-subject overview for the «درس‌ها» tab: time this week / all time, last studied,
// study-practice-test split and the most studied chapters/topics.

export type SubjectOverview = Subject & {
  totalSec: number;
  weekSec: number;
  lastAt: number;
  tests: number;
  kinds: Record<SessionKind, number>;
  topics: { name: string; sec: number; sessions: number }[];
};

export async function subjectOverview(now = Date.now()): Promise<SubjectOverview[]> {
  const weekStart = startOfWeek(now);
  const [subjects, totals, kinds, topics] = await Promise.all([
    listSubjects(),
    query<{ subject_id: number; total: number; week: number; last: number; tests: number }>(
      `SELECT subject_id,
              SUM(actual_seconds) AS total,
              SUM(CASE WHEN started_at >= ? THEN actual_seconds ELSE 0 END) AS week,
              MAX(started_at) AS last,
              SUM(COALESCE(tests_count, 0)) AS tests
       FROM sessions GROUP BY subject_id`,
      [weekStart],
    ),
    query<{ subject_id: number; kind: SessionKind; sec: number }>(
      'SELECT subject_id, kind, SUM(actual_seconds) AS sec FROM sessions GROUP BY subject_id, kind',
    ),
    query<{ subject_id: number; topic: string; sec: number; n: number }>(
      `SELECT subject_id, topic, SUM(actual_seconds) AS sec, COUNT(*) AS n
       FROM sessions WHERE topic IS NOT NULL AND topic <> ''
       GROUP BY subject_id, topic ORDER BY sec DESC`,
    ),
  ]);

  return subjects.map(s => {
    const t = totals.find(x => x.subject_id === s.id);
    const k: Record<SessionKind, number> = { study: 0, practice: 0, test: 0 };
    for (const row of kinds) if (row.subject_id === s.id) k[row.kind] = row.sec;
    return {
      ...s,
      totalSec: t?.total ?? 0,
      weekSec: t?.week ?? 0,
      lastAt: t?.last ?? 0,
      tests: t?.tests ?? 0,
      kinds: k,
      topics: topics
        .filter(x => x.subject_id === s.id)
        .slice(0, 5)
        .map(x => ({ name: x.topic, sec: x.sec, sessions: x.n })),
    };
  });
}
