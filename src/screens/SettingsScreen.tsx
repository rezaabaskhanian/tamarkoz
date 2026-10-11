import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { usePaywall } from '../app/hooks';
import { useNav } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { JalaliDatePicker, NumberInput, TimeStepper } from '../components/Pickers';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import {
  Button,
  Card,
  Chip,
  Divider,
  ListItem,
  PremiumBadge,
  Row,
  SectionTitle,
  Segmented,
  ToggleItem,
} from '../components/ui';
import { APP_VERSION, FREE_BLOCKED_APPS_LIMIT, SUPPORT_EMAIL } from '../config';
import { getDbInfo, type DbInfo } from '../db';
import { FIELDS, type Field } from '../db/subjects';
import { focus } from '../native/focus';
import { clearAllData } from '../services/backup';
import { hasRequiredPermissions, useApp } from '../state/AppContext';
import type { ThemePref } from '../theme';
import { formatDurationFa, toFaDigits } from '../utils/digits';
import { formatJalaliDate, formatJalaliDateWithWeekday, formatMinuteOfDay, toJalali } from '../utils/jalali';

const GOALS = [0, 120, 240, 360, 480, 600];

export function SettingsScreen() {
  const nav = useNav();
  const paywall = usePaywall();
  const app = useApp();
  const { settings, setSetting, active, isPremium, premiumUntil, permissions, blockedApps, subjects } = app;
  const strictNow = active?.mode === 'strict';

  const [examPicker, setExamPicker] = useState(false);
  const [fieldSheet, setFieldSheet] = useState(false);
  const [goalSheet, setGoalSheet] = useState(false);
  const [reminderSheet, setReminderSheet] = useState(false);
  const [goal, setGoal] = useState<number | null>(Number(settings.daily_goal_minutes) || 0);
  const [reminderTime, setReminderTime] = useState(Number(settings.daily_reminder_time) || 1020);
  const [admin, setAdmin] = useState(false);

  useFocusEffect(
    useCallback(() => {
      focus.isDeviceAdminActive().then(setAdmin).catch(() => {});
    }, []),
  );

  const toggle = (key: Parameters<typeof setSetting>[0]) => (v: boolean) => setSetting(key, v ? '1' : '0');
  const exam = Number(settings.exam_date) || 0;
  const fieldLabel = FIELDS.find(f => f.id === settings.field)?.label ?? 'انتخاب نشده';

  const clearData = () => {
    if (active) {
      Alert.alert('جلسه در حال اجراست', 'وسط جلسه نمی‌شود داده‌ها را پاک کرد.');
      return;
    }
    Alert.alert('پاک کردن همه‌ی داده‌ها؟', 'همه‌ی جلسه‌ها، درس‌ها، برنامه و تنظیمات پاک می‌شود.', [
      { text: 'نه', style: 'cancel' },
      {
        text: 'ادامه',
        style: 'destructive',
        onPress: () =>
          Alert.alert('مطمئنی؟', 'این کار برگشت ندارد. خرید از بازار با «بازیابی خرید» برمی‌گردد.', [
            { text: 'نه، منصرف شدم', style: 'cancel' },
            {
              text: 'بله، همه را پاک کن',
              style: 'destructive',
              onPress: async () => {
                if (!(await focus.clearNativeData())) return;
                await clearAllData();
                await app.reloadAll();
                nav.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
              },
            },
          ]),
      },
    ]);
  };

  return (
    <Screen title="تنظیمات">
      <Card>
        <ListItem
          title={isPremium ? 'نسخه‌ی کامل فعال است' : 'نسخه‌ی رایگان'}
          subtitle={isPremium ? `اعتبار تا ${formatJalaliDate(premiumUntil)}` : 'دیدن امکانات نسخه‌ی کامل و بازیابی خرید'}
          icon="star"
          onPress={() => (isPremium ? nav.navigate('Purchase', { reason: 'settings' }) : paywall('settings'))}
        />
      </Card>

      <SectionTitle>کنکور</SectionTitle>
      <Card>
        <ListItem title="تاریخ کنکور"
          icon="calendar" subtitle={exam ? formatJalaliDate(exam) : 'تعیین نشده'} onPress={() => setExamPicker(true)} />
        <Divider />
        <ListItem title="رشته"
          icon="book" subtitle={fieldLabel} onPress={() => setFieldSheet(true)} />
        {settings.exam_countdown_hidden === '1' && (
          <>
            <Divider />
            <ListItem title="نمایش دوباره‌ی شمارش معکوس"
          icon="calendar" onPress={() => setSetting('exam_countdown_hidden', '0')} />
          </>
        )}
      </Card>

      <SectionTitle>مطالعه</SectionTitle>
      <Card>
        <ListItem title="درس‌ها"
          icon="book" subtitle={`${toFaDigits(subjects.length)} درس`} onPress={() => nav.navigate('Subjects')} />
        <Divider />
        <ListItem
          title="اپ‌های ممنوع"
          icon="block"
          subtitle={`${toFaDigits(blockedApps.length)} اپ${!isPremium ? ` · رایگان تا ${toFaDigits(FREE_BLOCKED_APPS_LIMIT)} اپ` : ''}`}
          onPress={() => nav.navigate('BlockedApps', { flow: 'settings' })}
        />
        <Divider />
        <ListItem
          title="هدف روزانه"
          icon="target"
          subtitle={Number(settings.daily_goal_minutes) ? formatDurationFa(Number(settings.daily_goal_minutes)) : 'بدون هدف'}
          onPress={() => setGoalSheet(true)}
        />
        <Divider />
        <ListItem title="ثبت دستی ساعت مطالعه"
          icon="add" onPress={() => nav.navigate('ManualLog')} />
      </Card>

      <SectionTitle>قفل</SectionTitle>
      <Card>
        <ListItem
          title="وضعیت مجوزها"
          icon="shield"
          subtitle={hasRequiredPermissions(permissions) ? 'مجوزهای اجباری فعال‌اند' : 'یک مجوز اجباری خاموش است'}
          danger={!hasRequiredPermissions(permissions)}
          onPress={() => nav.navigate('Permissions', { flow: 'status' })}
        />
        <Divider />
        <ToggleItem
          title="قفل تنظیمات گوشی در حالت سخت"
          icon="lock"
          subtitle={strictNow ? 'در جلسه‌ی سخت قابل تغییر نیست' : 'برنامه‌ی تنظیمات و صفحه‌ی حذف برنامه‌ها هم قفل می‌شوند'}
          value={settings.block_system_settings_in_strict === '1'}
          onChange={toggle('block_system_settings_in_strict')}
          disabled={strictNow}
        />
        <Divider />
        <ListItem
          title="محافظت در برابر حذف اپ"
          icon="delete"
          subtitle={admin ? 'فعال است' : 'حذف اپ وسط جلسه‌ی سخت را سخت‌تر می‌کند'}
          right={!isPremium && !admin ? <PremiumBadge /> : undefined}
          disabled={admin && strictNow}
          onPress={() => {
            if (!isPremium && !admin) return paywall('settings');
            if (admin) {
              Alert.alert('غیرفعال کردن محافظت؟', '', [
                { text: 'نه', style: 'cancel' },
                {
                  text: 'غیرفعال کن',
                  style: 'destructive',
                  onPress: () => {
                    focus.removeDeviceAdmin();
                    setTimeout(() => focus.isDeviceAdminActive().then(setAdmin), 500);
                  },
                },
              ]);
            } else {
              Alert.alert(
                'محافظت در برابر حذف',
                'با فعال کردن «مدیر دستگاه»، تا وقتی این دسترسی روشن است اندروید اجازه‌ی حذف اپ را نمی‌دهد. در حالت سخت تنظیمات گوشی قفل است، پس وسط جلسه نمی‌شود خاموشش کرد. بیرون از جلسه هر وقت خواستی از همین‌جا خاموشش کن.',
                [
                  { text: 'بعداً', style: 'cancel' },
                  { text: 'فعال کن', onPress: () => focus.requestDeviceAdmin() },
                ],
              );
            }
          }}
        />
        <Divider />
        <ListItem title="قفل کار نمی‌کند؟"
          icon="warning" subtitle="راهنمای شیائومی، سامسونگ و هواوی" onPress={() => nav.navigate('Troubleshoot')} />
        <Divider />
        <ListItem title="محدودیت‌های قفل"
          icon="layers" onPress={() => nav.navigate('Info', { page: 'limits' })} />
      </Card>

      <SectionTitle>اعلان‌ها</SectionTitle>
      <Card>
        <ToggleItem title="صدای پایان جلسه"
          icon="bell" value={settings.finish_sound === '1'} onChange={toggle('finish_sound')} />
        <Divider />
        <ToggleItem
          title="یادآور نوبت برنامه"
          icon="calendar"
          subtitle="پنج دقیقه قبل از شروع"
          value={settings.notif_schedule_reminder === '1'}
          onChange={toggle('notif_schedule_reminder')}
        />
        <Divider />
        <ToggleItem
          title="یادآور روزانه‌ی مطالعه"
          icon="clock"
          subtitle={settings.daily_reminder_enabled === '1' ? `هر روز ساعت ${formatMinuteOfDay(Number(settings.daily_reminder_time))}` : 'خاموش'}
          value={settings.daily_reminder_enabled === '1'}
          onChange={v => (v ? setReminderSheet(true) : setSetting('daily_reminder_enabled', '0'))}
        />
        <Divider />
        <ToggleItem
          title="یادآور پایان اعتبار خرید"
          icon="star"
          subtitle="سه روز قبل"
          value={settings.notif_expiry === '1'}
          onChange={toggle('notif_expiry')}
        />
      </Card>

      <SectionTitle>پوسته</SectionTitle>
      <Card>
        <Segmented<ThemePref>
          value={settings.theme as ThemePref}
          onChange={v => setSetting('theme', v)}
          options={[
            { value: 'light', label: 'روشن', icon: 'sparkle' },
            { value: 'dark', label: 'تیره', icon: 'clock' },
            { value: 'system', label: 'خودکار', icon: 'settings' },
          ]}
        />
        <AppText variant="caption" muted>
          ویجت صفحه‌ی اصلی (نسخه‌ی کامل): صفحه‌ی اصلی گوشی را نگه دار، «ویجت‌ها» را بزن و «تمرکز» را اضافه کن.
        </AppText>
      </Card>

      <SectionTitle>داده‌ها</SectionTitle>
      <Card>
        <ListItem title="پشتیبان‌گیری و بازیابی با فایل"
          icon="layers" onPress={() => nav.navigate('Backup')} />
        <Divider />
        <ListItem title="پاک کردن همه‌ی داده‌ها"
          icon="delete" danger disabled={Boolean(active)} onPress={clearData} />
      </Card>

      <SectionTitle>درباره</SectionTitle>
      <Card>
        <ListItem title="درباره‌ی تمرکز"
          icon="target" subtitle={`نسخه‌ی ${toFaDigits(APP_VERSION)}`} onPress={() => nav.navigate('Info', { page: 'about' })} />
        <Divider />
        <ListItem title="حریم خصوصی"
          icon="lock" subtitle="هیچ داده‌ای از گوشی بیرون نمی‌رود" onPress={() => nav.navigate('Info', { page: 'privacy' })} />
        <Divider />
        <ListItem
          title="ارتباط با پشتیبانی"
          icon="share"
          subtitle={SUPPORT_EMAIL}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('پشتیبانی تمرکز')}`).catch(() => {})}
        />
      </Card>

      {__DEV__ && <DebugInfo />}

      <JalaliDatePicker
        visible={examPicker}
        value={exam || null}
        onClose={() => setExamPicker(false)}
        onPick={ms => {
          setSetting('exam_date', String(ms));
          setSetting('exam_countdown_hidden', '0');
        }}
        title="تاریخ کنکور"
        minYear={toJalali(Date.now()).jy}
      />

      <Sheet visible={fieldSheet} onClose={() => setFieldSheet(false)} title="رشته">
        <Row style={{ flexWrap: 'wrap' }}>
          {FIELDS.map(f => (
            <Chip
              key={f.id}
              label={f.label}
              selected={settings.field === f.id}
              onPress={() => {
                setSetting('field', f.id as Field);
                setFieldSheet(false);
              }}
            />
          ))}
        </Row>
        <AppText variant="caption" muted>
          درس‌های فعلی دست نمی‌خورند؛ از «درس‌ها» تغییرشان بده.
        </AppText>
      </Sheet>

      <Sheet visible={goalSheet} onClose={() => setGoalSheet(false)} title="هدف روزانه">
        <Row style={{ flexWrap: 'wrap' }}>
          {GOALS.map(g => (
            <Chip key={g} label={g ? formatDurationFa(g) : 'بدون هدف'} selected={goal === g} onPress={() => setGoal(g)} />
          ))}
        </Row>
        <NumberInput value={goal} onChange={setGoal} placeholder="دقیقه" maxLength={4} />
        <Button
          title="ذخیره"
          disabled={goal == null || goal > 1200}
          onPress={() => {
            setSetting('daily_goal_minutes', String(goal ?? 0));
            setGoalSheet(false);
          }}
        />
      </Sheet>

      <Sheet visible={reminderSheet} onClose={() => setReminderSheet(false)} title="ساعت یادآور روزانه">
        <TimeStepper value={reminderTime} onChange={setReminderTime} />
        <Button
          title="روشن کن"
          onPress={async () => {
            await setSetting('daily_reminder_time', String(reminderTime));
            await setSetting('daily_reminder_enabled', '1');
            setReminderSheet(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}

/** Development-only: Jalali date and database schema check. */
function DebugInfo() {
  const [info, setInfo] = useState<DbInfo | null>(null);
  useEffect(() => {
    getDbInfo().then(setInfo).catch(() => {});
  }, []);
  return (
    <Card>
      <AppText weight="bold">اطلاعات آزمایشی</AppText>
      <AppText variant="caption">امروز: {formatJalaliDateWithWeekday(Date.now())}</AppText>
      {info && (
        <View>
          <AppText variant="caption">نسخه‌ی پایگاه داده: {toFaDigits(info.version)}</AppText>
          <AppText variant="caption" muted>
            {info.tables.join('، ')}
          </AppText>
        </View>
      )}
    </Card>
  );
}
