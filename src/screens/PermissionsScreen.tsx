import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { useCallback } from 'react';
import { PermissionsAndroid, View } from 'react-native';
import { useNav, type RootStackParamList } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { Icon, type IconName } from '../components/Icon';
import { Screen } from '../components/Screen';
import { Button, Card, IconBadge, Pill, Row } from '../components/ui';
import { focus, type PermissionKind, type PermissionStatus } from '../native/focus';
import { hasRequiredPermissions, useApp } from '../state/AppContext';
import { spacing, useTheme } from '../theme';
import { toFaDigits } from '../utils/digits';

type Step = {
  kind: PermissionKind;
  title: string;
  why: string;
  level: 'required' | 'recommended' | 'strong' | 'guide' | 'schedule';
  icon: IconName;
  granted: (p: PermissionStatus) => boolean | null; // null = can't be detected
  visible?: (p: PermissionStatus) => boolean;
};

const LEVEL_LABEL: Record<Step['level'], string> = {
  required: 'اجباری',
  recommended: 'توصیه‌شده',
  strong: 'خیلی مهم',
  guide: 'راهنما',
  schedule: 'برای برنامه‌ی هفتگی',
};

const STEPS: Step[] = [
  {
    kind: 'usage',
    icon: 'chart',
    title: 'دسترسی به آمار استفاده',
    why: 'تا بفهمیم الان کدام اپ باز است. در فهرست، «تمرکز» را پیدا کن و روشنش کن.',
    level: 'required',
    granted: p => p.usage,
  },
  {
    kind: 'overlay',
    icon: 'layers',
    title: 'نمایش روی برنامه‌های دیگر',
    why: 'تا صفحه‌ی قفل روی اپ ممنوع بیاید.',
    level: 'required',
    granted: p => p.overlay,
  },
  {
    kind: 'notifications',
    icon: 'bell',
    title: 'اعلان‌ها',
    why: 'برای اعلان ثابت جلسه، زمان باقی‌مانده و خبر پایان جلسه.',
    level: 'recommended',
    granted: p => p.notifications,
  },
  {
    kind: 'battery',
    icon: 'battery',
    title: 'خارج کردن از بهینه‌سازی باتری',
    why: 'تا گوشی وسط جلسه سرویس قفل را نبندد.',
    level: 'strong',
    granted: p => p.battery,
  },
  {
    kind: 'autostart',
    icon: 'sparkle',
    title: 'شروع خودکار',
    why: 'روی شیائومی، هواوی، اوپو و ویوو لازم است تا قفل بعد از روشن شدن گوشی برگردد. در صفحه‌ای که باز می‌شود «تمرکز» را روشن کن.',
    level: 'guide',
    granted: () => null,
    visible: p => ['xiaomi', 'redmi', 'poco', 'huawei', 'honor', 'oppo', 'realme', 'vivo'].includes(p.manufacturer),
  },
  {
    kind: 'exactAlarm',
    icon: 'clock',
    title: 'هشدار دقیق',
    why: 'تا جلسه‌های برنامه‌ی هفتگی دقیقاً سر ساعت شروع شوند.',
    level: 'schedule',
    granted: p => p.exactAlarm,
    visible: p => p.exactAlarmRuntime,
  },
];

export function PermissionsScreen() {
  const nav = useNav();
  const route = useRoute<RouteProp<RootStackParamList, 'Permissions'>>();
  const flow = route.params?.flow ?? 'status';
  const { permissions, refreshPermissions } = useApp();
  const { colors } = useTheme();

  // Status is re-read whenever the user comes back from a Settings screen.
  useFocusEffect(
    useCallback(() => {
      refreshPermissions().catch(() => {});
    }, [refreshPermissions]),
  );

  const open = async (kind: PermissionKind) => {
    if (kind === 'notifications' && permissions?.notificationsRuntime) {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (r !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        await refreshPermissions();
        return;
      }
    }
    focus.openPermission(kind);
  };

  const ok = hasRequiredPermissions(permissions);
  const steps = permissions ? STEPS.filter(st => !st.visible || st.visible(permissions)) : [];

  const footer =
    flow === 'onboarding' ? (
      <>
        <Button
          title="ادامه"
          size="lg"
          disabled={!ok}
          onPress={() => nav.navigate('BlockedApps', { flow: 'onboarding' })}
        />
        {!ok && (
          <AppText variant="caption" muted center>
            دو مجوز اجباری لازم است تا قفل کار کند.
          </AppText>
        )}
      </>
    ) : flow === 'fix' ? (
      <Button title="تمام" size="lg" disabled={!ok} onPress={() => nav.goBack()} />
    ) : undefined;

  const required = steps.filter(st => st.level === 'required');
  const grantedCount = permissions ? steps.filter(st => st.granted(permissions) === true).length : 0;
  const detectable = permissions ? steps.filter(st => st.granted(permissions) !== null).length : 0;

  return (
    <Screen title={flow === 'status' ? 'وضعیت مجوزها' : 'قفل چطور کار می‌کند؟'} back={flow !== 'onboarding'} footer={footer}>
      <AppText muted>
        برای قفل کردن اپ‌ها {toFaDigits(required.length)} مجوز اجباری لازم است. هر مورد را بزن تا همان صفحه‌ی تنظیمات
        گوشی باز شود، بعد با دکمه‌ی بازگشت به اینجا برگرد.
      </AppText>
      {steps.map(st => {
        const g = permissions ? st.granted(permissions) : false;
        return (
          <Card key={st.kind}>
            <Row gap={spacing.md} style={{ alignItems: 'flex-start' }}>
              <IconBadge name={st.icon} tone={g ? 'success' : st.level === 'required' ? 'primary' : 'neutral'} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <AppText weight="bold" style={{ flex: 1 }}>
                    {st.title}
                  </AppText>
                  {g ? (
                    <Pill label="فعال شد" icon="check" tone="success" />
                  ) : (
                    <Pill label={LEVEL_LABEL[st.level]} tone={st.level === 'required' ? 'danger' : 'neutral'} />
                  )}
                </Row>
                <AppText variant="caption" muted>
                  {st.why}
                </AppText>
              </View>
            </Row>
            {g !== true && (
              <Button
                title={st.level === 'guide' ? 'باز کردن تنظیمات شروع خودکار' : 'فعال‌سازی'}
                variant={st.level === 'required' ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => open(st.kind)}
              />
            )}
          </Card>
        );
      })}
      <Card tone="tint">
        <Row gap={spacing.md} style={{ alignItems: 'flex-start' }}>
          <IconBadge name="lock" tone="warning" size={40} />
          <View style={{ flex: 1 }}>
            <AppText weight="bold">حریم خصوصی کامل</AppText>
            <AppText variant="caption" muted>
              قفل بدون اینترنت کار می‌کند. هیچ گزارشی از فعالیتت به هیچ سروری فرستاده نمی‌شود.
            </AppText>
          </View>
        </Row>
      </Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <Icon name="shield" size={18} color={colors.primary} />
          <AppText variant="caption" weight="medium">
            وضعیت
          </AppText>
        </Row>
        <AppText variant="caption" muted>
          {toFaDigits(grantedCount)} از {toFaDigits(detectable)} دسترسی فعال است
        </AppText>
      </Row>
      <Button title="راهنمای «قفل کار نمی‌کند»" variant="ghost" onPress={() => nav.navigate('Troubleshoot')} />
    </Screen>
  );
}
