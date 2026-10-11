import { Pressable, Switch, View } from 'react-native';
import { useDataQuery, useNow, usePaywall } from '../app/hooks';
import { useNav } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { Banner, Button, Card, IconBadge, Pill, PremiumBadge, Row, ToggleItem } from '../components/ui';
import { listBlocks, setBlockEnabled } from '../db/schedule';
import { focus } from '../native/focus';
import { useApp } from '../state/AppContext';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { formatDurationFa, formatHMFa, toFaDigits } from '../utils/digits';
import { addDays, formatJalaliDayMonth, formatMinuteOfDay, startOfWeek, weekdayIndex, WEEKDAYS } from '../utils/jalali';

/** F13 weekly schedule — visual design from memory/ui/_7. */
export function ScheduleScreen() {
  const nav = useNav();
  const paywall = usePaywall();
  const { isPremium, settings, setSetting, permissions, reloadSchedule, dataVersion } = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const blocks = useDataQuery(() => listBlocks(), [dataVersion]);

  const add = (weekday?: number) => {
    if (!isPremium) {
      paywall('schedule');
      return;
    }
    nav.navigate('BlockEditor', { weekday });
  };

  const toggleBlock = async (id: number, on: boolean) => {
    await setBlockEnabled(id, on);
    await reloadSchedule();
  };

  const enabled = settings.schedule_enabled === '1';
  const today = weekdayIndex(now);
  const weekStart = startOfWeek(now);
  const active = blocks?.filter(b => b.enabled) ?? [];
  const weekMinutes = active.reduce((sum, b) => sum + b.duration_minutes, 0);

  return (
    <Screen title="برنامه‌ی هفتگی" right={!isPremium ? <PremiumBadge /> : undefined}>
      <AppText muted variant="caption">
        سر ساعت هر نوبت، جلسه خودش شروع می‌شود؛ حتی وقتی اپ بسته است.
      </AppText>

      {!isPremium && (
        <Card tone="tint">
          <Row gap={spacing.md}>
            <IconBadge name="calendar" size={44} />
            <View style={{ flex: 1 }}>
              <AppText weight="bold">قفل خودکار سر ساعت</AppText>
              <AppText variant="caption" muted>
                برای هر روز هفته نوبت مطالعه بگذار.
              </AppText>
            </View>
          </Row>
          <Button title="فعال‌سازی نسخه‌ی کامل" icon="star" onPress={() => paywall('schedule')} />
        </Card>
      )}
      {!isPremium && active.length > 0 && (
        <Banner tone="warning" text="نوبت‌هایت سر جایشان هستند، ولی تا نسخه‌ی کامل فعال نشود اجرا نمی‌شوند." />
      )}
      {isPremium && permissions?.exactAlarmRuntime && !permissions.exactAlarm && (
        <Banner
          tone="warning"
          text="برای شروع دقیق سر ساعت، مجوز «هشدار دقیق» لازم است."
          action="باز کن"
          onPress={() => focus.openPermission('exactAlarm')}
        />
      )}

      {isPremium && (
        <Card>
          <ToggleItem
            icon="calendar"
            title="برنامه‌ی هفتگی فعال باشد"
            subtitle="یادآور ۵ دقیقه قبل و قفل خودکار سر وقت"
            value={enabled}
            onChange={v => setSetting('schedule_enabled', v ? '1' : '0')}
          />
          {active.length > 0 && (
            <View style={s.stats}>
              <View style={s.stat}>
                <AppText variant="caption" muted>
                  کل زمان هفته
                </AppText>
                <AppText weight="bold" variant="subtitle">
                  {formatHMFa(weekMinutes)} <AppText variant="caption" muted>ساعت</AppText>
                </AppText>
              </View>
              <View style={s.stat}>
                <AppText variant="caption" muted>
                  نوبت‌های مطالعه
                </AppText>
                <AppText weight="bold" variant="subtitle">
                  {toFaDigits(active.length)} <AppText variant="caption" muted>نوبت</AppText>
                </AppText>
              </View>
            </View>
          )}
        </Card>
      )}

      {WEEKDAYS.map((day, w) => {
        const dayBlocks = blocks?.filter(b => b.weekday === w) ?? [];
        const isToday = w === today;
        const dayMinutes = dayBlocks.filter(b => b.enabled).reduce((sum, b) => sum + b.duration_minutes, 0);
        return (
          <Card key={day} style={isToday && s.today}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Row>
                  <AppText weight="bold" variant="subtitle">
                    {day}
                  </AppText>
                  {isToday ? (
                    <Pill label="امروز" tone="primary" solid />
                  ) : (
                    <AppText variant="caption" muted>
                      {formatJalaliDayMonth(addDays(weekStart, w))}
                    </AppText>
                  )}
                </Row>
                {dayBlocks.length > 0 && (
                  <AppText variant="caption" muted>
                    {formatDurationFa(dayMinutes)} · {toFaDigits(dayBlocks.length)} نوبت
                  </AppText>
                )}
              </View>
              <Pressable onPress={() => add(w)} hitSlop={8} style={s.addBtn} accessibilityLabel={`افزودن نوبت ${day}`}>
                <Icon name="add" size={20} color={colors.primary} />
              </Pressable>
            </Row>
            {dayBlocks.length === 0 ? (
              <AppText variant="caption" muted>
                نوبتی نیست
              </AppText>
            ) : (
              dayBlocks.map(b => (
                <Pressable
                  key={b.id}
                  onPress={() => (isPremium ? nav.navigate('BlockEditor', { blockId: b.id }) : paywall('schedule'))}
                  style={[s.block, { borderRightColor: b.subject_color ?? colors.primary }, (!b.enabled || !enabled) && s.dim]}
                >
                  <View style={s.time}>
                    <AppText weight="bold">{formatMinuteOfDay(b.start_minute)}</AppText>
                    <AppText variant="caption" muted>
                      {formatDurationFa(b.duration_minutes)}
                    </AppText>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText weight="medium" numberOfLines={1}>
                      {b.subject_name ?? 'بدون درس مشخص'}
                    </AppText>
                    <Pill label={b.mode === 'strict' ? 'حالت سخت' : 'حالت عادی'} tone={b.mode === 'strict' ? 'strict' : 'neutral'} />
                  </View>
                  <Switch
                    value={b.enabled === 1}
                    onValueChange={v => toggleBlock(b.id, v)}
                    trackColor={{ true: colors.primary, false: colors.border }}
                    thumbColor={colors.surface}
                  />
                </Pressable>
              ))
            )}
          </Card>
        );
      })}

      <Button title="افزودن نوبت مطالعه" icon="add" variant="secondary" onPress={() => add(today)} />
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  today: { borderColor: c.primary, borderWidth: 1.5 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: spacing.md },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: c.surfaceAlt,
    borderRightWidth: 4,
  },
  time: { alignItems: 'center', minWidth: 64 },
  dim: { opacity: 0.5 },
}));
