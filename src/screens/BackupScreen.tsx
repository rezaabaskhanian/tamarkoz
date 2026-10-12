import { useState } from 'react';

import { AppText } from '../components/AppText';
import { Screen } from '../components/Screen';
import { Banner, Button, Card } from '../components/ui';
import { focus } from '../native/focus';
import { exportBackup, importBackup, parseBackup } from '../services/backup';
import { useApp } from '../state/AppContext';
import { dayKey } from '../utils/jalali';
import { toFaDigits } from '../utils/digits';
import { showAlert } from '../components/Dialog';

/** F25: back up to a file and restore from it (e.g. when changing phones). */
export function BackupScreen() {
  const { active, reloadAll } = useApp();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const onExport = async () => {
    setBusy('export');
    try {
      const content = await exportBackup();
      const ok = await focus.exportBackup(`tamarkoz-backup-${dayKey(Date.now())}.json`, content);
      if (ok) showAlert('ذخیره شد', 'فایل پشتیبان ساخته شد. آن را به گوشی تازه منتقل کن.');
    } catch {
      showAlert('خطا', 'فایل پشتیبان ساخته نشد.');
    } finally {
      setBusy(null);
    }
  };

  const onImport = async () => {
    setBusy('import');
    try {
      const text = await focus.importBackup();
      if (!text) return;
      let backup;
      try {
        backup = parseBackup(text);
      } catch (e) {
        showAlert(
          'فایل نامعتبر',
          (e as Error).message === 'newer_version'
            ? 'این فایل با نسخه‌ی تازه‌تری از اپ ساخته شده. اول اپ را به‌روز کن.'
            : 'این فایل پشتیبان تمرکز نیست.',
        );
        return;
      }
      const n = backup.tables.sessions.length;
      showAlert(
        'جایگزین کردن داده‌ها؟',
        `همه‌ی داده‌های فعلی این گوشی با فایل پشتیبان (${toFaDigits(n)} جلسه) جایگزین می‌شود.`,
        [
          { text: 'نه', style: 'cancel' },
          {
            text: 'جایگزین کن',
            style: 'destructive',
            onPress: async () => {
              await importBackup(backup);
              await reloadAll();
              showAlert('انجام شد', 'داده‌ها برگشتند. خریدت را از «بازیابی خرید» برگردان.');
            },
          },
        ],
      );
    } catch {
      showAlert('خطا', 'فایل خوانده نشد.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title="پشتیبان‌گیری" back>
      <AppText muted>
        همه‌ی درس‌ها، جلسه‌ها، برنامه‌ی هفتگی و تنظیمات در یک فایل ذخیره می‌شود. فایل را هر جا خواستی نگه دار؛ اپ چیزی
        را به اینترنت نمی‌فرستد.
      </AppText>
      {active && <Banner tone="warning" text="وسط جلسه نمی‌شود داده‌ها را بازیابی کرد." />}
      <Card>
        <AppText weight="bold">ساخت فایل پشتیبان</AppText>
        <Button title="ذخیره در فایل" loading={busy === 'export'} disabled={busy != null} onPress={onExport} />
      </Card>
      <Card>
        <AppText weight="bold">بازیابی از فایل</AppText>
        <AppText variant="caption" muted>
          داده‌های فعلی این گوشی پاک و با فایل جایگزین می‌شود.
        </AppText>
        <Button
          title="انتخاب فایل"
          variant="secondary"
          loading={busy === 'import'}
          disabled={busy != null || Boolean(active)}
          onPress={onImport}
        />
      </Card>
    </Screen>
  );
}
