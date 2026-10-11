import { useNavigation } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { makeStyles, spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = {
  title?: string;
  back?: boolean;
  right?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
};

export function Screen({ title, back, right, children, footer, scroll = true }: Props) {
  const nav = useNavigation();
  const { colors } = useTheme();
  const s = useStyles();
  const body = scroll ? (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[s.content, s.flex]}>{children}</View>
  );
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      {(title || back) && (
        <View style={s.header}>
          {back && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="بازگشت"
              hitSlop={12}
              onPress={() => nav.goBack()}
              style={s.back}
            >
              <Icon name="back" color={colors.text} />
            </Pressable>
          )}
          <AppText variant="title" style={s.flex} numberOfLines={1}>
            {title}
          </AppText>
          {right}
        </View>
      )}
      {body}
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const useStyles = makeStyles(c => ({
  safe: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    minHeight: 52,
  },
  back: { padding: 4 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.background,
  },
}));
