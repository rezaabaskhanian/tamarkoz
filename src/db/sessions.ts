import { getDb, query, run } from '.';
import type { FinishedSession, PendingSkip } from '../native/focus';

export type EndReason = 'completed' | 'ended_early' | 'emergency' | 'broken';
export type SessionSource = 'manual' | 'schedule' | 'manual_log';

export type SessionRow = {
  id: number;
  subject_id: number | null; // null for non-study activities
  mode: 'normal' | 'strict';
  source: SessionSource;
  planned_minutes: number | null;
  actual_seconds: number;
  started_at: number;
  ended_at: number | null;
  end_reason: EndReason | null;
  blocked_attempts: number;
  tests_count: number | null;
  schedule_block_id: number | null;
  native_id: string | null;
  topic: string | null;
  kind: 'study' | 'practice' | 'test';
  activity: string;
  activity_name: string | null;
};

/** A study session joined with its subject (sessionsBetween inner-joins, so never another activity). */
export type SessionWithSubject = Omit<SessionRow, 'subject_id'> & {
  subject_id: number;
  subject_name: string;
  subject_color: string;
};

/** Any session, subject optional (other activities have none). */
export type SessionMaybeSubject = SessionRow & { subject_name: string | null; subject_color: string | null };

/**
 * Copies sessions and schedule skips finished by the native side into SQLite.
 * Idempotent thanks to sessions.native_id; native data is acknowledged afterwards.
 */
export async function importFinished(sessions: FinishedSession[], skips: PendingSkip[]) {
  const doneIds: string[] = [];
  const doneSkips: string[] = [];
  await getDb().transaction(async tx => {
    for (const s of sessions) {
      const activity = s.activity || 'study';
      if (activity !== 'study') {
        await tx.execute(
          `INSERT OR IGNORE INTO sessions
            (subject_id, mode, source, planned_minutes, actual_seconds, started_at, ended_at,
             end_reason, blocked_attempts, native_id, activity, activity_name)
           VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.mode,
            s.source,
            s.plannedMinutes,
            s.actualSeconds,
            s.startedAt,
            s.endedAt,
            s.endReason,
            s.blockedAttempts,
            s.nativeId,
            activity,
            s.activityName || null,
          ],
        );
        doneIds.push(s.nativeId);
        continue;
      }
      let subjectId = s.subjectId;
      const name = s.subjectName || 'بدون درس';
      if (subjectId > 0) {
        // The subject may have been deleted while the session was running.
        await tx.execute(
          "INSERT OR IGNORE INTO subjects (id, name, color, sort_order, archived) VALUES (?, ?, '#8A90A6', 999, 1)",
          [subjectId, name],
        );
      } else {
        // Scheduled block without a subject and no subjects at all.
        const r = await tx.execute('SELECT id FROM subjects WHERE name = ? ORDER BY id LIMIT 1', [
          name,
        ]);
        if (r.rows.length) {
          subjectId = Number(r.rows[0].id);
        } else {
          const ins = await tx.execute(
            "INSERT INTO subjects (name, color, sort_order, archived) VALUES (?, '#8A90A6', 999, 0)",
            [name],
          );
          subjectId = ins.insertId!;
        }
      }
      const block = s.scheduleBlockId
        ? await tx.execute('SELECT id FROM schedule_blocks WHERE id = ?', [s.scheduleBlockId])
        : null;
      await tx.execute(
        `INSERT OR IGNORE INTO sessions
          (subject_id, mode, source, planned_minutes, actual_seconds, started_at, ended_at,
           end_reason, blocked_attempts, schedule_block_id, native_id, topic, kind)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          subjectId,
          s.mode,
          s.source,
          s.plannedMinutes,
          s.actualSeconds,
          s.startedAt,
          s.endedAt,
          s.endReason,
          s.blockedAttempts,
          block && block.rows.length ? s.scheduleBlockId : null,
          s.nativeId,
          s.topic || null,
          s.kind ?? 'study',
        ],
      );
      doneIds.push(s.nativeId);
    }
    for (const k of skips) {
      const block = await tx.execute('SELECT id FROM schedule_blocks WHERE id = ?', [k.blockId]);
      if (block.rows.length) {
        await tx.execute(
          'INSERT OR IGNORE INTO schedule_skips (block_id, date, reason) VALUES (?, ?, ?)',
          [k.blockId, k.date, k.reason],
        );
      }
      doneSkips.push(k.key);
    }
  });
  return { doneIds, doneSkips };
}

export async function getSessionByNativeId(nativeId: string) {
  const rows = await query<SessionMaybeSubject>(
    `SELECT s.*, sub.name AS subject_name, sub.color AS subject_color
     FROM sessions s LEFT JOIN subjects sub ON sub.id = s.subject_id WHERE s.native_id = ?`,
    [nativeId],
  );
  return rows[0] ?? null;
}

export async function setTestsCount(sessionId: number, count: number | null) {
  await run('UPDATE sessions SET tests_count = ? WHERE id = ?', [count, sessionId]);
}

/** F19: a study period without the phone. Counted on the given day, shown as «دستی». */
export async function addManualLog(
  subjectId: number,
  dayStart: number,
  minutes: number,
  topic = '',
  kind: 'study' | 'practice' | 'test' = 'study',
) {
  const startedAt = dayStart + 12 * 60 * 60 * 1000; // midday, safely inside the day
  await run(
    `INSERT INTO sessions (subject_id, mode, source, planned_minutes, actual_seconds,
       started_at, ended_at, end_reason, blocked_attempts, topic, kind)
     VALUES (?, 'normal', 'manual_log', ?, ?, ?, ?, 'completed', 0, ?, ?)`,
    [subjectId, minutes, minutes * 60, startedAt, startedAt + minutes * 60_000, topic || null, kind],
  );
}

export async function deleteSession(id: number) {
  await run('DELETE FROM sessions WHERE id = ?', [id]);
}

export function sessionsBetween(from: number, to: number) {
  return query<SessionWithSubject>(
    `SELECT s.*, sub.name AS subject_name, sub.color AS subject_color
     FROM sessions s JOIN subjects sub ON sub.id = s.subject_id
     WHERE s.started_at >= ? AND s.started_at < ?
     ORDER BY s.started_at DESC`,
    [from, to],
  );
}

/** Non-study activities in a period, for the report's «حالت‌های دیگر» section. */
export function activitiesBetween(from: number, to: number) {
  return query<{ activity: string; activity_name: string | null; sec: number; n: number }>(
    `SELECT activity, MAX(activity_name) AS activity_name, SUM(actual_seconds) AS sec, COUNT(*) AS n
     FROM sessions WHERE activity <> 'study' AND started_at >= ? AND started_at < ?
     GROUP BY activity ORDER BY sec DESC`,
    [from, to],
  );
}
