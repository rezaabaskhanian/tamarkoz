import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// Native lock core (Kotlin: com.tamarkoz.focus.FocusModule).
// Structured values cross the bridge as JSON strings; see src/native/focus.ts for the typed wrapper.
export interface Spec extends TurboModule {
  getPermissionStatus(): Promise<string>;
  openPermissionSettings(kind: string): void;
  getInstalledApps(): Promise<string>;
  getDeviceInfo(): Promise<string>;

  syncConfig(configJson: string): void;

  startSession(requestJson: string): Promise<string>;
  getActiveSession(): Promise<string>;
  addMinutes(minutes: number): Promise<string>;
  endEarly(): Promise<string>;
  requestEmergency(): Promise<string>;
  cancelEmergency(): Promise<string>;
  confirmEmergency(): Promise<string>;
  getEmergencyStatus(): Promise<string>;
  addBlockedApps(packagesJson: string): Promise<string>;

  getPending(): Promise<string>;
  ackPending(nativeIdsJson: string, skipKeysJson: string): void;
  getLastFinished(): Promise<string>;

  shareCard(cardJson: string): void;
  shareReportPdf(reportJson: string): Promise<boolean>;
  exportBackup(fileName: string, content: string): Promise<boolean>;
  importBackup(): Promise<string>;

  isDeviceAdminActive(): Promise<boolean>;
  requestDeviceAdmin(): void;
  removeDeviceAdmin(): void;

  clearNativeData(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeFocus');
