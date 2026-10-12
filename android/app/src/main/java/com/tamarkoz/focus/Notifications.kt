package com.tamarkoz.focus

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import com.tamarkoz.R

object Notifications {
  const val CH_SESSION = "session"
  const val CH_FINISH = "finish"
  const val CH_FINISH_SILENT = "finish_silent"
  const val CH_REMINDERS = "reminders"
  const val CH_ALERTS = "alerts"

  const val ID_SESSION = 1
  const val ID_FINISH = 2
  const val ID_BROKEN = 3
  const val ID_DAILY = 4
  const val ID_EXPIRY = 5
  const val ID_RESTART = 6
  private const val ID_BLOCK_BASE = 1000

  fun ensureChannels(ctx: Context) {
    val nm = ctx.getSystemService(NotificationManager::class.java)
    nm.createNotificationChannels(
      listOf(
        NotificationChannel(CH_SESSION, "جلسه‌ی در حال اجرا", NotificationManager.IMPORTANCE_LOW).apply {
          setShowBadge(false)
        },
        NotificationChannel(CH_FINISH, "پایان جلسه", NotificationManager.IMPORTANCE_HIGH).apply {
          enableVibration(true)
        },
        NotificationChannel(CH_FINISH_SILENT, "پایان جلسه (بی‌صدا)", NotificationManager.IMPORTANCE_HIGH).apply {
          setSound(null, null)
          enableVibration(true)
        },
        NotificationChannel(CH_REMINDERS, "یادآورها", NotificationManager.IMPORTANCE_DEFAULT),
        NotificationChannel(CH_ALERTS, "هشدار قفل", NotificationManager.IMPORTANCE_HIGH),
      )
    )
  }

  fun openApp(ctx: Context, path: String, requestCode: Int = 0): PendingIntent {
    val intent =
      Intent(Intent.ACTION_VIEW, Uri.parse("tamarkoz://$path"))
        .setPackage(ctx.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      ctx,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun base(ctx: Context, channel: String) =
    NotificationCompat.Builder(ctx, channel).setSmallIcon(R.drawable.ic_stat_focus).setColor(0xFF3E5BDB.toInt())

  fun session(ctx: Context, s: ActiveSession): Notification {
    val title =
      when {
        s.state == SessionState.EMERGENCY_WAIT -> "خروج اضطراری در انتظار تأیید"
        s.isBreak -> "استراحت · اپ‌ها باز هستند"
        else -> (if (s.isStudy) "جلسه‌ی ${s.label}" else s.label) + if (s.isStrict) " · حالت سخت" else ""
      }
    val remainingSec = s.remainingMs / 1000
    val countdownMs = if (s.isBreak) (s.breakMs - s.phaseMs) else s.remainingMs
    return base(ctx, CH_SESSION)
      .setContentTitle(title)
      .setContentText("زمان باقی‌مانده: ${Fa.clock(remainingSec)}")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setWhen(System.currentTimeMillis() + countdownMs)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setContentIntent(openApp(ctx, "session"))
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .build()
  }

  fun finished(ctx: Context, label: String, isStudy: Boolean, studiedSec: Long, sound: Boolean) {
    val n =
      base(ctx, if (sound) CH_FINISH else CH_FINISH_SILENT)
        .setContentTitle("جلسه تمام شد 🎉")
        .setContentText(
          if (isStudy) "${Fa.duration(studiedSec / 60)} $label خواندی."
          else "${Fa.duration(studiedSec / 60)} $label بدون گوشی 👏"
        )
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setDefaults(if (sound) NotificationCompat.DEFAULT_ALL else NotificationCompat.DEFAULT_VIBRATE)
        .setContentIntent(openApp(ctx, "summary"))
        .build()
    notify(ctx, ID_FINISH, n)
  }

  fun broken(ctx: Context) {
    val n =
      base(ctx, CH_ALERTS)
        .setContentTitle("قفل از کار افتاد")
        .setContentText("یکی از مجوزهای لازم برداشته شد و جلسه بسته شد. برای درست کردنش بزن.")
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setContentIntent(openApp(ctx, "permissions"))
        .build()
    notify(ctx, ID_BROKEN, n)
  }

  /** Shown when Android refused to restart the lock service from the background. */
  fun needsRestart(ctx: Context) {
    val n =
      base(ctx, CH_ALERTS)
        .setContentTitle("قفل متوقف شده")
        .setContentText("اندروید سرویس قفل را بست. برای ادامه‌ی جلسه اپ را باز کن.")
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setContentIntent(openApp(ctx, "session"))
        .build()
    notify(ctx, ID_RESTART, n)
  }

  fun blockReminder(ctx: Context, block: ScheduleBlock, occurrence: Long) {
    val skip =
      Intent(ctx, AlarmReceiver::class.java)
        .setAction(AlarmReceiver.ACTION_SKIP)
        .putExtra("blockId", block.id)
        .putExtra("occurrence", occurrence)
    val skipPi =
      PendingIntent.getBroadcast(
        ctx,
        (block.id * 4 + 3).toInt(),
        skip,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    val subject =
      when {
        block.activity != "study" -> " (${block.activityName})"
        block.subjectName.isNotEmpty() -> " (${block.subjectName})"
        else -> ""
      }
    val n =
      base(ctx, CH_REMINDERS)
        .setContentTitle("۵ دقیقه تا شروع جلسه$subject")
        .setContentText("قفل خودکار سر وقت روشن می‌شود · ${Fa.duration(block.durationMinutes.toLong())}")
        .setAutoCancel(true)
        .addAction(0, "این نوبت نه", skipPi)
        .setContentIntent(openApp(ctx, "home"))
        .build()
    notify(ctx, ID_BLOCK_BASE + block.id.toInt(), n)
  }

  fun cancelBlockReminder(ctx: Context, blockId: Long) {
    ctx.getSystemService(NotificationManager::class.java).cancel(ID_BLOCK_BASE + blockId.toInt())
  }

  fun daily(ctx: Context) {
    val n =
      base(ctx, CH_REMINDERS)
        .setContentTitle("امروز وقت تمرین است 📚")
        .setContentText("یک جلسه‌ی تمرکز شروع کن؛ هر دقیقه به کنکور نزدیک‌ترت می‌کند.")
        .setAutoCancel(true)
        .setContentIntent(openApp(ctx, "start"))
        .build()
    notify(ctx, ID_DAILY, n)
  }

  fun expiry(ctx: Context) {
    val n =
      base(ctx, CH_REMINDERS)
        .setContentTitle("دسترسی نسخه‌ی کامل به‌زودی تمام می‌شود")
        .setContentText("برای ادامه، اشتراک ۱ یا ۶ ماهه را از بازار بخر. داده‌هایت پاک نمی‌شود.")
        .setAutoCancel(true)
        .setContentIntent(openApp(ctx, "purchase"))
        .build()
    notify(ctx, ID_EXPIRY, n)
  }

  fun cancel(ctx: Context, id: Int) {
    ctx.getSystemService(NotificationManager::class.java).cancel(id)
  }

  private fun notify(ctx: Context, id: Int, n: Notification) {
    if (!Permissions.hasNotifications(ctx)) return
    try {
      ctx.getSystemService(NotificationManager::class.java).notify(id, n)
    } catch (e: SecurityException) {}
  }
}
