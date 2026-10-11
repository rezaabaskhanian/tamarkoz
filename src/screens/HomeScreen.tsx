import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useDataQuery, useLiveSession, useNow } from '../app/hooks';
import { useNav } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { ProgressRing, SubjectBars } from '../components/Charts';
import { Icon } from '../components/Icon';
import { JalaliDatePicker } from '../components/Pickers';
import { Screen } from '../components/Screen';
import { Banner, Button, Card, CardTitle, IconBadge, Pill, Row } from '../components/ui';
import { listBlocks } from '../db/schedule';
import { FIELDS } from '../db/subjects';
import { focus } from '../native/focus';
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

/** F10 home — layout from memory/ui/_1. */
export function HomeScreen() {
  const nav = useNav();
  const { permissions, settings, isPremium, subjects } = useApp();
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
  const liveSec =
    active && startOfDay(active.startedAt) === startOfDay(now) ? Math.floor(active.studiedMs / 1000) : 0;
  const totalMin = Math.floor((todaySec + liveSec) / 60);
  const field = FIELDS.find(f => f.id === settings.field)?.label;
  const upcomingDays = upcoming ? daysBetween(now, upcoming.at) : 0;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <IconBadge name="target" size={38} />
          <View>
            <AppText weight="bold">تمرکز</AppText>
            <AppText variant="caption" muted>
              داشبورد روزانه
            </AppText>
          </View>
        </Row>
      </Row>

      <View style={{ gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="title">سلام 👋</AppText>
          {field ? <Pill label={field} tone="primary" /> : null}
        </Row>
        <AppText muted variant="caption">
          {formatJalaliDateWithWeekday(now)}
        </AppText>
      </View>

      {!hasRequiredPermissions(permissions) && permissions && (
        <Banner
          text="دسترسی قفل خودکار غیرفعال است"
          action="فعال‌سازی"
          onPress={() => nav.navigate('Permissions', { flow: 'fix' })}
        />
      )}

      <Countdown now={now} />

      <Card>
        <Row style={{ alignItems: 'center' }} gap={spacing.md}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText muted variant="caption">
              مطالعه‌ی امروز
            </AppText>
            <Row gap={6} style={{ alignItems: 'baseline' }}>
              <AppText variant="display" style={s.bigNumber}>
                {formatHMFa(totalMin)}
              </AppText>
              <AppText muted>ساعت</AppText>
            </Row>
            {goal > 0 ? (
              <AppText variant="caption" muted>
                از {formatDurationFa(goal)} هدف
              </AppText>
            ) : (
              <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Settings' })}>
                <AppText variant="caption" color={colors.primary}>
                  هدف روزانه بگذار
                </AppText>
              </Pressable>
            )}
            <Row style={{ marginTop: 6 }}>
              {streak && streak.days > 0 ? <Pill label={`${toFaDigits(streak.days)} روز پیاپی 🔥`} tone="warning" /> : null}
              {totalMin > 0 && (
                <Pressable
                  hitSlop={8}
                  accessibilityLabel="اشتراک‌گذاری"
                  onPress={() =>
                    focus.shareCard({
                      title: 'مطالعه‌ی امروز',
                      value: formatDurationFa(totalMin),
                      subtitle: formatJalaliDateWithWeekday(now),
                      detail: streak && streak.days > 1 ? `${toFaDigits(streak.days)} روز پیاپی به هدف رسیدم` : '',
                    })
                  }
                >
                  <Pill label="اشتراک" icon="share" tone="primary" />
                </Pressable>
              )}
            </Row>
          </View>
          {goal > 0 && (
            <ProgressRing progress={totalMin / goal} size={96} stroke={10} color={colors.success}>
              <AppText weight="bold">{toFaDigits(Math.min(100, Math.round((totalMin / goal) * 100)))}٪</AppText>
            </ProgressRing>
          )}
        </Row>
      </Card>

      {active ? (
        <Card onPress={() => nav.navigate('ActiveSession')} style={active.mode === 'strict' ? s.activeStrict : s.active}>
          <Row>
            <Icon name="lock" color="#FFFFFF" />
            <View style={{ flex: 1 }}>
              <AppText weight="bold" color="#FFFFFF">
                جلسه‌ی در حال اجرا · {active.subjectName}
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
      <Button title="ثبت دستی ساعت مطالعه" variant="ghost" size="sm" icon="add" onPress={() => nav.navigate('ManualLog')} />

      {today && today.subjects.length > 0 && (
        <Card>
          <CardTitle
            title="سهم درس‌های امروز"
            right={<Pill label={`${toFaDigits(today.subjects.length)} درس`} />}
          />
          <SubjectBars items={today.subjects} />
        </Card>
      )}

      {upcoming && (
        <Card onPress={() => nav.navigate('Tabs', { screen: 'Schedule' })} tone="tint">
          <Row gap={spacing.md}>
            <IconBadge name="calendar" tone="primary" />
            <View style={{ flex: 1 }}>
              <AppText variant="caption" muted>
                نوبت بعدی مطالعه
              </AppText>
              <AppText weight="bold">
                {upcoming.block.subject_name ??
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
  active: { backgroundColor: c.primary, borderColor: c.primary },
  activeStrict: { backgroundColor: c.strict, borderColor: c.strict },
}));
