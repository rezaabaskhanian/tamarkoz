import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNav } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { Icon, type IconName } from '../components/Icon';
import { JalaliDatePicker } from '../components/Pickers';
import { Screen } from '../components/Screen';
import { Button, Callout, Card, IconBadge, Pill, Row, Stepper } from '../components/ui';
import { seedSubjects, type Field } from '../db/subjects';
import { useApp } from '../state/AppContext';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { formatDurationFa, toFaDigits } from '../utils/digits';
import { formatJalaliDate, toJalali } from '../utils/jalali';

// F01 — visual design from memory/ui/_9 and _10.

const INTRO: { icon: IconName; tag: string; title: string; text: string }[] = [
  {
    icon: 'lock',
    tag: '۷ روز همه‌ی امکانات رایگان',
    title: 'کنکور، میدان تمرکز عمیق است',
    text: 'در زمان مطالعه اینستاگرام و تلگرام و بازی‌ها قفل می‌شوند. تماس و پیامک همیشه بازند.',
  },
  {
    icon: 'timer',
    tag: 'ثبت خودکار',
    title: 'ساعت مطالعه‌ات خودش ثبت می‌شود',
    text: 'هر جلسه با درسش ذخیره می‌شود و می‌بینی امروز و این هفته چقدر خواندی.',
  },
  {
    icon: 'calendar',
    tag: 'همه‌چیز روی گوشی خودت',
    title: 'روزهای مانده تا کنکور',
    text: 'شمارش معکوس همیشه جلوی چشمت است. هیچ داده‌ای از گوشی بیرون نمی‌رود.',
  },
];

const FIELD_CARDS: { id: Field; letter: string; title: string; hint: string }[] = [
  { id: 'tajrobi', letter: 'ت', title: 'علوم تجربی', hint: 'زیست‌شناسی، شیمی، فیزیک' },
  { id: 'riazi', letter: 'ر', title: 'ریاضی و فیزیک', hint: 'ریاضیات، فیزیک، شیمی' },
  { id: 'ensani', letter: 'ا', title: 'علوم انسانی', hint: 'ادبیات، عربی، منطق' },
  { id: 'honar', letter: 'هـ', title: 'هنر', hint: 'درس‌هایت را خودت می‌سازی' },
  { id: 'zaban', letter: 'ز', title: 'زبان', hint: 'درس‌هایت را خودت می‌سازی' },
  { id: 'other', letter: 'س', title: 'سایر', hint: 'درس‌هایت را خودت می‌سازی' },
];

const SETUP_STEPS = 3; // field, exam date, daily goal

export function OnboardingScreen() {
  const nav = useNav();
  const { setSetting, reloadSubjects } = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  const [step, setStep] = useState(0);
  const [field, setField] = useState<Field | null>(null);
  const [exam, setExam] = useState<number | null>(null);
  const [goal, setGoal] = useState(240);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    if (!field) return;
    setBusy(true);
    await setSetting('field', field);
    if (exam) await setSetting('exam_date', String(exam));
    await setSetting('daily_goal_minutes', String(goal));
    await seedSubjects(field);
    await reloadSubjects();
    setBusy(false);
    nav.navigate('Permissions', { flow: 'onboarding' });
  };

  const progress = (current: number, total: number) => (
    <Row gap={6}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[s.dash, i <= current && { backgroundColor: colors.primary }, i === current && s.dashActive]} />
      ))}
    </Row>
  );

  if (step < INTRO.length) {
    const it = INTRO[step];
    return (
      <Screen
        scroll={false}
        footer={
          <Button
            title={step === INTRO.length - 1 ? 'شروع مسیر تمرکز' : 'بعدی'}
            size="lg"
            onPress={() => setStep(step + 1)}
          />
        }
      >
        <Row style={{ justifyContent: 'space-between' }}>
          {progress(step, INTRO.length)}
          <Pressable onPress={() => setStep(INTRO.length)} hitSlop={12}>
            <AppText muted>رد شدن</AppText>
          </Pressable>
        </Row>
        <View style={s.intro}>
          <View style={s.heroIcon}>
            <Icon name={it.icon} size={56} color={colors.primary} />
          </View>
          <Pill label={it.tag} tone="primary" />
          <AppText variant="title" style={s.headline}>
            {it.title}
          </AppText>
          <AppText muted style={{ fontSize: 16, lineHeight: 28 }}>
            {it.text}
          </AppText>
        </View>
      </Screen>
    );
  }

  const setup = step - INTRO.length; // 0 field, 1 exam, 2 goal
  const header = (
    <Row style={{ justifyContent: 'space-between' }}>
      <Pill label={`گام ${toFaDigits(setup + 1)} از ${toFaDigits(SETUP_STEPS)}`} tone="primary" dot={colors.primary} />
      {setup > 0 && (
        <Pressable onPress={() => setStep(step - 1)} hitSlop={12} accessibilityLabel="قبلی">
          <Icon name="back" color={colors.textMuted} />
        </Pressable>
      )}
    </Row>
  );

  if (setup === 0) {
    return (
      <Screen footer={<Button title="بعدی" size="lg" disabled={!field} onPress={() => setStep(step + 1)} />}>
        {header}
        <AppText variant="title" style={s.headline}>
          رشته‌ی تحصیلی‌ات را انتخاب کن
        </AppText>
        <AppText muted>فهرست درس‌ها از رشته ساخته می‌شود؛ بعداً در تنظیمات قابل تغییر است.</AppText>
        <View style={s.fieldGrid}>
          {FIELD_CARDS.map(f => {
            const on = field === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setField(f.id)}
                accessibilityState={{ selected: on }}
                style={[s.fieldCard, on && s.fieldCardOn]}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={[s.letter, on && { backgroundColor: colors.primaryDeep }]}>
                    <AppText weight="bold" color={on ? '#FFFFFF' : colors.primary}>
                      {f.letter}
                    </AppText>
                  </View>
                  <View style={[s.radio, on && { borderColor: colors.primaryDeep }]}>
                    {on && <Icon name="check" size={14} color={colors.primaryDeep} />}
                  </View>
                </Row>
                <AppText weight="bold" variant="subtitle">
                  {f.title}
                </AppText>
                <AppText variant="caption" muted>
                  {f.hint}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Screen>
    );
  }

  if (setup === 1) {
    return (
      <Screen
        footer={
          <>
            <Button title="بعدی" size="lg" disabled={!exam} onPress={() => setStep(step + 1)} />
            <Button title="بعداً" variant="ghost" onPress={() => setStep(step + 1)} />
          </>
        }
      >
        {header}
        <AppText variant="title" style={s.headline}>
          تاریخ کنکورت کی است؟
        </AppText>
        <AppText muted>تاریخ دقیق هر سال اعلام می‌شود؛ هر وقت خواستی در تنظیمات عوضش کن.</AppText>
        <Card onPress={() => setPicker(true)}>
          <Row gap={spacing.md}>
            <IconBadge name="calendar" size={44} />
            <View style={{ flex: 1 }}>
              <AppText variant="caption" muted>
                تاریخ کنکور
              </AppText>
              <AppText weight="bold" variant="subtitle">
                {exam ? formatJalaliDate(exam) : 'انتخاب تاریخ'}
              </AppText>
            </View>
            <Icon name="forward" color={colors.textMuted} />
          </Row>
        </Card>
        <JalaliDatePicker
          visible={picker}
          value={exam}
          onClose={() => setPicker(false)}
          onPick={setExam}
          title="تاریخ کنکور"
          minYear={toJalali(Date.now()).jy}
        />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title="ادامه و تنظیم دسترسی‌ها" size="lg" loading={busy} onPress={finish} />}>
      {header}
      <AppText variant="title" style={s.headline}>
        روزانه چند ساعت مطالعه می‌خواهی؟
      </AppText>
      <AppText muted>هدف منطقی بگذار؛ پیوستگی از شدت مهم‌تر است.</AppText>
      <Card>
        <AppText variant="caption" muted center>
          هدف هر روز
        </AppText>
        <AppText style={s.goal} center color={colors.text}>
          {formatDurationFa(goal)}
        </AppText>
        <Stepper
          value={toFaDigits(goal / 60)}
          label="ساعت"
          onPlus={() => setGoal(g => Math.min(14 * 60, g + 30))}
          onMinus={() => setGoal(g => Math.max(60, g - 30))}
        />
      </Card>
      <Callout text="هر روز که به هدفت برسی، به زنجیره‌ی روزهای پیاپی اضافه می‌شود. بعداً در تنظیمات قابل تغییر است." icon="flame" tone="warning" />
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  intro: { flex: 1, justifyContent: 'center', gap: spacing.md },
  heroIcon: {
    alignSelf: 'center',
    width: 140,
    height: 140,
    borderRadius: 44,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  headline: { fontSize: 26, lineHeight: 40 },
  dash: { width: 8, height: 6, borderRadius: 3, backgroundColor: c.border },
  dashActive: { width: 28 },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 4 },
  fieldCard: {
    flexBasis: '46%',
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: c.border,
    padding: spacing.md,
    gap: 6,
    boxShadow: c.shadow,
  },
  fieldCardOn: { borderColor: c.primaryDeep, backgroundColor: c.surfaceAlt },
  letter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goal: { fontFamily: 'Vazirmatn-Bold', fontSize: 34, lineHeight: 50 },
}));
