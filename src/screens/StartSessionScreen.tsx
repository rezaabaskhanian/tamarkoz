import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { usePaywall } from '../app/hooks';
import { useNav } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { NumberInput } from '../components/Pickers';
import { Screen } from '../components/Screen';
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
import { focus, type SessionMode } from '../native/focus';
import { hasRequiredPermissions, useApp } from '../state/AppContext';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { formatDurationFa, toFaDigits } from '../utils/digits';

const START_ERRORS: Record<string, string> = {
  already_active: 'یک جلسه همین الان در حال اجراست.',
  no_apps: 'هیچ‌کدام از اپ‌های ممنوع روی گوشی نصب نیست. دست‌کم یک اپ انتخاب کن.',
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

  const [minutes, setMinutes] = useState<number | null>(Number(settings.last_duration) || 45);
  const [custom, setCustom] = useState(!DURATION_PRESETS.includes(Number(settings.last_duration) || 45));
  const [subjectId, setSubjectId] = useState<number | null>(() => {
    const last = subjects.find(s => String(s.id) === settings.last_subject_id);
    return last?.id ?? subjects[0]?.id ?? null;
  });
  const [mode, setMode] = useState<SessionMode>('normal');
  const [pomodoro, setPomodoro] = useState(false);
  const [work, setWork] = useState(Number(settings.pomodoro_work) || 25);
  const [brk, setBrk] = useState(Number(settings.pomodoro_break) || 5);
  const [busy, setBusy] = useState(false);
  const startAfterIntro = useRef(false);

  // A session is already running (e.g. opened from the widget): show it instead.
  useFocusEffect(
    useCallback(() => {
      if (active) nav.replace('ActiveSession');
    }, [active, nav]),
  );

  useEffect(() => {
    if (subjectId == null && subjects.length) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);

  const enforcedApps = isPremium ? blockedApps.length : Math.min(blockedApps.length, FREE_BLOCKED_APPS_LIMIT);
  const maxMinutes = mode === 'strict' ? STRICT_MAX_MINUTES : MAX_SESSION_MINUTES;
  const validMinutes = minutes != null && minutes >= MIN_SESSION_MINUTES && minutes <= maxMinutes;

  const chooseMode = (m: SessionMode) => {
    if (m === 'strict' && !isPremium) {
      paywall('strict');
      return;
    }
    setMode(m);
    if (m === 'strict') setPomodoro(false);
  };

  const start = async () => {
    if (busy || !validMinutes || subjectId == null) return;
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
      const subject = subjects.find(s => s.id === subjectId)!;
      const r = await focus.start({
        subjectId: subject.id,
        subjectName: subject.name,
        mode,
        plannedMinutes: minutes!,
        blocked: blockedApps.slice(0, isPremium ? undefined : FREE_BLOCKED_APPS_LIMIT).map(a => a.package_name),
        source: 'manual',
        pomodoro: pomodoro ? { work, break: brk } : undefined,
      });
      if (!r.ok) {
        if (r.error === 'missing_permissions') nav.navigate('Permissions', { flow: 'fix' });
        else if (r.error === 'already_active') nav.replace('ActiveSession');
        else Alert.alert('جلسه شروع نشد', START_ERRORS[r.error] ?? r.error);
        return;
      }
      await Promise.all([
        setSetting('last_subject_id', String(subject.id)),
        setSetting('last_duration', String(minutes)),
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
          title={busy ? 'در حال شروع…' : mode === 'strict' ? 'شروع تمرکز عمیق' : 'شروع جلسه'}
          size="lg"
          icon="lock"
          variant={mode === 'strict' ? 'strict' : 'primary'}
          loading={busy}
          disabled={!validMinutes || subjectId == null}
          onPress={start}
        />
      }
    >
      <View style={st.section}>
        <Row style={st.between}>
          <AppText weight="bold">مدت زمان مطالعه</AppText>
          {validMinutes && (
            <AppText variant="caption" weight="bold" color={colors.primary}>
              {formatDurationFa(minutes!)} پیوسته
            </AppText>
          )}
        </Row>
        <View style={st.grid}>
          {DURATION_PRESETS.map(m => (
            <Tile
              key={m}
              value={toFaDigits(m)}
              label="دقیقه"
              selected={!custom && minutes === m}
              disabled={m > maxMinutes}
              tone={mode === 'strict' ? 'strict' : 'primary'}
              onPress={() => {
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
            onPress={() => setCustom(true)}
          />
        </View>
        {custom && (
          <View style={{ gap: spacing.xs }}>
            <NumberInput value={minutes} onChange={setMinutes} placeholder="دقیقه" maxLength={3} />
            <AppText variant="caption" color={validMinutes ? colors.textMuted : colors.danger}>
              بین {toFaDigits(MIN_SESSION_MINUTES)} و {toFaDigits(maxMinutes)} دقیقه
            </AppText>
          </View>
        )}
        {mode === 'strict' && minutes != null && minutes > STRICT_MAX_MINUTES && (
          <AppText variant="caption" color={colors.danger}>
            سقف جلسه‌ی سخت {formatDurationFa(STRICT_MAX_MINUTES)} است.
          </AppText>
        )}
      </View>

      <View style={st.section}>
        <AppText weight="bold">انتخاب درس</AppText>
        {subjects.length === 0 ? (
          <Button title="افزودن درس" variant="secondary" icon="add" onPress={() => nav.navigate('Subjects')} />
        ) : (
          <Row style={st.wrap}>
            {subjects.map(s => (
              <Chip key={s.id} label={s.name} color={s.color} selected={subjectId === s.id} onPress={() => setSubjectId(s.id)} />
            ))}
          </Row>
        )}
      </View>

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

      {mode === 'normal' && (
        <Card tone="tint">
          <ToggleItem
            icon="hourglass"
            title="تکنیک پومودورو"
            subtitle="چرخه‌های مطالعه و استراحت؛ در استراحت اپ‌ها بازند"
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
                  <Tile key={w} value={toFaDigits(w)} label="دقیقه" selected={work === w} onPress={() => setWork(w)} />
                ))}
              </Row>
              <Row>
                <AppText variant="caption" muted style={st.rowLabel}>
                  زمان استراحت
                </AppText>
                {[5, 10, 15].map(b => (
                  <Tile key={b} value={toFaDigits(b)} label="دقیقه" selected={brk === b} tone="strict" onPress={() => setBrk(b)} />
                ))}
              </Row>
              <AppText variant="caption" muted>
                مدت جلسه یعنی کل زمان مطالعه؛ استراحت‌ها به آن اضافه می‌شوند.
              </AppText>
            </>
          )}
        </Card>
      )}

      <Card tone="tint" onPress={() => nav.navigate('BlockedApps', { flow: 'settings' })}>
        <Row gap={spacing.md}>
          <IconBadge name="block" tone="danger" size={36} />
          <View style={{ flex: 1 }}>
            <AppText weight="bold">{toFaDigits(enforcedApps)} اپ ممنوع فعال</AppText>
            <AppText variant="caption" muted numberOfLines={1}>
              {enforcedApps === 0 ? 'برای شروع دست‌کم یک اپ انتخاب کن' : appNames}
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
  modes: { flexDirection: 'row', gap: 6, backgroundColor: c.surfaceAlt, borderRadius: radius.lg, padding: 6 },
  rowLabel: { width: 76 },
}));
