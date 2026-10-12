import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useNavigation,
  type LinkingOptions,
  type NavigatorScreenParams,
  type Theme,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { Icon, type IconName } from '../components/Icon';
import { ActiveSessionScreen } from '../screens/ActiveSessionScreen';
import { BackupScreen } from '../screens/BackupScreen';
import { BlockedAppsScreen } from '../screens/BlockedAppsScreen';
import { BlockEditorScreen } from '../screens/BlockEditorScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { InfoScreen } from '../screens/InfoScreen';
import { ManualLogScreen } from '../screens/ManualLogScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PermissionsScreen } from '../screens/PermissionsScreen';
import { PurchaseScreen } from '../screens/PurchaseScreen';
import { ReportScreen } from '../screens/ReportScreen';
import { ScheduleScreen } from '../screens/ScheduleScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StartSessionScreen } from '../screens/StartSessionScreen';
import { StrictIntroScreen } from '../screens/StrictIntroScreen';
import { SubjectsScreen } from '../screens/SubjectsScreen';
import { SubjectsTabScreen } from '../screens/SubjectsTabScreen';
import { SummaryScreen } from '../screens/SummaryScreen';
import { TroubleshootScreen } from '../screens/TroubleshootScreen';
import { useApp } from '../state/AppContext';
import { fonts, makeStyles, radius, useTheme } from '../theme';

export type TabParamList = {
  Schedule: undefined;
  Report: undefined;
  Home: undefined;
  Lessons: undefined;
  Settings: undefined;
};

export type PurchaseReason = 'apps' | 'strict' | 'schedule' | 'report' | 'widget' | 'settings';

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Permissions: { flow?: 'onboarding' | 'fix' | 'status' } | undefined;
  BlockedApps: { flow?: 'onboarding' | 'settings' } | undefined;
  StartSession: { subjectId?: number; activity?: string } | undefined;
  StrictIntro: undefined;
  ActiveSession: { end?: string } | undefined;
  Summary: { nativeId?: string } | undefined;
  Subjects: undefined;
  Purchase: { reason?: PurchaseReason } | undefined;
  BlockEditor: { blockId?: number; weekday?: number } | undefined;
  ManualLog: undefined;
  Troubleshoot: undefined;
  Info: { page: 'about' | 'privacy' | 'limits' };
  Backup: undefined;
};

export type Nav = NativeStackNavigationProp<RootStackParamList>;
export const useNav = () => useNavigation<Nav>();

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['tamarkoz://'],
  config: {
    screens: {
      Tabs: {
        screens: { Home: 'home', Schedule: 'schedule', Report: 'report', Lessons: 'lessons', Settings: 'settings' },
      },
      ActiveSession: 'session',
      StartSession: 'start',
      Summary: 'summary',
      Permissions: 'permissions',
      Purchase: 'purchase',
    },
  },
};

// Each tab has its own icon and its own color when active.
const TABS: Record<keyof TabParamList, { icon: IconName; label: string; tone: 'cyan' | 'orange' | 'primary' | 'pink' | 'strict' }> = {
  Schedule: { icon: 'eventCheck', label: 'برنامه', tone: 'cyan' },
  Report: { icon: 'trending', label: 'گزارش', tone: 'orange' },
  Home: { icon: 'dashboard', label: 'خانه', tone: 'primary' },
  Lessons: { icon: 'school', label: 'درس‌ها', tone: 'pink' },
  Settings: { icon: 'tune', label: 'تنظیمات', tone: 'strict' },
};

function Tabs() {
  return (
    <Tab.Navigator initialRouteName="Home" backBehavior="initialRoute" tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Report" component={ReportScreen} />
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Lessons" component={SubjectsTabScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

/**
 * Bottom bar: four regular tabs, and «خانه» in the middle as a large round button
 * that sits above the bar. Tab order is right-to-left (first tab on the right).
 */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const s = useTabStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const name = route.name as keyof TabParamList;
        const focused = state.index === index;
        const { icon, label, tone } = TABS[name];
        const fg = { cyan: colors.cyan, orange: colors.orange, primary: colors.primary, pink: colors.pink, strict: colors.strict }[tone];
        const bg = {
          cyan: colors.cyanSoft,
          orange: colors.orangeSoft,
          primary: colors.primarySoft,
          pink: colors.pinkSoft,
          strict: colors.strictSoft,
        }[tone];
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        if (name === 'Home') {
          return (
            <View key={route.key} style={s.centerSlot}>
              <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                style={({ pressed }) => [s.homeButton, focused && s.homeFocused, pressed && s.pressed]}
              >
                <Icon name="dashboard" size={28} color="#FFFFFF" />
              </Pressable>
              <AppText variant="caption" weight={focused ? 'bold' : 'medium'} color={focused ? colors.primary : colors.textMuted}>
                {label}
              </AppText>
            </View>
          );
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            style={s.tab}
          >
            <View style={[s.iconPill, focused && { backgroundColor: bg }]}>
              <Icon name={icon} size={22} color={focused ? fg : colors.textMuted} />
            </View>
            <AppText variant="caption" weight={focused ? 'bold' : 'regular'} color={focused ? fg : colors.textMuted}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const useTabStyles = makeStyles(c => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: 8,
    boxShadow: '0 -6px 24px -6px rgba(28, 32, 51, 0.12)',
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  iconPill: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: radius.pill },
  centerSlot: { flex: 1.2, alignItems: 'center', gap: 2 },
  homeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginTop: -34, // lifts the button above the bar
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: c.background,
    boxShadow: '0 8px 20px -4px rgba(62, 91, 219, 0.45)',
  },
  homeFocused: { backgroundColor: c.primaryDeep },
  pressed: { transform: [{ scale: 0.94 }] },
}));

/** Opens the summary when a session ends while the app is in front (F08). */
function SessionEndWatcher() {
  const { justEnded, clearJustEnded } = useApp();
  const nav = useNav();
  useEffect(() => {
    if (!justEnded) return;
    clearJustEnded();
    nav.navigate('Summary', { nativeId: justEnded.nativeId });
  }, [justEnded, clearJustEnded, nav]);
  return null;
}

export function RootNavigator() {
  const { settings } = useApp();
  const { colors, dark } = useTheme();
  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
    fonts: {
      regular: { fontFamily: fonts.regular, fontWeight: 'normal' },
      medium: { fontFamily: fonts.medium, fontWeight: 'normal' },
      bold: { fontFamily: fonts.bold, fontWeight: 'normal' },
      heavy: { fontFamily: fonts.bold, fontWeight: 'normal' },
    },
  };
  const onboarded = settings.onboarding_done === '1';

  return (
    <NavigationContainer theme={navTheme} direction="rtl" linking={onboarded ? linking : undefined}>
      {onboarded && <SessionEndWatcher />}
      <Stack.Navigator
        initialRouteName={onboarded ? 'Tabs' : 'Onboarding'}
        screenOptions={{ headerShown: false, animation: 'slide_from_left' }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Permissions" component={PermissionsScreen} />
        <Stack.Screen name="BlockedApps" component={BlockedAppsScreen} />
        <Stack.Screen
          name="StartSession"
          component={StartSessionScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="StrictIntro" component={StrictIntroScreen} />
        <Stack.Screen name="ActiveSession" component={ActiveSessionScreen} />
        <Stack.Screen name="Summary" component={SummaryScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Subjects" component={SubjectsScreen} />
        <Stack.Screen name="Purchase" component={PurchaseScreen} />
        <Stack.Screen name="BlockEditor" component={BlockEditorScreen} />
        <Stack.Screen name="ManualLog" component={ManualLogScreen} />
        <Stack.Screen name="Troubleshoot" component={TroubleshootScreen} />
        <Stack.Screen name="Info" component={InfoScreen} />
        <Stack.Screen name="Backup" component={BackupScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
