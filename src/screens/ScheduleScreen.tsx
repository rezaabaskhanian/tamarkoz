import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useDataQuery, useNow, usePaywall } from '../app/hooks';
import { useNav } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { Icon } from '../components/Icon';
import { MarathonSheet } from '../components/MarathonSheet';
import { Screen } from '../components/Screen';
import {
  Banner,
  Button,
  Card,
  IconBadge,
  Pill,
  PremiumBadge,
  Row,
  ToggleItem,
} from '../components/ui';
import { activityInfo } from '../activities';
import { listBlocks, setBlockEnabled } from '../db/schedule';
import { focus } from '../native/focus';
import { useApp } from '../state/AppContext';
import { makeStyles, radius, spacing, useTheme, type Colors } from '../theme';
import { formatDurationFa, formatHMFa, toFaDigits } from '../utils/digits';
import {
  addDays,
  formatJalaliDayMonth,
  formatMinuteOfDay,
  startOfWeek,
  weekdayIndex,
  WEEKDAYS,
} from '../utils/jalali';

const SHORT_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/** One color per weekday (Saturday first) so the week reads at a glance. */
function dayColors(c: Colors) {
  return [
    { fg: c.primary, bg: c.primarySoft },
    { fg: c.strict, bg: c.strictSoft },
    { fg: c.cyan, bg: c.cyanSoft },
    { fg: c.orange, bg: c.orangeSoft },
    { fg: c.pink, bg: c.pinkSoft },
    { fg: c.warning, bg: c.warningSoft },
    { fg: c.danger, bg: c.dangerSoft },
  ];
}

/** F13 weekly schedule — visual design from memory/ui/_7. */
export function ScheduleScreen() {
  const nav = useNav();
  const paywall = usePaywall();
  const {
    isPremium,
    settings,
    setSetting,
    permissions,
    reloadSchedule,
    dataVersion,
  } = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const blocks = useDataQuery(() => listBlocks(), [dataVersion]);
  const [marathon, setMarathon] = useState(false);

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
    <Screen
      title="برنامه‌ی هفتگی"
      right={!isPremium ? <PremiumBadge /> : undefined}
    >
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
          <Button
            title="فعال‌سازی نسخه‌ی کامل"
            icon="star"
            onPress={() => paywall('schedule')}
          />
        </Card>
      )}
      {!isPremium && active.length > 0 && (
        <Banner
          tone="warning"
          text="نوبت‌هایت سر جایشان هستند، ولی تا نسخه‌ی کامل فعال نشود اجرا نمی‌شوند."
        />
      )}
      {isPremium &&
        permissions?.exactAlarmRuntime &&
        !permissions.exactAlarm && (
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
            icon="eventCheck"
            iconTone="cyan"
            title="برنامه‌ی هفتگی فعال باشد"
            subtitle="یادآور ۵ دقیقه قبل و قفل خودکار سر وقت"
            value={enabled}
            onChange={v => setSetting('schedule_enabled', v ? '1' : '0')}
          />
          {active.length > 0 && (
            <View style={s.stats}>
              <View style={[s.stat, { backgroundColor: colors.cyanSoft }]}>
                <AppText variant="caption" muted>
                  کل زمان هفته
                </AppText>
                <AppText weight="bold" variant="subtitle">
                  {formatHMFa(weekMinutes)}{' '}
                  <AppText variant="caption" muted>
                    ساعت
                  </AppText>
                </AppText>
              </View>
              <View style={[s.stat, { backgroundColor: colors.orangeSoft }]}>
                <AppText variant="caption" muted>
                  نوبت‌های مطالعه
                </AppText>
                <AppText weight="bold" variant="subtitle">
                  {toFaDigits(active.length)}{' '}
                  <AppText variant="caption" muted>
                    نوبت
                  </AppText>
                </AppText>
              </View>
            </View>
          )}
        </Card>
      )}

      <Card
        onPress={() => (isPremium ? setMarathon(true) : paywall('schedule'))}
        style={{ backgroundColor: colors.orangeSoft }}
      >
        <Row gap={spacing.md}>
          <IconBadge name="flame" tone="orange" size={44} />
          <View style={{ flex: 1 }}>
            <AppText weight="bold">ماراتن درس ضعیف</AppText>
            <AppText variant="caption" muted>
              ۳ تا ۴ روز، روزی ۴ تا ۵ ساعت فقط یک درس؛ نوبت‌ها خودکار ساخته و بعد پاک می‌شوند.
            </AppText>
          </View>
          {!isPremium ? <PremiumBadge /> : <Icon name="forward" color={colors.orange} />}
        </Row>
      </Card>
      <MarathonSheet visible={marathon} onClose={() => setMarathon(false)} />

      {WEEKDAYS.map((day, w) => {
        const dayBlocks = blocks?.filter(b => b.weekday === w) ?? [];
        const isToday = w === today;
        const dc = dayColors(colors)[w];
        const dayMinutes = dayBlocks
          .filter(b => b.enabled)
          .reduce((sum, b) => sum + b.duration_minutes, 0);
        return (
          <Card key={day} style={isToday && [s.today, { borderColor: dc.fg }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View
                style={[
                  s.dayBadge,
                  { backgroundColor: isToday ? dc.fg : dc.bg },
                ]}
              >
                <AppText weight="bold" color={isToday ? '#FFFFFF' : dc.fg}>
                  {SHORT_DAYS[w]}
                </AppText>
              </View>
              <View style={{ flex: 1 }}>
                <Row>
                  <AppText weight="bold" variant="subtitle">
                    {day}
                  </AppText>
                  {isToday ? (
                    <View style={[s.todayTag, { backgroundColor: dc.fg }]}>
                      <AppText variant="caption" weight="bold" color="#FFFFFF">
                        امروز
                      </AppText>
                    </View>
                  ) : (
                    <AppText variant="caption" muted>
                      {formatJalaliDayMonth(addDays(weekStart, w))}
                    </AppText>
                  )}
                </Row>
                {dayBlocks.length > 0 && (
                  <AppText variant="caption" muted>
                    {formatDurationFa(dayMinutes)} ·{' '}
                    {toFaDigits(dayBlocks.length)} نوبت
                  </AppText>
                )}
              </View>
              <Pressable
                onPress={() => add(w)}
                hitSlop={8}
                style={[s.addBtn, { backgroundColor: dc.bg }]}
                accessibilityLabel={`افزودن نوبت ${day}`}
              >
                <Icon name="add" size={20} color={dc.fg} />
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
                  onPress={() =>
                    isPremium
                      ? nav.navigate('BlockEditor', { blockId: b.id })
                      : paywall('schedule')
                  }
                  style={[
                    s.block,
                    {
                      borderRightColor:
                        b.activity !== 'study'
                          ? activityInfo(b.activity).color
                          : b.subject_color ?? dc.fg,
                      backgroundColor: dc.bg,
                    },
                    (!b.enabled || !enabled) && s.dim,
                  ]}
                >
                  <View style={s.time}>
                    <AppText weight="bold" color={dc.fg}>
                      {formatMinuteOfDay(b.start_minute)}
                    </AppText>
                    <AppText variant="caption" muted>
                      {formatDurationFa(b.duration_minutes)}
                    </AppText>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText weight="medium" numberOfLines={1}>
                      {b.activity !== 'study'
                        ? activityInfo(b.activity, b.activity_name).label
                        : b.subject_name ?? 'بدون درس مشخص'}
                    </AppText>
                    <Row gap={4}>
                      <Pill
                        label={b.mode === 'strict' ? 'حالت سخت' : 'حالت عادی'}
                        tone={b.mode === 'strict' ? 'strict' : 'neutral'}
                      />
                      {b.expires_at ? (
                        <Pill
                          label={`ماراتن · ${formatJalaliDayMonth(b.expires_at - 1)}`}
                          icon="flame"
                          tone="orange"
                        />
                      ) : null}
                    </Row>
                  </View>
                  <Switch
                    value={b.enabled === 1}
                    onValueChange={v => toggleBlock(b.id, v)}
                    trackColor={{ true: dc.fg, false: colors.border }}
                    thumbColor={colors.surface}
                  />
                </Pressable>
              ))
            )}
          </Card>
        );
      })}

      <Button
        title="افزودن نوبت مطالعه"
        icon="add"
        variant="secondary"
        onPress={() => add(today)}
      />
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  today: { borderColor: c.primary, borderWidth: 1.5 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  dayBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  todayTag: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 1,
  },
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
