import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useDataQuery, useLiveSession, useNow, usePaywall } from '../app/hooks';
import { useNav } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { ProgressRing, SubjectBars } from '../components/Charts';
import { Icon, type IconName } from '../components/Icon';
import { Celebration } from '../components/Celebration';
import { MotivationCard } from '../components/Motivation';
import { JalaliDatePicker } from '../components/Pickers';
import { Screen } from '../components/Screen';
import { Banner, Button, Card, CardTitle, IconBadge, Pill, Row, type Tone } from '../components/ui';
import { listBlocks } from '../db/schedule';
import { FIELDS } from '../db/subjects';
import { focus } from '../native/focus';
import { daysLeft } from '../services/entitlement';
import { goalStreak, todaySummary } from '../services/reports';
import { nextBlock } from '../services/scheduleUtil';
import { hasRequiredPermissions, useApp } from '../state/AppContext';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { formatClockFa, formatDurationFa, formatHMFa, toFaDigits } from '../utils/digits';
import {
  daysBetween,
  formatJalaliDate,
  formatJalaliDateWithWeekday,
  formatMinuteOfDay,
  startOfDay,
  toJalali,
  WEEKDAYS,
  weekdayIndex,
} from '../utils/jalali';

/** F10 home: greeting, countdown, today at a glance, start, quick actions, subjects, next block. */
export function HomeScreen() {
  const nav = useNav();
  const { permissions, settings, isPremium, subjects, access } = useApp();
  const paywall = usePaywall();
  const active = useLiveSession();
  const { colors } = useTheme();
  const s = useStyles();
  const now = useNow(30_000);

  const today = useDataQuery(() => todaySummary(), [startOfDay(now)]);
  const goal = Number(settings.daily_goal_minutes) || 0;
  const streak = useDataQuery(() => goalStreak(goal), [goal, startOfDay(now)]);
  const blocks = useDataQuery(() => listBlocks(), []);
  const upcoming =
    isPremium && settings.schedule_enabled === '1' && blocks ? nextBlock(blocks, now) : null;

  const todaySec = today?.total ?? 0;
  // Only a running *study* session adds to today's study time (not sleep, deep work…).
  const liveSec =
    active && (!active.activity || active.activity === 'study') && startOfDay(active.startedAt) === startOfDay(now)
      ? Math.floor(active.studiedMs / 1000)
      : 0;
  const totalMin = Math.floor((todaySec + liveSec) / 60);
  const field = FIELDS.find(f => f.id === settings.field)?.label;
  const upcomingDays = upcoming ? daysBetween(now, upcoming.at) : 0;
  const goalPct = goal > 0 ? Math.min(100, Math.round((totalMin / goal) * 100)) : 0;
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? 'صبح بخیر' : hour < 17 ? 'روز بخیر' : 'عصر بخیر';

  const share = () =>
    focus.shareCard({
      title: 'مطالعه‌ی امروز',
      value: formatDurationFa(totalMin),
      subtitle: formatJalaliDateWithWeekday(now),
      detail: streak && streak.days > 1 ? `${toFaDigits(streak.days)} روز پیاپی به هدف رسیدم` : '',
    });

  const quick: { icon: IconName; label: string; tone: Tone; onPress: () => void }[] = [
    { icon: 'moon', label: 'خواب', tone: 'strict', onPress: () => nav.navigate('StartSession', { activity: 'sleep' }) },
    { icon: 'work', label: 'کار عمیق', tone: 'cyan', onPress: () => nav.navigate('StartSession', { activity: 'deep_work' }) },
    { icon: 'add', label: 'ثبت دستی', tone: 'orange', onPress: () => nav.navigate('ManualLog') },
    { icon: 'share', label: 'اشتراک', tone: 'pink', onPress: share },
  ];

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <AppText variant="title">{greeting} 👋</AppText>
          <AppText muted variant="caption">
            {formatJalaliDateWithWeekday(now)}
            {field ? ` · ${field}` : ''}
          </AppText>
        </View>
        {access.source === 'trial' && (
          <Pressable onPress={() => paywall('settings')} hitSlop={8}>
            <Pill label={`رایگان · ${toFaDigits(daysLeft(access.until))} روز`} icon="star" tone="pink" />
          </Pressable>
        )}
      </Row>

      {!hasRequiredPermissions(permissions) && permissions && (
        <Banner
          text="دسترسی قفل خودکار غیرفعال است"
          action="فعال‌سازی"
          onPress={() => nav.navigate('Permissions', { flow: 'fix' })}
        />
      )}

      <Countdown now={now} />

      <MotivationCard />

      <View style={s.tiles}>
        <View style={[s.tile, { backgroundColor: colors.primarySoft }]}>
          <Icon name="timer" size={20} color={colors.primary} />
          <AppText style={s.tileValue} color={colors.primary}>
            {formatHMFa(totalMin)}
          </AppText>
          <AppText variant="caption" muted>
            مطالعه‌ی امروز
          </AppText>
        </View>
        <Pressable
          style={[s.tile, { backgroundColor: colors.strictSoft }]}
          onPress={goal > 0 ? undefined : () => nav.navigate('Tabs', { screen: 'Settings' })}
        >
          {goal > 0 ? (
            <ProgressRing progress={goalPct / 100} size={44} stroke={5} color={colors.strict}>
              <AppText variant="caption" weight="bold" color={colors.strict} style={{ fontSize: 11 }}>
                {toFaDigits(goalPct)}٪
              </AppText>
            </ProgressRing>
          ) : (
            <Icon name="target" size={20} color={colors.strict} />
          )}
          <AppText variant="caption" weight="bold" color={colors.strict}>
            {goal > 0 ? `هدف ${formatHMFa(goal)}` : 'هدف بگذار'}
          </AppText>
        </Pressable>
        <View style={[s.tile, { backgroundColor: colors.orangeSoft }]}>
          {streak && streak.days > 0 ? (
            <Celebration key={streak.days} kind="streak" size={34} style={s.flame} />
          ) : (
            <Icon name="flame" size={20} color={colors.orange} />
          )}
          <AppText style={s.tileValue} color={colors.orange}>
            {toFaDigits(streak?.days ?? 0)}
          </AppText>
          <AppText variant="caption" muted>
            روز پیاپی
          </AppText>
        </View>
      </View>

      {active ? (
        <Card onPress={() => nav.navigate('ActiveSession')} style={active.mode === 'strict' ? s.activeStrict : s.active}>
          <Row>
            <View style={s.activeIcon}>
              <Icon name="lock" color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText weight="bold" color="#FFFFFF">
                {active.activity && active.activity !== 'study' ? active.activityName : active.subjectName}
              </AppText>
              <AppText variant="caption" color="rgba(255,255,255,0.85)">
                {active.phase === 'break' && active.workMs > 0
                  ? 'استراحت'
                  : `${formatClockFa(Math.floor(active.remainingMs / 1000))} باقی مانده`}
              </AppText>
            </View>
            <Icon name="forward" color="#FFFFFF" />
          </Row>
        </Card>
      ) : (
        <Button title="شروع جلسه‌ی تمرکز" size="lg" icon="lock" onPress={() => nav.navigate('StartSession')} />
      )}

      <View style={s.quickRow}>
        {quick.map(q => (
          <Pressable
            key={q.label}
            onPress={q.onPress}
            disabled={Boolean(active) && q.label !== 'اشتراک' && q.label !== 'ثبت دستی'}
            style={({ pressed }) => [s.quick, pressed && s.pressed]}
            accessibilityRole="button"
            accessibilityLabel={q.label}
          >
            <IconBadge name={q.icon} tone={q.tone} size={46} />
            <AppText variant="caption" weight="medium" center>
              {q.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {today && today.subjects.length > 0 && (
        <Card>
          <CardTitle
            title="سهم درس‌های امروز"
            icon="book"
            tone="pink"
            right={<Pill label={`${toFaDigits(today.subjects.length)} درس`} />}
          />
          <SubjectBars items={today.subjects} />
        </Card>
      )}

      {upcoming && (
        <Card onPress={() => nav.navigate('Tabs', { screen: 'Schedule' })}>
          <Row gap={spacing.md}>
            <IconBadge name="eventCheck" tone="cyan" size={44} />
            <View style={{ flex: 1 }}>
              <AppText variant="caption" muted>
                نوبت بعدی
              </AppText>
              <AppText weight="bold">
                {upcoming.block.activity !== 'study'
                  ? upcoming.block.activity_name ?? 'نوبت'
                  : upcoming.block.subject_name ??
                    subjects.find(x => String(x.id) === settings.last_subject_id)?.name ??
                    'نوبت مطالعه'}
              </AppText>
              <AppText variant="caption" muted>
                {upcomingDays === 0 ? 'امروز' : upcomingDays === 1 ? 'فردا' : WEEKDAYS[weekdayIndex(upcoming.at)]}{' '}
                {formatMinuteOfDay(upcoming.block.start_minute)} · {formatDurationFa(upcoming.block.duration_minutes)}
              </AppText>
            </View>
            <Icon name="forward" color={colors.textMuted} />
          </Row>
        </Card>
      )}
    </Screen>
  );
}

/** F11: days left to the Konkur. The date is always user-set, never hard-coded. */
function Countdown({ now }: { now: number }) {
  const { settings, setSetting } = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  const [picker, setPicker] = useState(false);
  const exam = Number(settings.exam_date) || 0;

  if (settings.exam_countdown_hidden === '1') return null;

  const pickerEl = (
    <JalaliDatePicker
      visible={picker}
      value={exam || null}
      onClose={() => setPicker(false)}
      onPick={ms => {
        setSetting('exam_date', String(ms));
        setSetting('exam_countdown_hidden', '0');
      }}
      title="تاریخ کنکور"
      minYear={toJalali(now).jy}
    />
  );

  if (!exam) {
    return (
      <Card onPress={() => setPicker(true)} tone="tint">
        <Row gap={spacing.md}>
          <IconBadge name="calendar" />
          <AppText weight="bold" style={{ flex: 1 }}>
            تاریخ کنکورت را وارد کن
          </AppText>
          <Icon name="forward" color={colors.textMuted} />
        </Row>
        {pickerEl}
      </Card>
    );
  }

  const days = daysBetween(now, exam);
  if (days < 0) {
    return (
      <Card>
        <AppText weight="bold">تاریخ کنکور گذشت</AppText>
        <AppText variant="caption" muted>
          برای کنکور بعدی تاریخ تازه بگذار یا شمارش را پنهان کن.
        </AppText>
        <Row>
          <Button title="تاریخ تازه" size="sm" onPress={() => setPicker(true)} />
          <Button title="پنهان کن" size="sm" variant="ghost" onPress={() => setSetting('exam_countdown_hidden', '1')} />
        </Row>
        {pickerEl}
      </Card>
    );
  }

  return (
    <Pressable onPress={() => setPicker(true)} style={s.countdown}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="caption" color="rgba(255,255,255,0.8)">
          کنکور سراسری
        </AppText>
        <AppText weight="bold" color="#FFFFFF">
          {formatJalaliDate(exam)}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.8)">
          {days === 0 ? 'امروز روز کنکور است. موفق باشی!' : 'در مسیر موفقیت'}
        </AppText>
      </View>
      <View style={{ alignItems: 'center' }}>
        <AppText variant="display" color="#FFFFFF" style={s.bigNumber}>
          {toFaDigits(days)}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.85)">
          روز تا کنکور
        </AppText>
      </View>
      {pickerEl}
    </Pressable>
  );
}

const useStyles = makeStyles(c => ({
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.card,
  },
  bigNumber: { fontSize: 44, lineHeight: 58 },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
    alignItems: 'flex-start',
    minHeight: 112,
    justifyContent: 'space-between',
  },
  tileValue: { fontFamily: 'Vazirmatn-Bold', fontSize: 24, lineHeight: 36 },
  flame: { marginVertical: -7 }, // 34px animation in the 20px icon's place
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quick: { flex: 1, alignItems: 'center', gap: 6 },
  pressed: { transform: [{ scale: 0.94 }] },
  activeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: c.primary, borderColor: c.primary },
  activeStrict: { backgroundColor: c.strict, borderColor: c.strict },
}));
