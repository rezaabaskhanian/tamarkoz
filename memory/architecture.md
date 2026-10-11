# معماری

## دو نیمه
1. **هسته‌ی بومی (Kotlin)** در `android/app/src/main/java/com/tamarkoz/focus/` — قفل بدون React Native کار می‌کند.
2. **React Native (TypeScript)** در `src/` — رابط کاربری، SQLite، گزارش‌ها.

## هسته‌ی بومی
| فایل | کار |
|---|---|
| `SessionEngine.kt` | تنها مالک جلسه‌ی فعال؛ ماشین حالت (RUNNING / EMERGENCY_WAIT → پایان). زمان با `elapsedRealtime`؛ بعد از ریبوت delta صفر است، پس زمان خاموشی کم نمی‌شود. هر ۱۵ ثانیه ذخیره. |
| `FocusService.kt` | سرویس پیش‌زمینه (`specialUse`). صفحه روشن: هر ۵۰۰ms اپ جلو را می‌خواند. صفحه خاموش: فقط حسابداری. هر ۲ ثانیه مجوزها را چک می‌کند؛ لغو → broken. |
| `LockOverlay.kt` | صفحه‌ی قفل بومی (overlay). دکمه‌ی بازگشت و «برگشتم سر درس» → صفحه‌ی اصلی. «پایان جلسه» فقط حالت عادی → `tamarkoz://session?end=1`. |
| `Apps.kt` | `NeverBlock` (خود اپ، لانچر، systemui، تلفن، پیامک، کیبورد، اضطراری)، `ForegroundDetector` (UsageEvents)، فهرست اپ‌ها با کش آیکن. |
| `Scheduler.kt` | `Alarms` (watchdog پنج‌دقیقه‌ای، هشدار دقیق در صورت مجوز)، `Scheduler` (نوبت‌های هفتگی، یادآور ۵ دقیقه قبل، جبران بعد از ریبوت تا ۱۰ دقیقه، missed)، `AlarmReceiver`، `SystemEventsReceiver` (boot، آپدیت اپ، تغییر ساعت/منطقه‌ی زمانی). |
| `FocusStore.kt` | SharedPreferences: جلسه‌ی فعال، config از JS، صف جلسه‌های تمام‌شده و skipها، روز مصرف خروج اضطراری. |
| `Notifications.kt` | کانال‌ها و همه‌ی اعلان‌های F16. |
| `FocusModule.kt` / `BillingModule.kt` | TurboModule (codegen از `src/native/NativeFocus.ts` و `NativeBilling.ts`). داده‌ی ساختاری به شکل JSON رد و بدل می‌شود. |
| `Extras.kt` | ویجت (F24)، مدیر دستگاه (F27)، کارت اشتراک‌گذاری (F22). |

## جریان داده
- JS → بومی: `syncConfig` (فهرست اپ‌ها، نوبت‌ها، premiumUntil، تنظیمات اعلان، تاریخ کنکور، ساعت امروز برای ویجت). در `AppContext` با debounce بعد از هر تغییر.
- بومی → JS: رویدادهای `focusSessionChanged` و `focusSessionEnded`؛ و صف `getPending` که JS با `INSERT OR IGNORE` (کلید `native_id`) به SQLite می‌برد و بعد `ackPending`.
- لینک‌های عمیق: `tamarkoz://home|start|session|summary|permissions|purchase`.

## تصمیم‌های فنی
- شناسه‌ی پکیج `com.tamarkoz` (فعلاً؛ تغییرش به `ir.PREFIX.tamarkoz` بعداً).
- اشتراک ماهانه: چون بازار آفلاین قابل پرسش نیست، بعد از هر بازیابی موفق ۷ روز معتبر حساب می‌شود (`SUBSCRIPTION_GRACE_MS`).
- بسته‌ی «تا روز کنکور» تا پایان ۳۱ مرداد ۱۴۰۶ (`src/config.ts`).
- کاربر رایگان: فهرست اپ‌ها نگه داشته می‌شود ولی فقط ۳ اپ اول اجرا می‌شوند.
- پومودورو فقط در حالت عادی؛ «مدت» یعنی کل زمان مطالعه، استراحت‌ها اضافه می‌شوند.
- جلسه‌ی برنامه‌ی هفتگی بدون درس: آخرین درس استفاده‌شده؛ اگر هیچ درسی نباشد «بدون درس».
