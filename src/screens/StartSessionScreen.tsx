import {
  useFocusEffect,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useDataQuery, usePaywall } from '../app/hooks';
import { useNav, type RootStackParamList } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { NumberInput } from '../components/Pickers';
import { ActivityPicker } from '../components/ActivityPicker';
import { Screen } from '../components/Screen';
import { TopicPicker } from '../components/TopicPicker';
import {
  Button,
  Callout,
  Card,
  Chip,
  IconBadge,
  ModeCard,
  PremiumBadge,
  Row,
  Tile,
  ToggleItem,
} from '../components/ui';
import {
  DURATION_PRESETS,
  FREE_BLOCKED_APPS_LIMIT,
  MAX_SESSION_MINUTES,
  MIN_SESSION_MINUTES,
  STRICT_MAX_MINUTES,
} from '../config';
import { activityInfo, durationPresets, strictMaxFor } from '../activities';
import { sessionsBetween } from '../db/sessions';
import { touchTopic, type SessionKind } from '../db/topics';
import { focus, type SessionMode } from '../native/focus';
import { hasRequiredPermissions, useApp } from '../state/AppContext';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { formatDurationFa, toFaDigits } from '../utils/digits';
import { addDays, startOfDay } from '../utils/jalali';
import { showAlert } from '../components/Dialog';

const START_ERRORS: Record<string, string> = {
  already_active: 'یک جلسه همین الان در حال اجراست.',
  no_apps:
    'هیچ‌کدام از اپ‌های ممنوع روی گوشی نصب نیست. دست‌کم یک اپ انتخاب کن.',
  invalid_duration: 'مدت جلسه درست نیست.',
};

export function StartSessionScreen() {
  const nav = useNav();
  const paywall = usePaywall();
  const { colors } = useTheme();
  const st = useStyles();
  const {
    active,
    subjects,
    blockedApps,
    settings,
    setSetting,
    isPremium,
    refreshPermissions,
    refreshActive,
  } = useApp();

  const [minutes, setMinutes] = useState<number | null>(
    Number(settings.last_duration) || 45,
  );
  const [custom, setCustom] = useState(
    !DURATION_PRESETS.includes(Number(settings.last_duration) || 45),
  );
  const route = useRoute<RouteProp<RootStackParamList, 'StartSession'>>();
  const [subjectId, setSubjectId] = useState<number | null>(() => {
    if (
      route.params?.subjectId &&
      subjects.some(s => s.id === route.params?.subjectId)
    ) {
      return route.params.subjectId;
    }
    const last = subjects.find(s => String(s.id) === settings.last_subject_id);
    return last?.id ?? subjects[0]?.id ?? null;
  });
  const [activity, setActivity] = useState(route.params?.activity ?? 'study');
  const [activityName, setActivityName] = useState(activityInfo(route.params?.activity ?? 'study').label);
  const isStudy = activity === 'study';
  const presets = isStudy ? DURATION_PRESETS : durationPresets(activity);
  const [mode, setMode] = useState<SessionMode>('normal');
  const [topic, setTopic] = useState<string | null>(null);
  const [kind, setKind] = useState<SessionKind>(
    (settings.last_kind as SessionKind) || 'study',
  );
  const [pomodoro, setPomodoro] = useState(false);
  const [work, setWork] = useState(Number(settings.pomodoro_work) || 25);
  const [brk, setBrk] = useState(Number(settings.pomodoro_break) || 5);
  const [busy, setBusy] = useState(false);
  const startAfterIntro = useRef(false);
  // Offline session: browsers and AI apps are locked too (look things up in a later, online session).
  const [offline, setOffline] = useState(false);
  const [onlineApps, setOnlineApps] = useState<string[] | null>(null);
  const durationTouched = useRef(false);

  // The first study session of the day sets the tone: suggest 90 unbroken minutes.
  const studiedToday = useDataQuery(async () => {
    const from = startOfDay(Date.now());
    const rows = await sessionsBetween(from, addDays(from, 1));
    return rows.filter(r => r.source !== 'manual_log').length;
  }, []);
  const firstOfDay = studiedToday === 0;
  useEffect(() => {
    if (firstOfDay && activity === 'study' && !durationTouched.current) {
      setCustom(false);
      setMinutes(90);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstOfDay]);

  const toggleOffline = (on: boolean) => {
    if (on && !isPremium) {
      paywall('settings');
      return;
    }
    setOffline(on);
    if (on && onlineApps == null) {
      focus
        .installedApps()
        .then(apps => setOnlineApps(apps.filter(a => a.online).map(a => a.packageName)))
        .catch(() => setOnlineApps([]));
    }
  };

  // A session is already running (e.g. opened from the widget): show it instead.
  useFocusEffect(
    useCallback(() => {
      if (active) nav.replace('ActiveSession');
    }, [active, nav]),
  );

  useEffect(() => {
    if (subjectId == null && subjects.length) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);

  const enforcedApps = isPremium
    ? blockedApps.length
    : Math.min(blockedApps.length, FREE_BLOCKED_APPS_LIMIT);
  const strictMax = isStudy ? STRICT_MAX_MINUTES : strictMaxFor(activity);
  // Sleep may run up to 9 hours in both modes; everything else keeps the usual limits.
  const maxMinutes =
    mode === 'strict' ? strictMax : Math.max(MAX_SESSION_MINUTES, strictMax);

  const chooseActivity = (key: string, label: string) => {
    durationTouched.current = key !== 'study';
    setActivity(key);
    setActivityName(label);
    const p = key === 'study' ? DURATION_PRESETS : durationPresets(key);
    setCustom(false);
    setMinutes(
      key === 'sleep'
        ? 480
        : key === 'study'
        ? firstOfDay
          ? 90
          : Number(settings.last_duration) || 45
        : p[1] ?? p[0],
    );
    if (key !== 'study') setPomodoro(false);
    if (key !== 'study' && key !== 'deep_work') setOffline(false);
  };

  // Opened from a home quick action (e.g. «خواب»): apply that activity's defaults once.
  useEffect(() => {
    const a = route.params?.activity;
    if (a && a !== 'study') chooseActivity(a, activityInfo(a).label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const validMinutes =
    minutes != null && minutes >= MIN_SESSION_MINUTES && minutes <= maxMinutes;

  const chooseMode = (m: SessionMode) => {
    if (m === 'strict' && !isPremium) {
      paywall('strict');
      return;
    }
    setMode(m);
    if (m === 'strict') setPomodoro(false);
  };

  const start = async () => {
    if (busy || !validMinutes || (isStudy && subjectId == null)) return;
    setBusy(true);
    try {
      // Mandatory permissions are re-checked before every session; never start a broken one.
      const perms = await refreshPermissions();
      if (!hasRequiredPermissions(perms)) {
        nav.navigate('Permissions', { flow: 'fix' });
        return;
      }
      if (enforcedApps === 0) {
        nav.navigate('BlockedApps', { flow: 'settings' });
        return;
      }
      if (mode === 'strict' && settings.strict_intro_seen !== '1') {
        startAfterIntro.current = true;
        nav.navigate('StrictIntro');
        return;
      }
      const subject = isStudy ? subjects.find(s => s.id === subjectId)! : null;
      const base = blockedApps
        .slice(0, isPremium ? undefined : FREE_BLOCKED_APPS_LIMIT)
        .map(a => a.package_name);
      const blocked = offline ? [...new Set([...base, ...(onlineApps ?? [])])] : base;
      const r = await focus.start({
        subjectId: subject?.id ?? -1,
        subjectName: subject?.name ?? '',
        topic: isStudy ? topic ?? '' : '',
        kind: isStudy ? kind : 'study',
        activity,
        activityName: isStudy ? '' : activityName,
        mode,
        plannedMinutes: minutes!,
        blocked,
        source: 'manual',
        pomodoro: isStudy && pomodoro ? { work, break: brk } : undefined,
      });
      if (!r.ok) {
        if (r.error === 'missing_permissions')
          nav.navigate('Permissions', { flow: 'fix' });
        else if (r.error === 'already_active') nav.replace('ActiveSession');
        else showAlert('جلسه شروع نشد', START_ERRORS[r.error] ?? r.error);
        return;
      }
      await Promise.all([
        subject ? setSetting('last_subject_id', String(subject.id)) : null,
        subject ? setSetting('last_kind', kind) : null,
        subject && topic ? touchTopic(subject.id, topic) : null,
        subject ? setSetting('last_duration', String(minutes)) : null,
        pomodoro ? setSetting('pomodoro_work', String(work)) : null,
        pomodoro ? setSetting('pomodoro_break', String(brk)) : null,
      ]);
      await refreshActive();
      nav.replace('ActiveSession');
    } finally {
      setBusy(false);
    }
  };

  // Back from the strict-mode explanation: continue the start the user asked for.
  useEffect(() => {
    if (settings.strict_intro_seen === '1' && startAfterIntro.current) {
      startAfterIntro.current = false;
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.strict_intro_seen]);

  const appNames = blockedApps
    .slice(0, isPremium ? undefined : FREE_BLOCKED_APPS_LIMIT)
    .map(a => a.label)
    .slice(0, 3)
    .join('، ');

  return (
    <Screen
      title="تنظیم جلسه‌ی تمرکز"
      back
      footer={
        <Button
          title={
            busy
              ? 'در حال شروع…'
              : isStudy
              ? mode === 'strict'
                ? 'شروع تمرکز عمیق'
                : 'شروع جلسه'
              : `شروع ${activityName}`
          }
          size="lg"
          icon="lock"
          variant={mode === 'strict' ? 'strict' : 'primary'}
          loading={busy}
          disabled={!validMinutes || (isStudy && subjectId == null)}
          onPress={start}
        />
      }
    >
      <ActivityPicker value={activity} onChange={chooseActivity} />

      <View style={st.section}>
        <Row style={st.between}>
          <AppText weight="bold">{isStudy ? 'مدت زمان مطالعه' : 'مدت'}</AppText>
          {validMinutes && (
            <AppText variant="caption" weight="bold" color={colors.primary}>
              {formatDurationFa(minutes!)} پیوسته
            </AppText>
          )}
        </Row>
        <View style={st.grid}>
          {presets.map(m => (
            <Tile
              key={m}
              value={
                m >= 120 && m % 60 === 0 ? toFaDigits(m / 60) : toFaDigits(m)
              }
              label={m >= 120 && m % 60 === 0 ? 'ساعت' : 'دقیقه'}
              selected={!custom && minutes === m}
              disabled={m > maxMinutes}
              tone={mode === 'strict' ? 'strict' : 'primary'}
              onPress={() => {
                durationTouched.current = true;
                setCustom(false);
                setMinutes(m);
              }}
            />
          ))}
          <Tile
            value="…"
            label="دلخواه"
            selected={custom}
            tone={mode === 'strict' ? 'strict' : 'primary'}
            onPress={() => {
              durationTouched.current = true;
              setCustom(true);
            }}
          />
        </View>
        {custom && (
          <View style={{ gap: spacing.xs }}>
            <NumberInput
              value={minutes}
              onChange={setMinutes}
              placeholder="دقیقه"
              maxLength={3}
            />
            <AppText
              variant="caption"
              color={validMinutes ? colors.textMuted : colors.danger}
            >
              بین {toFaDigits(MIN_SESSION_MINUTES)} و {toFaDigits(maxMinutes)}{' '}
              دقیقه
            </AppText>
          </View>
        )}
        {isStudy && firstOfDay && (
          <Callout
            tone="orange"
            icon="flame"
            text="اولین جلسه‌ی امروز است: ۶۰ تا ۹۰ دقیقه پشت میز بمان، حتی اگر سخت شد. این برد اول به ذهنت ثابت می‌کند که از پسش برمی‌آیی."
          />
        )}
        {isStudy && !pomodoro && validMinutes && minutes! < 30 && (
          <Callout
            tone="warning"
            icon="wave"
            text="ذهن تازه بعد از ۲۰ تا ۲۵ دقیقه وارد تمرکز عمیق می‌شود؛ جلسه‌ی کوتاه درست همان لحظه قطعش می‌کند. برای درس، ۶۰ تا ۹۰ دقیقه بهتر جواب می‌دهد."
          />
        )}
        {mode === 'strict' && minutes != null && minutes > strictMax && (
          <AppText variant="caption" color={colors.danger}>
            سقف جلسه‌ی سخت {formatDurationFa(strictMax)} است.
          </AppText>
        )}
      </View>

      {isStudy && (
        <View style={st.section}>
          <AppText weight="bold">انتخاب درس</AppText>
          {subjects.length === 0 ? (
            <Button
              title="افزودن درس"
              variant="secondary"
              icon="add"
              onPress={() => nav.navigate('Subjects')}
            />
          ) : (
            <Row style={st.wrap}>
              {subjects.map(s => (
                <Chip
                  key={s.id}
                  label={s.name}
                  color={s.color}
                  selected={subjectId === s.id}
                  onPress={() => setSubjectId(s.id)}
                />
              ))}
            </Row>
          )}
        </View>
      )}

      {isStudy && (
        <TopicPicker
          subjectId={subjectId}
          topic={topic}
          onTopic={setTopic}
          kind={kind}
          onKind={setKind}
        />
      )}

      <View style={st.section}>
        <AppText weight="bold">سطح انضباط</AppText>
        <View style={st.modes}>
          <ModeCard
            title="حالت عادی"
            subtitle="امکان پایان زودهنگام"
            icon="shield"
            selected={mode === 'normal'}
            onPress={() => chooseMode('normal')}
          />
          <ModeCard
            title="حالت سخت"
            subtitle="بدون دکمه‌ی پایان"
            icon="lock"
            strict
            selected={mode === 'strict'}
            onPress={() => chooseMode('strict')}
            badge={!isPremium ? <PremiumBadge /> : undefined}
          />
        </View>
        {mode === 'strict' && (
          <Callout
            tone="strict"
            icon="lock"
            text="در حالت سخت تا پایان زمان راه خروجی نیست؛ فقط روزی یک خروج اضطراری با ۶۰ ثانیه انتظار."
          />
        )}
      </View>

      {mode === 'normal' && isStudy && (
        <Card tone="tint">
          <ToggleItem
            icon="hourglass"
            title="تکنیک پومودورو"
            subtitle="برای کارهای سبک خوب است؛ برای درس عمیق، جلسه‌ی پیوسته بهتر است"
            value={pomodoro}
            onChange={setPomodoro}
          />
          {pomodoro && (
            <>
              <Row>
                <AppText variant="caption" muted style={st.rowLabel}>
                  زمان مطالعه
                </AppText>
                {[25, 40, 50].map(w => (
                  <Tile
                    key={w}
                    value={toFaDigits(w)}
                    label="دقیقه"
                    selected={work === w}
                    onPress={() => setWork(w)}
                  />
                ))}
              </Row>
              <Row>
                <AppText variant="caption" muted style={st.rowLabel}>
                  زمان استراحت
                </AppText>
                {[5, 10, 15].map(b => (
                  <Tile
                    key={b}
                    value={toFaDigits(b)}
                    label="دقیقه"
                    selected={brk === b}
                    tone="strict"
                    onPress={() => setBrk(b)}
                  />
                ))}
              </Row>
              <AppText variant="caption" muted>
                مدت جلسه یعنی کل زمان مطالعه؛ استراحت‌ها به آن اضافه می‌شوند.
              </AppText>
            </>
          )}
        </Card>
      )}

      {(isStudy || activity === 'deep_work') && (
        <Card tone="tint">
          <ToggleItem
            icon="cloudOff"
            iconTone="cyan"
            title="جلسه‌ی آفلاین"
            subtitle={
              offline
                ? onlineApps == null
                  ? 'در حال پیدا کردن مرورگرها…'
                  : `${toFaDigits(onlineApps.length)} مرورگر و دستیار هوش مصنوعی هم قفل می‌شوند`
                : 'مرورگر و هوش مصنوعی هم قفل شوند؛ جست‌وجوها را بنویس برای جلسه‌ی آنلاین'
            }
            value={offline}
            onChange={toggleOffline}
          />
        </Card>
      )}

      <Card
        tone="tint"
        onPress={() => nav.navigate('BlockedApps', { flow: 'settings' })}
      >
        <Row gap={spacing.md}>
          <IconBadge name="block" tone="danger" size={36} />
          <View style={{ flex: 1 }}>
            <AppText weight="bold">
              {toFaDigits(enforcedApps)} اپ ممنوع فعال
            </AppText>
            <AppText variant="caption" muted numberOfLines={1}>
              {enforcedApps === 0
                ? 'برای شروع دست‌کم یک اپ انتخاب کن'
                : appNames}
            </AppText>
          </View>
          <AppText weight="bold" variant="caption" color={colors.primary}>
            ویرایش
          </AppText>
        </Row>
      </Card>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  section: { gap: spacing.sm + 4 },
  between: { justifyContent: 'space-between' },
  wrap: { flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  modes: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.lg,
    padding: 6,
  },
  rowLabel: { width: 76 },
}));
