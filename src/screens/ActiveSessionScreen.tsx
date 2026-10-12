import { useRoute, type RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLiveSession } from '../app/hooks';
import { useNav, type RootStackParamList } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { ProgressRing } from '../components/Charts';
import { Icon } from '../components/Icon';
import { TextField } from '../components/Pickers';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Button, Card, CardTitle, IconBadge, Pill, Row } from '../components/ui';
import { EMERGENCY_WAIT_SECONDS, EXTEND_MINUTES } from '../config';
import { activityInfo, BREAK_TIPS } from '../activities';
import { addThought, countThoughts } from '../db/thoughts';
import { kindLabel } from '../db/topics';
import { focus } from '../native/focus';
import { useApp } from '../state/AppContext';
import { fonts, makeStyles, radius, spacing, useTheme } from '../theme';
import { formatClockFa, toFaDigits } from '../utils/digits';
import { formatTimeOfDay } from '../utils/jalali';
import { showAlert } from '../components/Dialog';

/** Deep focus («flow») usually only starts after this much unbroken work. */
const FLOW_MINUTES = 25;

const QUOTES = [
  'هدف تو ارزش این تلاش را دارد؛ تمرکزت را حفظ کن.',
  'هر دقیقه‌ی تمرکز، یک قدم نزدیک‌تر به کنکور.',
  'گوشی صبر می‌کند؛ کنکور نه.',
];

export function ActiveSessionScreen() {
  const nav = useNav();
  const route = useRoute<RouteProp<RootStackParamList, 'ActiveSession'>>();
  const { refreshActive, settings } = useApp();
  const active = useLiveSession();
  const { colors } = useTheme();
  const s = useStyles();
  const [busy, setBusy] = useState(false);
  const [emergency, setEmergency] = useState<{ usedToday: boolean; releaseAt: number } | null>(null);
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const [thought, setThought] = useState('');
  const [thoughts, setThoughts] = useState(0);

  useEffect(() => {
    if (active?.id) countThoughts(active.id).then(setThoughts).catch(() => {});
  }, [active?.id]);

  const saveThought = async () => {
    if (!thought.trim() || !active) return;
    await addThought(thought, active.id);
    setThought('');
    setThoughtOpen(false);
    setThoughts(n => n + 1);
  };

  const strict = active?.mode === 'strict';

  useEffect(() => {
    if (strict) focus.emergencyStatus().then(setEmergency).catch(() => {});
  }, [strict, active?.state]);

  const goHome = useCallback(() => {
    if (nav.canGoBack()) nav.goBack();
    else nav.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  }, [nav]);

  const confirmEndEarly = useCallback(() => {
    if (!active || active.mode !== 'normal') return;
    showAlert(
      'پایان زودهنگام؟',
      `هنوز ${formatClockFa(Math.floor(active.remainingMs / 1000))} از جلسه مانده. زمانی که خواندی ثبت می‌شود.`,
      [
        { text: 'ادامه می‌دهم', style: 'cancel' },
        {
          text: 'پایان جلسه',
          style: 'destructive',
          onPress: async () => {
            const r = await focus.endEarly();
            if (!r.ok) showAlert('خطا', 'جلسه بسته نشد.');
          },
        },
      ],
    );
  }, [active]);

  // From the lock screen's «پایان جلسه» link (normal mode only).
  const askedEnd = useRef(false);
  useEffect(() => {
    if (route.params?.end === '1' && active && !askedEnd.current) {
      askedEnd.current = true;
      if (active.mode === 'normal') confirmEndEarly();
    }
  }, [route.params?.end, active, confirmEndEarly]);

  if (!active) {
    return (
      <Screen title="جلسه" back>
        <Card>
          <AppText>الان جلسه‌ای در حال اجرا نیست.</AppText>
          <Button title="خانه" onPress={goHome} />
        </Card>
      </Screen>
    );
  }

  const remaining = Math.floor(active.remainingMs / 1000);
  const progress = active.plannedMs > 0 ? active.studiedMs / active.plannedMs : 0;
  const onBreak = active.workMs > 0 && active.phase === 'break';
  const waiting = active.state === 'EMERGENCY_WAIT';
  const waitLeft = Math.max(0, EMERGENCY_WAIT_SECONDS - Math.floor(active.emergencyWaitMs / 1000));

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, failMsg: string) => {
    setBusy(true);
    try {
      const r = await fn();
      if (!r.ok) {
        const msg =
          r.error === 'used_today'
            ? 'خروج اضطراری امروز استفاده شده است.'
            : r.error === 'too_early'
              ? 'هنوز ۶۰ ثانیه نگذشته.'
              : failMsg;
        showAlert('انجام نشد', msg);
      }
      await refreshActive();
    } finally {
      setBusy(false);
    }
  };

  const percent = Math.round(progress * 100);
  const endsAt = Date.now() + active.remainingMs;
  const ringColor = onBreak ? colors.success : strict ? colors.strict : colors.primary;
  const quote = settings.motivation.trim()
    ? `یادت هست چرا؟ «${settings.motivation.trim()}»`
    : QUOTES[active.id.charCodeAt(0) % QUOTES.length];
  const isStudy = !active.activity || active.activity === 'study';
  const isRest = active.activity === 'rest';
  const deepWork = isStudy || active.activity === 'deep_work';
  // Minutes of unbroken work so far (a pomodoro cycle restarts the climb into flow).
  const workedMin = Math.floor((active.workMs > 0 && !onBreak ? active.workMs - active.phaseRemainingMs : active.studiedMs) / 60_000);
  const inFlow = workedMin >= FLOW_MINUTES;

  return (
    <Screen title="جلسه‌ی تمرکز" back>
      <Row style={s.wrap}>
        <Pill label={strict ? 'حالت سخت فعال' : 'حالت عادی'} icon={strict ? 'lock' : 'shield'} tone={strict ? 'strict' : 'primary'} solid={strict} />
        {active.activity && active.activity !== 'study' ? (
          <Pill label={activityInfo(active.activity, active.activityName).label} icon={activityInfo(active.activity).icon} tone="strict" />
        ) : (
          <>
            <Pill label={active.topic ? `${active.subjectName} · ${active.topic}` : active.subjectName} icon="book" tone="strict" />
            <Pill label={kindLabel(active.kind)} tone="neutral" />
          </>
        )}
        {active.workMs > 0 && (
          <Pill label={onBreak ? 'پومودورو · استراحت' : 'پومودورو · مطالعه'} tone={onBreak ? 'success' : 'primary'} dot={ringColor} />
        )}
        {active.source === 'schedule' && <Pill label="از برنامه‌ی هفتگی" icon="calendar" />}
        {deepWork && !onBreak && (
          <Pill
            label={inFlow ? 'در تمرکز عمیقی؛ قطعش نکن' : `${toFaDigits(FLOW_MINUTES - workedMin)} دقیقه تا تمرکز عمیق`}
            icon="wave"
            tone={inFlow ? 'cyan' : 'neutral'}
            solid={inFlow}
          />
        )}
      </Row>

      <View style={s.center}>
        <ProgressRing progress={progress} size={268} stroke={12} color={ringColor}>
          <AppText style={s.clock}>
            {formatClockFa(onBreak ? Math.floor(active.phaseRemainingMs / 1000) : remaining)}
          </AppText>
          <AppText muted>
            {onBreak ? 'تا پایان استراحت · اپ‌ها بازند' : active.workMs > 0 ? 'تا استراحت بعدی' : 'زمان باقی‌مانده'}
          </AppText>
        </ProgressRing>
        <View style={s.endPill}>
          <Icon name="clock" size={16} color={colors.primary} />
          <AppText variant="caption">
            {active.workMs > 0
              ? `${formatClockFa(remaining)} مطالعه مانده`
              : `پایان در ساعت ${formatTimeOfDay(endsAt)}`}
          </AppText>
          <View style={s.sep} />
          <AppText variant="caption" weight="bold" color={colors.primary}>
            {toFaDigits(percent)}٪ گذشت
          </AppText>
        </View>
      </View>

      <Card>
        <Row gap={spacing.md}>
          <IconBadge name="shield" tone={active.blockedAttempts > 0 ? 'success' : 'primary'} size={44} />
          <View style={{ flex: 1 }}>
            <AppText weight="bold">سپر تمرکز</AppText>
            <AppText variant="caption" muted>
              {active.blockedAttempts > 0
                ? `${toFaDigits(active.blockedAttempts)} بار وسوسه شدی و برگشتی سر کارت 💪 هر مقاومت، اراده‌ات را قوی‌تر می‌کند.`
                : 'تا الان سراغ هیچ اپ ممنوعی نرفتی 👏'}
            </AppText>
          </View>
          <View style={s.counter}>
            <AppText weight="bold" color={active.blockedAttempts > 0 ? colors.success : colors.primary}>
              {toFaDigits(active.blockedAttempts)}
            </AppText>
            <AppText variant="caption" muted>
              مقاومت
            </AppText>
          </View>
        </Row>
      </Card>

      {isRest && (
        <Card>
          <CardTitle title="استراحت واقعی، بدون گوشی" icon="coffee" tone="success" />
          {BREAK_TIPS.map(t => (
            <Row key={t.text}>
              <Icon name={t.icon} size={18} color={colors.success} />
              <AppText variant="caption">{t.text}</AppText>
            </Row>
          ))}
        </Card>
      )}

      {!isRest && (
        <Card onPress={() => setThoughtOpen(true)}>
          <Row gap={spacing.md}>
            <IconBadge name="note" tone="orange" size={44} />
            <View style={{ flex: 1 }}>
              <AppText weight="bold">کاغذ افکار</AppText>
              <AppText variant="caption" muted>
                {thoughts > 0
                  ? `${toFaDigits(thoughts)} فکر یادداشت شد؛ بعد از جلسه سراغشان برو.`
                  : 'فکری مزاحمت شد؟ بنویس و برگرد سر درس.'}
              </AppText>
            </View>
            <Icon name="add" color={colors.orange} />
          </Row>
        </Card>
      )}

      <Sheet visible={thoughtOpen} onClose={() => setThoughtOpen(false)} title="یک خط بنویس، بعداً بهش فکر کن">
        <TextField
          value={thought}
          onChange={setThought}
          placeholder="مثلاً: فردا برای کلاس چی بپوشم؟"
          maxLength={200}
          autoFocus
        />
        <Button title="یادداشت و برگشت سر درس" icon="check" disabled={!thought.trim()} onPress={saveThought} />
      </Sheet>

      <Card tone="tint" onPress={busy ? undefined : () => run(() => focus.addMinutes(EXTEND_MINUTES), 'زمان اضافه نشد.')}>
        <Row style={{ justifyContent: 'center' }}>
          <Icon name="add" color={colors.primary} />
          <AppText weight="bold" color={colors.primary}>
            {toFaDigits(EXTEND_MINUTES)} دقیقه تمدید
          </AppText>
        </Row>
      </Card>

      {!strict && <Button title="پایان زودهنگام" variant="danger" onPress={confirmEndEarly} />}

      {strict && !waiting && (
        <Card tone="tint">
          <CardTitle
            title="خروج اضطراری"
            icon="warning"
            tone="strict"
            subtitle={
              emergency?.usedToday
                ? `امروز استفاده شده؛ ساعت ${formatTimeOfDay(emergency.releaseAt)} (نیمه‌شب) آزاد می‌شود.`
                : 'روزی یک بار. ۶۰ ثانیه صبر و بعد تأیید دوباره؛ قفل در این مدت برقرار است.'
            }
          />
          <Button
            title="درخواست خروج اضطراری"
            variant="secondary"
            size="sm"
            disabled={busy || emergency?.usedToday !== false}
            onPress={() => run(() => focus.requestEmergency(), 'درخواست ثبت نشد.')}
          />
        </Card>
      )}

      {strict && waiting && (
        <Card tone="strict">
          <CardTitle title="خروج اضطراری" icon="warning" tone="strict" />
          {waitLeft > 0 ? (
            <AppText>
              {toFaDigits(waitLeft)} ثانیه صبر کن… اگر پشیمان شدی، انصراف بزن و ادامه بده.
            </AppText>
          ) : (
            <AppText>زمان انتظار تمام شد. مطمئنی می‌خواهی جلسه را تمام کنی؟ سهم امروزت مصرف می‌شود.</AppText>
          )}
          <Row>
            <Button
              title="تأیید نهایی خروج"
              variant="danger"
              size="sm"
              style={{ flex: 1 }}
              disabled={busy || waitLeft > 0}
              onPress={() => run(() => focus.confirmEmergency(), 'خروج انجام نشد.')}
            />
            <Button
              title="انصراف"
              size="sm"
              style={{ flex: 1 }}
              disabled={busy}
              onPress={() => run(() => focus.cancelEmergency(), 'انصراف ثبت نشد.')}
            />
          </Row>
        </Card>
      )}

      <View style={s.quote}>
        <Icon name="sparkle" size={16} color={colors.warning} />
        <AppText variant="caption" muted>
          {quote}
        </AppText>
      </View>
      <AppText variant="caption" muted center>
        می‌توانی از اپ بیرون بروی؛ زمان باقی‌مانده در اعلان دیده می‌شود.
      </AppText>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  wrap: { flexWrap: 'wrap' },
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  clock: { fontFamily: fonts.bold, fontSize: 56, lineHeight: 72, color: c.text, writingDirection: 'ltr' },
  endPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  sep: { width: 1, height: 14, backgroundColor: c.border },
  counter: {
    alignItems: 'center',
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
}));
