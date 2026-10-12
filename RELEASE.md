# انتشار نسخه‌ی اندروید تمرکز (کافه‌بازار)

## ۱. نسخه
فقط این دو خط در [android/gradle.properties](android/gradle.properties) را عوض کنید:
```properties
APP_VERSION_NAME=1.0.0   # نسخه‌ای که کاربر می‌بیند (در تنظیمات ← درباره هم همین نشان داده می‌شود)
APP_VERSION_CODE=1       # در هر بارگذاری روی بازار دست‌کم ۱ واحد بیشتر شود
```
هر APK معماری versionCode جداگانه می‌گیرد: `versionCode × 1000 + (1 برای armeabi-v7a، 2 برای arm64-v8a)`.
مثلاً برای نسخه‌ی ۱، این دو عدد 1001 و 1002 می‌شوند.

## ۲. کلید امضای انتشار (فقط یک بار)
> ⚠️ کافه‌بازار آپدیت‌ها را **فقط با همان کلیدی** قبول می‌کند که اولین نسخه با آن امضا شده. اگر این کلید یا رمزش گم شود،
> دیگر نمی‌شود آپدیت داد. از فایل keystore و رمزها جایی امن و بیرون از git نسخه‌ی پشتیبان بگیرید.

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 \
  -keystore tamarkoz-release.keystore -alias tamarkoz \
  -keyalg RSA -keysize 2048 -validity 10000
```

بعد فایل `android/keystore.properties` را بسازید. این فایل در git نیست و نباید کامیت شود:
```properties
storeFile=tamarkoz-release.keystore
storePassword=رمزی_که_وارد_کردید
keyAlias=tamarkoz
keyPassword=رمزی_که_وارد_کردید
```
مسیر `storeFile` نسبت به پوشه‌ی `android/app` حساب می‌شود.

اگر این فایل نباشد، build نسخه‌ی release عمداً خطا می‌دهد تا نسخه‌ای که با کلید debug امضا شده به بازار نرود.

## ۳. کلید پرداخت بازار
کلید RSA بخش «پرداخت درون‌برنامه‌ای» پیشخان بازار را در `android/gradle.properties` بگذارید:
```properties
BAZAAR_RSA_KEY=MIHN...
```
و در همان بخش دو محصول از نوع **درون‌برنامه‌ای (in-app)، نه اشتراکی** بسازید:
- `tamarkoz_1m` — اشتراک ۱ ماهه (۳۰ روز)
- `tamarkoz_6m` — اشتراک ۶ ماهه (۱۸۰ روز)

مدت هر طرح در [src/config.ts](src/config.ts) (`PLANS`) است و قیمت از خود بازار خوانده می‌شود.
هر نصب تازه ۷ روز همه‌ی امکانات را رایگان دارد (`TRIAL_DAYS`).

## ۴. ساخت خروجی
```bash
cd android
./gradlew clean assembleRelease
```
خروجی در `android/app/build/outputs/apk/release/` ساخته می‌شود:
- `Tamarkoz-v1.0.0-1-arm64-v8a-release.apk` برای گوشی‌های جدید (۶۴ بیتی)
- `Tamarkoz-v1.0.0-1-armeabi-v7a-release.apk` برای گوشی‌های قدیمی (۳۲ بیتی)

هر دو را در بازار بارگذاری کنید؛ بازار به هر گوشی نسخه‌ی مناسبش را می‌دهد.

## تنظیمات کاهش حجم (مثل LingoFlow)
- **فقط دو معماری:** `armeabi-v7a` و `arm64-v8a`. x86 فقط برای شبیه‌ساز است و کنار گذاشته شد.
  اگر روی شبیه‌ساز x86 تست می‌کنید: `./gradlew installDebug -PreactNativeArchitectures=x86_64`.
- **APK جدا برای هر معماری** به‌جای یک APK حجیم که همه را دارد.
- **R8 / ProGuard** (`minifyEnabled`) کد جاوا و کاتلین استفاده‌نشده را حذف می‌کند. قواعد نگه‌داشتن در
  [proguard-rules.pro](android/app/proguard-rules.pro) است.
- **shrinkResources** منابع استفاده‌نشده را حذف می‌کند.
- **localeFilters = fa** ترجمه‌های زبان‌های دیگر کتابخانه‌ها را حذف می‌کند (اپ فقط فارسی است).
- آیکن اپ برداری (vector) است و فونت فقط در سه وزن آمده.

اگر بعد از روشن شدن R8 چیزی در نسخه‌ی release کار نکرد که در debug کار می‌کرد (معمولاً crash هنگام باز شدن)،
خطای `ClassNotFoundException` یا `NoSuchMethodError` را از `adb logcat` پیدا کنید و یک خط `-keep` برای آن کلاس
در proguard-rules.pro اضافه کنید.

## آیکن
- آیکن داخل اپ: `android/app/src/main/res/drawable/ic_launcher_foreground.xml` و `ic_launcher_background.xml` (adaptive و themed).
- آیکن ۵۱۲×۵۱۲ برای صفحه‌ی بازار: [store/icon-512.png](store/icon-512.png).
