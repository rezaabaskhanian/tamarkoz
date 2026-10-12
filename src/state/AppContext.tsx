import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { FREE_BLOCKED_APPS_LIMIT } from '../config';
import { listBlockedApps, type BlockedApp } from '../db/blockedApps';
import { listEntitlements, premiumUntil, type Entitlement } from '../db/entitlement';
import { deleteExpiredBlocks, listBlocks } from '../db/schedule';
import { importFinished } from '../db/sessions';
import { loadSettings, saveSetting, SETTING_DEFAULTS, type SettingKey, type Settings } from '../db/settings';
import { listSubjects, type Subject } from '../db/subjects';
import {
  focus,
  type ActiveSession,
  type FinishedSession,
  type PermissionStatus,
} from '../native/focus';
import { access as computeAccess, trialEnd, type Access } from '../services/entitlement';
import { restorePurchases } from '../services/purchases';
import { todaySummary } from '../services/reports';
import { dayKey } from '../utils/jalali';

type AppCtx = {
  ready: boolean;
  settings: Settings;
  subjects: Subject[];
  blockedApps: BlockedApp[];
  entitlements: Entitlement[];
  premiumUntil: number;
  isPremium: boolean;
  /** Purchase vs. 7-day free trial details for the purchase and settings screens. */
  access: Access;
  active: ActiveSession | null;
  permissions: PermissionStatus | null;
  /** Increments whenever study data changes, so screens can reload their queries. */
  dataVersion: number;
  /** The session that just ended while the app was open (drives the summary screen). */
  justEnded: FinishedSession | null;
  clearJustEnded: () => void;
  setSetting: (key: SettingKey, value: string) => Promise<void>;
  reloadSubjects: () => Promise<void>;
  reloadBlockedApps: () => Promise<void>;
  reloadEntitlements: () => Promise<void>;
  reloadSchedule: () => Promise<void>;
  refreshActive: () => Promise<ActiveSession | null>;
  refreshPermissions: () => Promise<PermissionStatus>;
  bumpData: () => void;
  reloadAll: () => Promise<void>;
};

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>({ ...SETTING_DEFAULTS });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blockedApps, setBlockedApps] = useState<BlockedApp[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [justEnded, setJustEnded] = useState<FinishedSession | null>(null);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [trialEndsAt, setTrialEndsAt] = useState(0);

  // Premium = a valid purchase or the free trial (dataVersion also ticks on app resume,
  // so an expiry is noticed without restarting).
  const acc = useMemo(
    () => computeAccess(premiumUntil(entitlements), trialEndsAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entitlements, trialEndsAt, dataVersion],
  );
  const until = acc.until;
  const isPremium = acc.premium;

  const bumpData = useCallback(() => setDataVersion(v => v + 1), []);

  const reloadSubjects = useCallback(async () => setSubjects(await listSubjects()), []);
  const reloadBlockedApps = useCallback(async () => setBlockedApps(await listBlockedApps()), []);
  const reloadEntitlements = useCallback(async () => setEntitlements(await listEntitlements()), []);
  const reloadSchedule = useCallback(async () => {
    setScheduleVersion(v => v + 1);
    bumpData();
  }, [bumpData]);

  const refreshActive = useCallback(async () => {
    const s = await focus.active();
    setActive(s);
    return s;
  }, []);

  const refreshPermissions = useCallback(async () => {
    const p = await focus.permissions();
    setPermissions(p);
    return p;
  }, []);

  const setSetting = useCallback(async (key: SettingKey, value: string) => {
    await saveSetting(key, value);
    setSettings(s => ({ ...s, [key]: value }));
  }, []);

  /** Copies sessions finished natively (possibly while the app was closed) into SQLite. */
  const drain = useCallback(async () => {
    const p = await focus.pending();
    if (p.emergencyUsedOn) {
      await saveSetting('emergency_used_on', p.emergencyUsedOn);
      setSettings(s => ({ ...s, emergency_used_on: p.emergencyUsedOn! }));
    }
    if (p.sessions.length === 0 && p.skips.length === 0) return;
    const { doneIds, doneSkips } = await importFinished(p.sessions, p.skips);
    focus.ack(doneIds, doneSkips);
    bumpData();
  }, [bumpData]);

  const reloadAll = useCallback(async () => {
    await deleteExpiredBlocks().catch(() => 0); // finished study marathons
    const [st, sub, apps, ent] = await Promise.all([
      loadSettings(),
      listSubjects(),
      listBlockedApps(),
      listEntitlements(),
    ]);
    setSettings(st);
    setSubjects(sub);
    setBlockedApps(apps);
    setEntitlements(ent);
    bumpData();
    setScheduleVersion(v => v + 1);
  }, [bumpData]);

  // Initial load.
  useEffect(() => {
    (async () => {
      focus
        .deviceInfo()
        .then(d => setTrialEndsAt(trialEnd(d.firstInstallTime)))
        .catch(() => {});
      await reloadAll();
      try {
        await drain();
        await Promise.all([refreshActive(), refreshPermissions()]);
      } finally {
        setReady(true);
      }
      // Purchases are re-checked on every launch; failures keep what we already have.
      restorePurchases()
        .then(r => (r.ok ? reloadEntitlements() : undefined))
        .catch(() => {});
    })();
  }, [reloadAll, drain, refreshActive, refreshPermissions, reloadEntitlements]);

  // Native events.
  useEffect(() => {
    const a = focus.onChanged(s => setActive(s));
    const b = focus.onEnded(async s => {
      setActive(null);
      await drain();
      if (AppState.currentState === 'active') setJustEnded(s);
    });
    return () => {
      a.remove();
      b.remove();
    };
  }, [drain]);

  // Returning to the app: permissions may have changed in Settings, sessions may have ended.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      drain().catch(() => {});
      refreshActive().catch(() => {});
      refreshPermissions().catch(() => {});
      bumpData(); // the day may have changed
    });
    return () => sub.remove();
  }, [drain, refreshActive, refreshPermissions, bumpData]);

  // Push everything the native side needs (scheduled sessions, reminders, widget).
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        const [blocks, today] = await Promise.all([listBlocks(), todaySummary()]);
        const now = Date.now();
        const lastSubject =
          subjects.find(s => String(s.id) === settings.last_subject_id) ?? subjects[0];
        const premium = acc.premium;
        focus.syncConfig({
          // Free users keep their list, but only the first three apps are enforced.
          blockedApps: blockedApps
            .slice(0, premium ? undefined : FREE_BLOCKED_APPS_LIMIT)
            .map(a => a.package_name),
          scheduleEnabled: settings.schedule_enabled === '1',
          blocks: blocks.map(b => ({
            id: b.id,
            weekday: b.weekday,
            startMinute: b.start_minute,
            durationMinutes: b.duration_minutes,
            subjectId: b.subject_id ?? -1,
            subjectName: b.subject_name ?? '',
            mode: b.mode,
            enabled: b.enabled === 1,
            activity: b.activity,
            activityName: b.activity_name ?? '',
            expiresAt: b.expires_at ?? 0,
          })),
          premiumUntil: acc.until,
          blockSystemSettingsInStrict: settings.block_system_settings_in_strict === '1',
          defaultSubjectId: lastSubject?.id ?? -1,
          defaultSubjectName: lastSubject?.name ?? '',
          finishSound: settings.finish_sound === '1',
          scheduleReminder: settings.notif_schedule_reminder === '1',
          dailyReminder: settings.daily_reminder_enabled === '1',
          dailyReminderMinute: Number(settings.daily_reminder_time) || 1020,
          expiryReminder: settings.notif_expiry === '1',
          // Reminder before access ends: 3 days before a purchase expires, 1 day before the trial does.
          expiryReminderAt: acc.premium
            ? acc.until - (acc.source === 'trial' ? 1 : 3) * 86_400_000
            : 0,
          examDate: Number(settings.exam_date) || 0,
          todayKey: dayKey(now),
          todayMinutes: Math.floor(today.total / 60),
          darkTheme: settings.theme === 'dark',
          motivation: settings.motivation.trim(),
        });
      } catch {
        // retried on the next change
      }
    }, 300);
  }, [ready, settings, subjects, blockedApps, acc, dataVersion, scheduleVersion]);

  const value = useMemo<AppCtx>(
    () => ({
      ready,
      settings,
      subjects,
      blockedApps,
      entitlements,
      premiumUntil: until,
      isPremium,
      access: acc,
      active,
      permissions,
      dataVersion,
      justEnded,
      clearJustEnded: () => setJustEnded(null),
      setSetting,
      reloadSubjects,
      reloadBlockedApps,
      reloadEntitlements,
      reloadSchedule,
      refreshActive,
      refreshPermissions,
      bumpData,
      reloadAll,
    }),
    [
      ready,
      settings,
      subjects,
      blockedApps,
      entitlements,
      until,
      isPremium,
      acc,
      active,
      permissions,
      dataVersion,
      justEnded,
      setSetting,
      reloadSubjects,
      reloadBlockedApps,
      reloadEntitlements,
      reloadSchedule,
      refreshActive,
      refreshPermissions,
      bumpData,
      reloadAll,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Required permissions for a session: usage access and overlay. */
export function hasRequiredPermissions(p: PermissionStatus | null) {
  return Boolean(p?.usage && p?.overlay);
}
