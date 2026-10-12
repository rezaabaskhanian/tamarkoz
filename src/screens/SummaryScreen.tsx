import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNav, type RootStackParamList } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { Celebration } from '../components/Celebration';
import { Icon } from '../components/Icon';
import { NumberInput } from '../components/Pickers';
import { Screen } from '../components/Screen';
import { Button, Card, CardTitle, IconBadge, Pill, Row, Stepper, SubjectDot } from '../components/ui';
import { activityInfo, BREAK_TIPS } from '../activities';
import { getSessionByNativeId, sessionsBetween, setTestsCount, type SessionMaybeSubject } from '../db/sessions';
import { deleteThought, listThoughts, type Thought } from '../db/thoughts';
import { kindLabel } from '../db/topics';
import { focus, type FinishedSession } from '../native/focus';
import { showAlert } from '../components/Dialog';
import { addDays, startOfDay } from '../utils/jalali';
import { useApp } from '../state/AppContext';
import { fonts, makeStyles, radius, spacing, useTheme } from '../theme';
import { useDataQuery } from '../app/hooks';
import { todaySummary } from '../services/reports';
import { formatDurationFa, toFaDigits } from '../utils/digits';
import { FREE_BLOCKED_APPS_LIMIT } from '../config';

const REASON: Record<FinishedSession['endReason'], string> = {
  completed: 'جلسه کامل شد 🎉',
  ended_early: 'جلسه زودتر تمام شد',
  emergency: 'جلسه با خروج اضطراری تمام شد',
  broken: 'قفل از کار افتاد و جلسه بسته شد',
};

export function SummaryScreen() {
  const nav = useNav();
  const route = useRoute<RouteProp<RootStackParamList, 'Summary'>>();
  const { bumpData, dataVersion, blockedApps, isPremium, refreshActive, settings } = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  const [finished, setFinished] = useState<FinishedSession | null>(null);
  const [row, setRow] = useState<SessionMaybeSubject | null>(null);
  const [tests, setTests] = useState<number | null>(null);
  // Re-read once the session has been copied into SQLite (dataVersion), so it is included.
  const today = useDataQuery(async () => (await todaySummary()).total, [dataVersion]);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [clearedThoughts, setClearedThoughts] = useState(false);
  const [resting, setResting] = useState(false);

  useEffect(() => {
    listThoughts(finished?.nativeId).then(setThoughts).catch(() => {});
  }, [finished?.nativeId]);

  // «برد اول روز»: today's first study session ran 60+ minutes to the end.
  const firstWin = useDataQuery(async () => {
    if (!finished || finished.endReason !== 'completed' || finished.actualSeconds < 60 * 60) return false;
    if (finished.activity && finished.activity !== 'study') return false;
    const from = startOfDay(finished.startedAt);
    const rows = await sessionsBetween(from, addDays(from, 1));
    return !rows.some(r => r.source !== 'manual_log' && r.started_at < finished.startedAt);
  }, [finished?.nativeId, dataVersion]);

  const doneThought = async (id: number) => {
    await deleteThought(id);
    setThoughts(t => {
      const rest = t.filter(x => x.id !== id);
      if (rest.length === 0) setClearedThoughts(true);
      return rest;
    });
  };

  /** 15 phone-free minutes: the lock stays on, the break is real. */
  const startBreak = async () => {
    if (resting) return;
    setResting(true);
    try {
      await saveTests();
      const r = await focus.start({
        subjectId: -1,
        subjectName: '',
        topic: '',
        kind: 'study',
        activity: 'rest',
        activityName: 'استراحت بدون گوشی',
        mode: 'normal',
        plannedMinutes: 15,
        blocked: blockedApps.slice(0, isPremium ? undefined : FREE_BLOCKED_APPS_LIMIT).map(a => a.package_name),
        source: 'manual',
      });
      if (!r.ok) {
        if (r.error === 'missing_permissions') nav.navigate('Permissions', { flow: 'fix' });
        else showAlert('استراحت شروع نشد', r.error === 'no_apps' ? 'هیچ اپ ممنوعی انتخاب نشده.' : r.error);
        return;
      }
      await refreshActive();
      nav.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'ActiveSession' }] });
    } finally {
      setResting(false);
    }
  };

  useEffect(() => {
    focus.lastFinished().then(f => {
      if (f && (!route.params?.nativeId || f.nativeId === route.params.nativeId)) setFinished(f);
    });
  }, [route.params?.nativeId]);

  // The row appears once the native result has been copied into SQLite.
  useEffect(() => {
    if (!finished?.recorded) return;
    getSessionByNativeId(finished.nativeId).then(r => {
      setRow(r);
      if (r?.tests_count != null) setTests(r.tests_count);
    });
  }, [finished, dataVersion]);

  const saveTests = async () => {
    if (row && tests !== row.tests_count) {
      await setTestsCount(row.id, tests);
      bumpData();
    }
  };

  const leave = async (to: 'start' | 'home') => {
    await saveTests();
    if (to === 'start') nav.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'StartSession' }] });
    else nav.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  if (!finished) {
    return (
      <Screen title="خلاصه‌ی جلسه">
        <Card>
          <AppText>جلسه‌ای برای نمایش نیست.</AppText>
          <Button title="خانه" onPress={() => leave('home')} />
        </Card>
      </Screen>
    );
  }

  const minutes = Math.floor(finished.actualSeconds / 60);
  const goalSec = (Number(settings.daily_goal_minutes) || 0) * 60;
  // This very session took today over the daily goal.
  const goalReached =
    goalSec > 0 &&
    (!finished.activity || finished.activity === 'study') &&
    finished.recorded &&
    today != null &&
    today >= goalSec &&
    today - finished.actualSeconds < goalSec;
  const isStudy = !finished.activity || finished.activity === 'study';
  const act = activityInfo(finished.activity ?? 'study', finished.activityName);
  const completed = finished.endReason === 'completed';
  return (
    <Screen
      footer={
        <>
          <Button title="ثبت و شروع جلسه‌ی بعدی" size="lg" icon="lock" onPress={() => leave('start')} />
          <Button title="بازگشت به خانه" variant="secondary" icon="home" onPress={() => leave('home')} />
        </>
      }
    >
      <Card tone="tint" style={s.hero}>
        {completed && <Celebration kind="courseDone" style={s.confetti} />}
        {completed ? (
          <Celebration kind="correct" size={110} />
        ) : finished.endReason === 'broken' ? (
          <Celebration kind="wrong" size={110} />
        ) : (
          <View style={[s.icon, { backgroundColor: colors.surface }]}>
            <Icon name="check" size={40} color={colors.textMuted} />
          </View>
        )}
        <AppText variant="title" center>
          {REASON[finished.endReason]}
        </AppText>
        {completed && (
          <AppText muted center>
            {isStudy ? 'آفرین! یک گام دیگر به هدفت نزدیک‌تر شدی.' : `${act.label} بدون گوشی؛ آفرین!`}
          </AppText>
        )}
      </Card>

      {goalReached && (
        <Card style={[s.cleared, { backgroundColor: colors.strictSoft }]}>
          <Celebration kind="goal" size={120} />
          <AppText weight="bold" color={colors.strict} center>
            هدف امروز کامل شد 🎯
          </AppText>
          <AppText variant="caption" muted center>
            {formatDurationFa(goalSec / 60)} مطالعه؛ هر چه از اینجا بخوانی، اضافه است.
          </AppText>
        </Card>
      )}

      {firstWin && (
        <Card style={{ backgroundColor: colors.orangeSoft }}>
          <Row gap={spacing.md}>
            <IconBadge name="trophy" tone="orange" size={44} />
            <View style={{ flex: 1 }}>
              <AppText weight="bold" color={colors.orange}>
                برد اول روز 🏆
              </AppText>
              <AppText variant="caption" muted>
                اولین جلسه‌ی امروز را تا آخر ماندی. ذهنت حالا می‌داند که از پسش برمی‌آیی.
              </AppText>
            </View>
          </Row>
        </Card>
      )}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row>
            <SubjectDot color={isStudy ? row?.subject_color ?? colors.primary : act.color} size={12} />
            <View>
              <AppText weight="bold" variant="subtitle">
                {isStudy ? finished.subjectName : act.label}
              </AppText>
              {finished.topic ? (
                <AppText variant="caption" muted>
                  {finished.topic}
                </AppText>
              ) : null}
            </View>
          </Row>
          <Row gap={4}>
            {isStudy && <Pill label={kindLabel(finished.kind)} tone="primary" />}
            {finished.mode === 'strict' && <Pill label="سخت" icon="lock" tone="strict" />}
          </Row>
        </Row>
        <View style={s.durationBox}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" muted>
              {isStudy ? 'مدت خالص مطالعه' : 'مدت بدون گوشی'}
            </AppText>
            <AppText style={s.duration} color={colors.primary}>
              {formatDurationFa(minutes)}
            </AppText>
          </View>
          <IconBadge name="timer" size={52} />
        </View>
        {completed && finished.blockedAttempts === 0 && (
          <Row>
            <Icon name="shield" size={18} color={colors.success} />
            <AppText variant="caption" weight="medium" color={colors.success}>
              بدون حتی یک بار سر زدن به اپ ممنوع
            </AppText>
          </Row>
        )}
        {finished.blockedAttempts > 0 && (
          <Row>
            <Icon name="shield" size={18} color={colors.success} />
            <AppText variant="caption" weight="medium" color={colors.success} style={{ flex: 1 }}>
              {toFaDigits(finished.blockedAttempts)} بار وسوسه شدی و مقاومت کردی 💪 به مغزت نشان دادی رئیس کیست.
            </AppText>
          </Row>
        )}
      </Card>

      <View style={s.stats}>
        <Card style={s.stat}>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="caption" muted>
              زمان تعیین‌شده
            </AppText>
            <Icon name="clock" size={18} color={colors.primary} />
          </Row>
          <AppText variant="subtitle" weight="bold">
            {formatDurationFa(finished.plannedMinutes)}
          </AppText>
        </Card>
        <Card style={s.stat}>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="caption" muted>
              مقاومت در برابر وسوسه
            </AppText>
            <Icon name="shield" size={18} color={colors.success} />
          </Row>
          <AppText variant="subtitle" weight="bold">
            {toFaDigits(finished.blockedAttempts)} بار
          </AppText>
        </Card>
      </View>

      {!finished.recorded ? (
        <AppText muted center>
          جلسه‌ی کمتر از یک دقیقه ثبت نمی‌شود.
        </AppText>
      ) : !isStudy ? null : (
        <Card>
          <CardTitle title="چند تا تست زدی؟" subtitle="اختیاری · جمع هفتگی در گزارش می‌آید" icon="edit" />
          <Stepper
            value={toFaDigits(tests ?? 0)}
            label="تست"
            onPlus={() => setTests(t => (t ?? 0) + 5)}
            onMinus={() => setTests(t => Math.max(0, (t ?? 0) - 5))}
          />
          <NumberInput value={tests} onChange={setTests} placeholder="یا عدد دقیق را بنویس" maxLength={4} />
        </Card>
      )}

      {completed && finished.activity !== 'rest' && finished.actualSeconds >= 45 * 60 && (
        <Card>
          <CardTitle
            title="وقت یک استراحت واقعی"
            subtitle="۱۵ دقیقه، ولی بدون گوشی؛ قفل روشن می‌ماند"
            icon="coffee"
            tone="success"
          />
          <View style={s.tips}>
            {BREAK_TIPS.map(t => (
              <Pill key={t.text} label={t.text} icon={t.icon} tone="success" />
            ))}
          </View>
          <Button title="شروع استراحت ۱۵ دقیقه‌ای" icon="coffee" variant="secondary" loading={resting} onPress={startBreak} />
        </Card>
      )}

      {thoughts.length > 0 && (
        <Card>
          <CardTitle
            title="وقت فکر کردن"
            subtitle="۱۰ دقیقه، جایی غیر از میز درس. هر کدام را که فکرش را کردی، تیک بزن."
            icon="note"
            tone="orange"
          />
          {thoughts.map(t => (
            <Row key={t.id} style={s.thought}>
              <AppText style={{ flex: 1 }}>{t.text}</AppText>
              <Button title="فکر کردم" size="sm" variant="secondary" icon="check" onPress={() => doneThought(t.id)} />
            </Row>
          ))}
        </Card>
      )}

      {clearedThoughts && thoughts.length === 0 && (
        <Card style={s.cleared}>
          <Celebration kind="reviewDone" style={s.reviewDone} />
          <AppText weight="bold" center>
            ذهنت سبک شد 🌿
          </AppText>
          <AppText variant="caption" muted center>
            همه‌ی فکرهای این جلسه را مرور کردی؛ با ذهن آزاد برو سراغ جلسه‌ی بعدی.
          </AppText>
        </Card>
      )}

      {today != null && today > 0 && (
        <Card tone="strict">
          <Row gap={spacing.md}>
            <IconBadge name="flame" tone="warning" />
            <View>
              <AppText variant="caption" muted>
                مجموع مطالعه‌ی امروز تا الان
              </AppText>
              <AppText weight="bold" variant="subtitle">
                {formatDurationFa(Math.floor(today / 60))} 🔥
              </AppText>
            </View>
          </Row>
        </Card>
      )}
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  hero: { alignItems: 'center', paddingVertical: spacing.lg, overflow: 'hidden' },
  confetti: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  cleared: { alignItems: 'center' },
  reviewDone: { width: 150, height: 200 },
  icon: { width: 84, height: 84, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  durationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  duration: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 44 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1 },
  tips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thought: {
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingRight: spacing.md,
  },
}));
