import { query, run } from '.';

// Key/value settings table. Values are strings; typed accessors live in useSettings().
export const SETTING_DEFAULTS = {
  exam_date: '', // epoch ms of the exam day, '' = not set
  exam_countdown_hidden: '0',
  field: '', // riazi | tajrobi | ensani | honar | zaban | other
  daily_goal_minutes: '0', // 0 = no goal (F20)
  block_system_settings_in_strict: '1',
  emergency_used_on: '', // yyyy-MM-dd
  daily_reminder_enabled: '0', // «امروز وقت تمرین است»; off by default, user turns it on in settings
  daily_reminder_time: '1020', // minute of day (17:00)
  schedule_enabled: '1',
  notif_schedule_reminder: '1',
  notif_expiry: '1',
  finish_sound: '1',
  onboarding_done: '0',
  strict_intro_seen: '0',
  last_subject_id: '',
  last_duration: '45',
  last_kind: 'study', // study | practice | test
  pomodoro_work: '25',
  pomodoro_break: '5',
  theme: 'system', // system | light | dark (F23)
  motivation: '', // «چرا درس می‌خوانم؟» — shown on home and the lock screen
};

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;

export async function loadSettings(): Promise<Settings> {
  const rows = await query<{ key: string; value: string | null }>(
    'SELECT key, value FROM settings',
  );
  const out: Settings = { ...SETTING_DEFAULTS };
  for (const r of rows) {
    if (r.key in out) out[r.key as SettingKey] = r.value ?? '';
  }
  return out;
}

export async function saveSetting(key: SettingKey, value: string) {
  await run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}
