import { DeviceEventEmitter } from 'react-native';
import NativeFocus from './NativeFocus';

// Typed wrapper around the native lock core. JSON crosses the bridge; types live here.

export type PermissionStatus = {
  usage: boolean;
  overlay: boolean;
  notifications: boolean;
  battery: boolean;
  exactAlarm: boolean;
  notificationsRuntime: boolean;
  exactAlarmRuntime: boolean;
  manufacturer: string;
};

export type PermissionKind =
  | 'usage'
  | 'overlay'
  | 'notifications'
  | 'battery'
  | 'autostart'
  | 'exactAlarm';

export type InstalledApp = {
  packageName: string;
  label: string;
  icon: string;
  suggested: boolean;
};

export type SessionMode = 'normal' | 'strict';

export type ActiveSession = {
  id: string;
  state: 'RUNNING' | 'EMERGENCY_WAIT';
  mode: SessionMode;
  source: 'manual' | 'schedule';
  subjectId: number;
  subjectName: string;
  scheduleBlockId: number;
  startedAt: number;
  plannedMs: number;
  studiedMs: number;
  remainingMs: number;
  blocked: string[];
  blockedAttempts: number;
  workMs: number;
  breakMs: number;
  phase: 'work' | 'break';
  phaseRemainingMs: number;
  emergencyWaitMs: number;
};

export type FinishedSession = {
  nativeId: string;
  subjectId: number;
  subjectName: string;
  mode: SessionMode;
  source: 'manual' | 'schedule';
  plannedMinutes: number;
  actualSeconds: number;
  startedAt: number;
  endedAt: number;
  endReason: 'completed' | 'ended_early' | 'emergency' | 'broken';
  blockedAttempts: number;
  scheduleBlockId: number | null;
  recorded: boolean;
};

export type PendingSkip = {
  key: string;
  blockId: number;
  date: number;
  reason: 'skipped' | 'missed';
};

export type StartRequest = {
  subjectId: number;
  subjectName: string;
  mode: SessionMode;
  plannedMinutes: number;
  blocked: string[];
  source: 'manual';
  pomodoro?: { work: number; break: number };
};

export type StartError =
  | 'already_active'
  | 'missing_permissions'
  | 'no_apps'
  | 'invalid_duration';

export type Result<T = {}> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export type NativeConfig = {
  blockedApps: string[];
  scheduleEnabled: boolean;
  blocks: {
    id: number;
    weekday: number;
    startMinute: number;
    durationMinutes: number;
    subjectId: number;
    subjectName: string;
    mode: SessionMode;
    enabled: boolean;
  }[];
  premiumUntil: number;
  blockSystemSettingsInStrict: boolean;
  defaultSubjectId: number;
  defaultSubjectName: string;
  finishSound: boolean;
  scheduleReminder: boolean;
  dailyReminder: boolean;
  dailyReminderMinute: number;
  expiryReminder: boolean;
  expiryReminderAt: number;
  examDate: number;
  todayKey: string;
  todayMinutes: number;
  darkTheme: boolean;
};

const parse = <T>(s: string): T | null => (s ? (JSON.parse(s) as T) : null);

export const focus = {
  async permissions(): Promise<PermissionStatus> {
    return JSON.parse(await NativeFocus.getPermissionStatus());
  },
  openPermission(kind: PermissionKind) {
    NativeFocus.openPermissionSettings(kind);
  },
  async installedApps(): Promise<InstalledApp[]> {
    return JSON.parse(await NativeFocus.getInstalledApps());
  },
  async deviceInfo(): Promise<{ manufacturer: string; brand: string; sdk: number }> {
    return JSON.parse(await NativeFocus.getDeviceInfo());
  },
  syncConfig(config: NativeConfig) {
    NativeFocus.syncConfig(JSON.stringify(config));
  },
  async start(req: StartRequest): Promise<Result<{ session: ActiveSession }>> {
    return JSON.parse(await NativeFocus.startSession(JSON.stringify(req)));
  },
  async active(): Promise<ActiveSession | null> {
    return parse(await NativeFocus.getActiveSession());
  },
  async addMinutes(minutes: number): Promise<Result<{ session: ActiveSession }>> {
    return JSON.parse(await NativeFocus.addMinutes(minutes));
  },
  async endEarly(): Promise<Result> {
    return JSON.parse(await NativeFocus.endEarly());
  },
  async requestEmergency(): Promise<Result<{ session: ActiveSession }>> {
    return JSON.parse(await NativeFocus.requestEmergency());
  },
  async cancelEmergency(): Promise<Result<{ session: ActiveSession }>> {
    return JSON.parse(await NativeFocus.cancelEmergency());
  },
  async confirmEmergency(): Promise<Result> {
    return JSON.parse(await NativeFocus.confirmEmergency());
  },
  async emergencyStatus(): Promise<{ usedToday: boolean; releaseAt: number }> {
    return JSON.parse(await NativeFocus.getEmergencyStatus());
  },
  async addBlockedApps(packages: string[]): Promise<Result> {
    return JSON.parse(await NativeFocus.addBlockedApps(JSON.stringify(packages)));
  },
  async pending(): Promise<{
    sessions: FinishedSession[];
    skips: PendingSkip[];
    emergencyUsedOn: string | null;
  }> {
    return JSON.parse(await NativeFocus.getPending());
  },
  ack(nativeIds: string[], skipKeys: string[]) {
    NativeFocus.ackPending(JSON.stringify(nativeIds), JSON.stringify(skipKeys));
  },
  async lastFinished(): Promise<FinishedSession | null> {
    return parse(await NativeFocus.getLastFinished());
  },
  shareCard(card: { title: string; value: string; subtitle: string; detail: string }) {
    NativeFocus.shareCard(JSON.stringify(card));
  },
  /** Builds a PDF on the phone and opens the share sheet; nothing is uploaded. */
  shareReportPdf(report: object) {
    return NativeFocus.shareReportPdf(JSON.stringify(report));
  },
  exportBackup(fileName: string, content: string) {
    return NativeFocus.exportBackup(fileName, content);
  },
  importBackup() {
    return NativeFocus.importBackup();
  },
  isDeviceAdminActive() {
    return NativeFocus.isDeviceAdminActive();
  },
  requestDeviceAdmin() {
    NativeFocus.requestDeviceAdmin();
  },
  removeDeviceAdmin() {
    NativeFocus.removeDeviceAdmin();
  },
  clearNativeData() {
    return NativeFocus.clearNativeData();
  },
  onChanged(cb: (s: ActiveSession) => void) {
    return DeviceEventEmitter.addListener('focusSessionChanged', (json: string) =>
      cb(JSON.parse(json)),
    );
  },
  onEnded(cb: (s: FinishedSession) => void) {
    return DeviceEventEmitter.addListener('focusSessionEnded', (json: string) =>
      cb(JSON.parse(json)),
    );
  },
};
