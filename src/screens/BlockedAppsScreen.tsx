import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, TextInput, View } from 'react-native';
import { usePaywall } from '../app/hooks';
import { useNav, type RootStackParamList } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { Banner, Button } from '../components/ui';
import { FREE_BLOCKED_APPS_LIMIT } from '../config';
import { setBlockedApps } from '../db/blockedApps';
import { focus, type InstalledApp } from '../native/focus';
import { useApp } from '../state/AppContext';
import { fonts, makeStyles, radius, spacing, useTheme } from '../theme';
import { toFaDigits } from '../utils/digits';
import { showAlert } from '../components/Dialog';

type Item = { kind: 'header'; title: string } | { kind: 'app'; app: InstalledApp };

export function BlockedAppsScreen() {
  const nav = useNav();
  const route = useRoute<RouteProp<RootStackParamList, 'BlockedApps'>>();
  const flow = route.params?.flow ?? 'settings';
  const { blockedApps, reloadBlockedApps, isPremium, active, setSetting } = useApp();
  const paywall = usePaywall();
  const { colors } = useTheme();
  const s = useStyles();

  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>(() => blockedApps.map(a => a.package_name));

  useEffect(() => {
    focus
      .installedApps()
      .then(list => setApps(list.sort((a, b) => a.label.localeCompare(b.label, 'fa'))))
      .catch(() => setApps([]));
  }, []);

  const strictLocked = active?.mode === 'strict';
  const installed = useMemo(() => new Set(apps?.map(a => a.packageName)), [apps]);
  // Apps that were uninstalled are simply hidden.
  const visibleSelected = apps ? selected.filter(p => installed.has(p)) : selected;

  const items = useMemo<Item[]>(() => {
    if (!apps) return [];
    const q = search.trim().toLowerCase();
    const match = (a: InstalledApp) =>
      !q || a.label.toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q);
    const filtered = apps.filter(match);
    if (q) return filtered.map(app => ({ kind: 'app' as const, app }));
    const suggested = filtered.filter(a => a.suggested);
    const rest = filtered.filter(a => !a.suggested);
    return [
      ...(suggested.length ? [{ kind: 'header' as const, title: 'پیشنهادی: شبکه‌های اجتماعی، پیام‌رسان، ویدیو و بازی' }] : []),
      ...suggested.map(app => ({ kind: 'app' as const, app })),
      { kind: 'header' as const, title: 'همه‌ی اپ‌ها' },
      ...rest.map(app => ({ kind: 'app' as const, app })),
    ];
  }, [apps, search]);

  const persist = async (next: string[]) => {
    // Uninstalled apps drop out of the list here, so they never count toward the free limit.
    const kept = apps ? next.filter(p => installed.has(p)) : next;
    setSelected(kept);
    const byPkg = new Map(apps?.map(a => [a.packageName, a.label]));
    await setBlockedApps(kept.map(p => ({ packageName: p, label: byPkg.get(p) ?? p })));
    await reloadBlockedApps();
  };

  const toggle = async (app: InstalledApp) => {
    const isOn = selected.includes(app.packageName);
    if (strictLocked) {
      showAlert('حالت سخت', 'در جلسه‌ی سخت فهرست اپ‌های ممنوع قفل است.');
      return;
    }
    if (isOn) {
      if (active) {
        showAlert('جلسه در حال اجراست', 'وسط جلسه می‌شود اپ اضافه کرد ولی نمی‌شود حذف کرد.');
        return;
      }
      await persist(selected.filter(p => p !== app.packageName));
      return;
    }
    if (!isPremium && visibleSelected.length >= FREE_BLOCKED_APPS_LIMIT) {
      paywall('apps');
      return;
    }
    await persist([...selected, app.packageName]);
    if (active) await focus.addBlockedApps([app.packageName]);
  };

  const finishOnboarding = async () => {
    await setSetting('onboarding_done', '1');
    nav.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  return (
    <Screen
      title="اپ‌های ممنوع"
      back={flow !== 'onboarding'}
      scroll={false}
      footer={
        flow === 'onboarding' ? (
          <Button
            title={visibleSelected.length ? 'تمام، برویم خانه' : 'بعداً انتخاب می‌کنم'}
            size="lg"
            variant={visibleSelected.length ? 'primary' : 'secondary'}
            onPress={finishOnboarding}
          />
        ) : undefined
      }
    >
      <AppText muted>
        {toFaDigits(visibleSelected.length)} اپ انتخاب شده
        {!isPremium ? ` · نسخه‌ی رایگان تا ${toFaDigits(FREE_BLOCKED_APPS_LIMIT)} اپ` : ''}
      </AppText>
      {strictLocked && <Banner tone="warning" text="در جلسه‌ی سخت این فهرست قفل است." />}
      {active && !strictLocked && <Banner tone="info" text="وسط جلسه فقط می‌شود اپ اضافه کرد." />}
      <View style={s.search}>
        <Icon name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={[s.searchInput, { color: colors.text }]}
          placeholder="جستجو"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      {!apps ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          windowSize={10}
          keyExtractor={(it, i) => (it.kind === 'app' ? it.app.packageName : `h${i}`)}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <AppText variant="caption" weight="medium" muted style={s.header}>
                {item.title}
              </AppText>
            ) : (
              <AppRow app={item.app} on={selected.includes(item.app.packageName)} onPress={() => toggle(item.app)} />
            )
          }
        />
      )}
    </Screen>
  );
}

function AppRow({ app, on, onPress }: { app: InstalledApp; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
      {app.icon ? <Image source={{ uri: app.icon }} style={s.icon} /> : <View style={s.icon} />}
      <AppText style={{ flex: 1 }} numberOfLines={1}>
        {app.label}
      </AppText>
      <View style={[s.check, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        {on && <Icon name="check" size={16} color={colors.onPrimary} />}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(c => ({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, minHeight: 44, fontFamily: fonts.regular, fontSize: 15, textAlign: 'right' },
  header: { paddingTop: spacing.md, paddingBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 },
  icon: { width: 40, height: 40, borderRadius: 10 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
