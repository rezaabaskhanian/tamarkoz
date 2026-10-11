import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNav, type RootStackParamList } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { Icon } from '../components/Icon';
import { NumberInput } from '../components/Pickers';
import { Screen } from '../components/Screen';
import { Button, Card, CardTitle, IconBadge, Pill, Row, Stepper, SubjectDot } from '../components/ui';
import { getSessionByNativeId, setTestsCount, type SessionWithSubject } from '../db/sessions';
import { focus, type FinishedSession } from '../native/focus';
import { useApp } from '../state/AppContext';
import { fonts, makeStyles, radius, spacing, useTheme } from '../theme';
import { useDataQuery } from '../app/hooks';
import { todaySummary } from '../services/reports';
import { formatDurationFa, toFaDigits } from '../utils/digits';

const REASON: Record<FinishedSession['endReason'], string> = {
  completed: 'جلسه کامل شد 🎉',
  ended_early: 'جلسه زودتر تمام شد',
  emergency: 'جلسه با خروج اضطراری تمام شد',
  broken: 'قفل از کار افتاد و جلسه بسته شد',
};

export function SummaryScreen() {
  const nav = useNav();
  const route = useRoute<RouteProp<RootStackParamList, 'Summary'>>();
  const { bumpData, dataVersion } = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  const [finished, setFinished] = useState<FinishedSession | null>(null);
  const [row, setRow] = useState<SessionWithSubject | null>(null);
  const [tests, setTests] = useState<number | null>(null);
  const today = useDataQuery(async () => (await todaySummary()).total, []);

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
        <View style={[s.icon, { backgroundColor: completed ? colors.successSoft : colors.surface }]}>
          <Icon
            name={finished.endReason === 'broken' ? 'warning' : 'check'}
            size={40}
            color={completed ? colors.success : colors.textMuted}
          />
        </View>
        <AppText variant="title" center>
          {REASON[finished.endReason]}
        </AppText>
        {completed && (
          <AppText muted center>
            آفرین! یک گام دیگر به هدفت نزدیک‌تر شدی.
          </AppText>
        )}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row>
            <SubjectDot color={row?.subject_color ?? colors.primary} size={12} />
            <AppText weight="bold" variant="subtitle">
              {finished.subjectName}
            </AppText>
          </Row>
          {finished.mode === 'strict' && <Pill label="حالت سخت" icon="lock" tone="strict" />}
        </Row>
        <View style={s.durationBox}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" muted>
              مدت خالص مطالعه
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
              ورود به اپ ممنوع
            </AppText>
            <Icon name="shield" size={18} color={finished.blockedAttempts ? colors.warning : colors.success} />
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
      ) : (
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
  hero: { alignItems: 'center', paddingVertical: spacing.lg },
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
}));
