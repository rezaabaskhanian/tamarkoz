import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, radius, spacing } from '../theme';
import { AppText } from './AppText';

/**
 * Bottom sheet modal. The app is edge-to-edge, so the window doesn't resize for the
 * keyboard; the sheet is lifted by the keyboard's height instead. (KeyboardAvoidingView
 * measured itself while shrinking and made the sheet jump up and down.)
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const show = Keyboard.addListener('keyboardDidShow', e => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
      setKeyboard(0);
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={s.flex}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="بستن" />
        <View style={[s.sheet, { paddingBottom: spacing.md + (keyboard > 0 ? keyboard : insets.bottom) }]}>
          <View style={s.handle} />
          {title ? (
            <AppText variant="subtitle" weight="bold">
              {title}
            </AppText>
          ) : null}
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(c => ({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: c.overlay },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '88%',
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.border,
    marginBottom: spacing.xs,
  },
  content: { gap: spacing.md, paddingBottom: spacing.sm },
}));
