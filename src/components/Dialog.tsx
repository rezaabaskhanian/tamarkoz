import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import type { CelebrationKind } from '../assets/lottie';
import { AppText } from './AppText';
import { Celebration } from './Celebration';
import { Icon } from './Icon';
import { Button } from './ui';

// In-app replacement for Alert.alert: the system dialog can't use the Vazirmatn font
// or the app's design, this one does. Same call shape as Alert.alert:
//   showAlert('عنوان', 'متن', [{ text: 'نه', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress }])

export type DialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type Request = { title: string; message?: string; buttons: DialogButton[]; animation?: CelebrationKind };

let enqueue: ((r: Request) => void) | null = null;

/** `animation` replaces the round icon with a Lottie animation (moments of reward only). */
export function showAlert(title: string, message?: string, buttons?: DialogButton[], animation?: CelebrationKind) {
  const req = { title, message, buttons: buttons?.length ? buttons : [{ text: 'باشه' }], animation };
  if (enqueue) enqueue(req);
}

/**
 * Mount once near the root (inside ThemeProvider). Shows one dialog at a time, in order,
 * as a sheet that slides up from the bottom (design reference: Roots «Monk Mode» sheet).
 */
export function DialogHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const current = queue[0];
  const anim = useRef(new Animated.Value(0)).current;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useStyles();

  useEffect(() => {
    enqueue = r => setQueue(q => [...q, r]);
    return () => {
      enqueue = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [current, anim]);

  if (!current) return null;

  const close = (b?: DialogButton) => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setQueue(q => q.slice(1));
      // Run after the sheet is gone so a follow-up showAlert (two-step confirms) queues cleanly.
      if (b?.onPress) setTimeout(b.onPress, 0);
    });
  };

  const cancel = current.buttons.find(b => b.style === 'cancel');
  const actions = current.buttons.filter(b => b.style !== 'cancel');
  const destructive = actions.some(b => b.style === 'destructive');

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => close(cancel)}>
      <View style={s.root}>
        <Animated.View style={[s.backdrop, { opacity: anim }]}>
          <Pressable style={s.fill} onPress={() => close(cancel)} accessibilityLabel="بستن" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            s.sheet,
            { paddingBottom: spacing.lg + insets.bottom },
            { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] },
          ]}
        >
          <View style={s.handle} />
          {current.animation ? (
            <Celebration kind={current.animation} size={140} />
          ) : (
            <View style={[s.icon, { backgroundColor: destructive ? colors.dangerSoft : colors.accentSoft }]}>
              <Icon name={destructive ? 'warning' : 'sparkle'} size={28} color={destructive ? colors.danger : colors.accent} />
            </View>
          )}
          <AppText variant="title" center>
            {current.title}
          </AppText>
          {current.message ? (
            <AppText muted center style={s.message}>
              {current.message}
            </AppText>
          ) : null}
          <View style={s.buttons}>
            {actions.map((b, i) => (
              <Button
                key={`${b.text}${i}`}
                title={b.text}
                size="lg"
                onPress={() => close(b)}
                variant={b.style === 'destructive' ? 'danger' : i === 0 ? 'primary' : 'secondary'}
                style={b.style === 'destructive' ? { backgroundColor: colors.danger } : undefined}
                textColor={b.style === 'destructive' ? '#FFFFFF' : undefined}
              />
            ))}
            {cancel ? (
              <Pressable onPress={() => close(cancel)} style={s.cancel} accessibilityRole="button" hitSlop={8}>
                <AppText weight="bold" center color={colors.text}>
                  {cancel.text}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(c => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  fill: { flex: 1 },
  backdrop: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const), backgroundColor: c.overlay },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    alignItems: 'center',
    gap: spacing.sm,
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, marginBottom: spacing.md },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  message: { lineHeight: 26, paddingHorizontal: spacing.sm },
  buttons: { alignSelf: 'stretch', marginTop: spacing.md, gap: spacing.sm },
  cancel: { paddingVertical: spacing.sm + 4 },
}));
