import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { activityInfo, BUILTIN_ACTIVITIES, type ActivityInfo } from '../activities';
import { usePaywall } from '../app/hooks';
import { addCustomActivity, deleteCustomActivity, listCustomActivities, type CustomActivity } from '../db/activities';
import { useApp } from '../state/AppContext';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { showAlert } from './Dialog';
import { Icon } from './Icon';
import { TextField } from './Pickers';
import { Sheet } from './Sheet';
import { alpha, Button } from './ui';

/**
 * «برای چه؟» — study or another activity (deep work, sleep, meals…). Study, deep work and
 * sleep are free; the rest and user-defined activities need premium.
 */
export function ActivityPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string, label: string) => void;
}) {
  const { isPremium } = useApp();
  const paywall = usePaywall();
  const { colors } = useTheme();
  const s = useStyles();
  const [custom, setCustom] = useState<CustomActivity[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const reload = () => listCustomActivities().then(setCustom).catch(() => {});
  useEffect(() => {
    reload();
  }, []);

  const all: ActivityInfo[] = [
    ...BUILTIN_ACTIVITIES,
    ...custom.map(c => activityInfo(`custom:${c.id}`, c.name)),
  ];

  const pick = (a: ActivityInfo) => {
    if (!a.free && !isPremium) {
      paywall('settings');
      return;
    }
    onChange(a.key, a.label);
  };

  const remove = (c: CustomActivity) =>
    showAlert(`حذف «${c.name}»؟`, 'جلسه‌های قبلی این حالت در گزارش می‌مانند.', [
      { text: 'نه', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await deleteCustomActivity(c.id);
          if (value === `custom:${c.id}`) onChange('study', 'درس');
          reload();
        },
      },
    ]);

  const save = async () => {
    const n = name.trim();
    if (!n) return;
    const id = await addCustomActivity(n);
    await reload();
    if (id) onChange(`custom:${id}`, n);
    setName('');
    setAdding(false);
  };

  return (
    <View style={s.wrap}>
      <AppText weight="bold">برای چه؟</AppText>
      <View style={s.grid}>
        {all.map(a => {
          const selected = value === a.key;
          const locked = !a.free && !isPremium;
          const customItem = custom.find(c => `custom:${c.id}` === a.key);
          return (
            <Pressable
              key={a.key}
              onPress={() => pick(a)}
              onLongPress={customItem ? () => remove(customItem) : undefined}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={a.label}
              style={({ pressed }) => [
                s.item,
                { backgroundColor: selected ? a.color : alpha(a.color, 0.1) },
                pressed && s.pressed,
              ]}
            >
              <Icon name={a.icon} size={22} color={selected ? '#FFFFFF' : a.color} />
              <AppText variant="caption" weight="bold" center numberOfLines={1} color={selected ? '#FFFFFF' : colors.text}>
                {a.label}
              </AppText>
              {locked && (
                <View style={s.lock}>
                  <Icon name="star" size={10} color={colors.warning} />
                </View>
              )}
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => (isPremium ? setAdding(true) : paywall('settings'))}
          accessibilityRole="button"
          accessibilityLabel="حالت دلخواه"
          style={({ pressed }) => [s.item, s.addItem, pressed && s.pressed]}
        >
          <Icon name="add" size={22} color={colors.textMuted} />
          <AppText variant="caption" weight="medium" muted center numberOfLines={1}>
            حالت دلخواه
          </AppText>
          {!isPremium && (
            <View style={s.lock}>
              <Icon name="star" size={10} color={colors.warning} />
            </View>
          )}
        </Pressable>
      </View>
      {value !== 'study' && (
        <AppText variant="caption" muted>
          این جلسه در ساعت مطالعه حساب نمی‌شود؛ در گزارش جدا می‌آید.
        </AppText>
      )}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="حالت دلخواه">
        <TextField value={name} onChange={setName} placeholder="مثلاً: نماز، کتاب‌خوانی، کلاس" autoFocus />
        <Button title="افزودن" disabled={!name.trim()} onPress={save} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  wrap: { gap: spacing.sm + 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: {
    flexBasis: '22%',
    flexGrow: 1,
    minHeight: 72,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  addItem: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border, backgroundColor: 'transparent' },
  lock: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: c.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.96 }] },
}));
