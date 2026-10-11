import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
import { SummaryScreen } from '../screens/SummaryScreen';
import { TroubleshootScreen } from '../screens/TroubleshootScreen';
import { useApp } from '../state/AppContext';
import { fonts, useTheme } from '../theme';

export type TabParamList = {
  Home: undefined;
  Schedule: undefined;
  Report: undefined;
  Settings: undefined;
};

export type PurchaseReason = 'apps' | 'strict' | 'schedule' | 'report' | 'widget' | 'settings';

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Permissions: { flow?: 'onboarding' | 'fix' | 'status' } | undefined;
  BlockedApps: { flow?: 'onboarding' | 'settings' } | undefined;
  StartSession: undefined;
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
        screens: { Home: 'home', Schedule: 'schedule', Report: 'report', Settings: 'settings' },
      },
      ActiveSession: 'session',
      StartSession: 'start',
      Summary: 'summary',
      Permissions: 'permissions',
      Purchase: 'purchase',
    },
  },
};

const TAB_ICONS: Record<keyof TabParamList, IconName> = {
  Home: 'home',
  Schedule: 'calendar',
  Report: 'chart',
  Settings: 'settings',
};

function Tabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarIcon: ({ color }) => <Icon name={TAB_ICONS[route.name]} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'خانه' }} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'برنامه' }} />
      <Tab.Screen name="Report" component={ReportScreen} options={{ title: 'گزارش' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'تنظیمات' }} />
    </Tab.Navigator>
  );
}

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
