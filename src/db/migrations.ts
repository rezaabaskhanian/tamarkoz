// Each entry upgrades the schema by one version; PRAGMA user_version stores the
// current version. Never edit a shipped migration — append a new one instead.
//
// Conventions:
// - Times are epoch milliseconds (INTEGER), converted to Jalali only for display.
// - A session belongs to the day of started_at, even if it runs past midnight.
// - Booleans are INTEGER 0/1.

export const MIGRATIONS: string[][] = [
  // v1 — initial schema (data model of the spec, including fields for later features).
  [
    `CREATE TABLE subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
    )`,

    `CREATE TABLE schedule_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
      duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
      subject_id INTEGER REFERENCES subjects(id),
      mode TEXT NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal', 'strict')),
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
    )`,

    `CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id),
      mode TEXT NOT NULL CHECK (mode IN ('normal', 'strict')),
      source TEXT NOT NULL CHECK (source IN ('manual', 'schedule', 'manual_log')),
      planned_minutes INTEGER,
      actual_seconds INTEGER NOT NULL DEFAULT 0 CHECK (actual_seconds >= 0),
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      end_reason TEXT CHECK (end_reason IN ('completed', 'ended_early', 'emergency', 'broken')),
      blocked_attempts INTEGER NOT NULL DEFAULT 0,
      tests_count INTEGER,
      schedule_block_id INTEGER REFERENCES schedule_blocks(id) ON DELETE SET NULL
    )`,
    'CREATE INDEX idx_sessions_started_at ON sessions(started_at)',
    'CREATE INDEX idx_sessions_subject ON sessions(subject_id)',

    `CREATE TABLE blocked_apps (
      package_name TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      added_at INTEGER NOT NULL
    )`,

    // date = local midnight (epoch ms) of the day the block was skipped or missed.
    `CREATE TABLE schedule_skips (
      block_id INTEGER NOT NULL REFERENCES schedule_blocks(id) ON DELETE CASCADE,
      date INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK (reason IN ('skipped', 'missed')),
      PRIMARY KEY (block_id, date)
    )`,

    `CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,

    `CREATE TABLE entitlement (
      product_id TEXT PRIMARY KEY,
      purchase_token TEXT NOT NULL,
      purchased_at INTEGER NOT NULL,
      expires_at INTEGER
    )`,
  ],

  // v2 — sessions finished by the native lock service are copied into SQLite later;
  // native_id makes that copy idempotent (INSERT OR IGNORE).
  [
    'ALTER TABLE sessions ADD COLUMN native_id TEXT',
    'CREATE UNIQUE INDEX idx_sessions_native_id ON sessions(native_id)',
    'CREATE INDEX idx_schedule_skips_date ON schedule_skips(date)',
  ],
];

export const SCHEMA_VERSION = MIGRATIONS.length;
