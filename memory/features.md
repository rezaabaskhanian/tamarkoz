# وضعیت فیچرها

همه‌ی ۲۷ فیچر کدنویسی شده‌اند؛ هیچ‌کدام هنوز روی گوشی واقعی آزمایش نشده.

| کد | فیچر | فایل‌های اصلی |
|---|---|---|
| F01 | راهنمای اولین اجرا | `screens/OnboardingScreen.tsx` |
| F02 | جادوگر و وضعیت مجوزها | `screens/PermissionsScreen.tsx`, `focus/Permissions.kt` |
| F03 | اپ‌های ممنوع | `screens/BlockedAppsScreen.tsx`, `db/blockedApps.ts`, `focus/Apps.kt` |
| F04 | شروع جلسه | `screens/StartSessionScreen.tsx` |
| F05 | موتور قفل | `focus/SessionEngine.kt`, `focus/FocusService.kt` |
| F06 | صفحه‌ی قفل | `focus/LockOverlay.kt` |
| F07 | جلسه‌ی در حال اجرا | `screens/ActiveSessionScreen.tsx` |
| F08 | پایان و ثبت خودکار | `SessionEngine.finishLocked`, `db/sessions.ts#importFinished`, `screens/SummaryScreen.tsx` |
| F09 | درس‌ها | `screens/SubjectsScreen.tsx`, `db/subjects.ts` |
| F10 | خانه | `screens/HomeScreen.tsx` |
| F11 | شمارش معکوس | `HomeScreen.tsx#Countdown` |
| F12 | حالت سخت و خروج اضطراری | `SessionEngine` (emergency*), `StrictIntroScreen.tsx`, `ActiveSessionScreen.tsx` |
| F13 | برنامه‌ی هفتگی | `screens/ScheduleScreen.tsx`, `BlockEditorScreen.tsx`, `db/schedule.ts`, `focus/Scheduler.kt` |
| F14 | گزارش هفتگی | `screens/ReportScreen.tsx`, `services/reports.ts`, `services/stats.ts` |
| F15 | خرید و بازیابی | `focus/BillingModule.kt`, `services/purchases.ts`, `screens/PurchaseScreen.tsx` |
| F16 | اعلان‌ها | `focus/Notifications.kt`, `Scheduler.rescheduleAll` |
| F17 | تنظیمات | `screens/SettingsScreen.tsx`, `TroubleshootScreen.tsx`, `InfoScreen.tsx` |
| F18 | پومودورو | `SessionEngine.advance`, `StartSessionScreen` |
| F19 | ثبت دستی | `screens/ManualLogScreen.tsx` |
| F20 | هدف روزانه و زنجیره | `services/stats.ts#streak`, `HomeScreen`, تنظیمات |
| F21 | تعداد تست | `SummaryScreen`, گزارش |
| F22 | کارت اشتراک‌گذاری | `focus/Extras.kt#ShareCard` |
| F23 | پوسته‌ی تیره | `src/theme/index.tsx` |
| F24 | ویجت | `focus/Extras.kt#StudyWidget`, `res/layout/widget_study.xml` |
| F25 | پشتیبان با فایل | `services/backup.ts`, `screens/BackupScreen.tsx` |
| F26 | گزارش ماهانه | `ReportScreen#Monthly`, `services/reports.ts#monthlyReport` |
| F27 | محافظت در برابر حذف | `focus/Extras.kt#AdminReceiver`, تنظیمات |
