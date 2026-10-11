package com.tamarkoz.focus

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import java.util.Calendar
import kotlin.math.min

object Alarms {
  private const val CODE_WATCHDOG = 2_000_000_000
  const val CODE_DAILY = 2_000_000_001
  const val CODE_EXPIRY = 2_000_000_002
  private const val WATCHDOG_MS = 5 * 60_000L

  fun pending(ctx: Context, code: Int, extras: Intent.() -> Unit = {}): PendingIntent {
    // One action for every alarm: PendingIntent identity is (action, component, request code),
    // so any alarm can be cancelled from its code alone.
    val intent = Intent(ctx, AlarmReceiver::class.java).setAction(AlarmReceiver.ACTION_ALARM).apply(extras)
    return PendingIntent.getBroadcast(ctx, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun set(ctx: Context, type: Int, at: Long, pi: PendingIntent) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    try {
      if (Permissions.canScheduleExact(ctx)) am.setExactAndAllowWhileIdle(type, at, pi)
      else am.setAndAllowWhileIdle(type, at, pi)
    } catch (e: SecurityException) {
      am.setAndAllowWhileIdle(type, at, pi)
    }
  }

  fun cancel(ctx: Context, code: Int) {
    (ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pending(ctx, code))
  }

  /** Brings the lock service back within five minutes if Android kills it, and ends the session on time. */
  fun scheduleWatchdog(ctx: Context, s: ActiveSession) {
    val delay = min(WATCHDOG_MS, s.remainingMs + 1_000)
    val pi = pending(ctx, CODE_WATCHDOG) { putExtra("type", AlarmReceiver.TYPE_WATCHDOG) }
    set(ctx, AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + delay, pi)
  }

  fun cancelWatchdog(ctx: Context) = cancel(ctx, CODE_WATCHDOG)
}

/** Weekly schedule (F13), daily reminder and purchase-expiry reminder (F16). */
object Scheduler {
  private const val REMIND_BEFORE_MS = 5 * 60_000L
  private const val LATE_START_MS = 10 * 60_000L

  private fun weekdayOf(c: Calendar) = c.get(Calendar.DAY_OF_WEEK) % 7 // Saturday = 0

  private fun at(dayStart: Long, minuteOfDay: Int): Long =
    Calendar.getInstance()
      .apply {
        timeInMillis = dayStart
        set(Calendar.HOUR_OF_DAY, minuteOfDay / 60)
        set(Calendar.MINUTE, minuteOfDay % 60)
      }
      .timeInMillis

  private fun dayStart(base: Long, offsetDays: Int): Long =
    Calendar.getInstance()
      .apply {
        timeInMillis = Fa.startOfDay(base)
        add(Calendar.DAY_OF_MONTH, offsetDays)
      }
      .timeInMillis

  /** First start strictly after [from]. */
  fun nextOccurrence(b: ScheduleBlock, from: Long): Long {
    for (d in 0..7) {
      val day = dayStart(from, d)
      val c = Calendar.getInstance().apply { timeInMillis = day }
      if (weekdayOf(c) != b.weekday) continue
      val t = at(day, b.startMinute)
      if (t > from) return t
    }
    return -1
  }

  /** Latest start at or before [atOrBefore], within the past week. */
  fun lastOccurrence(b: ScheduleBlock, atOrBefore: Long): Long {
    for (d in 0 downTo -7) {
      val day = dayStart(atOrBefore, d)
      val c = Calendar.getInstance().apply { timeInMillis = day }
      if (weekdayOf(c) != b.weekday) continue
      val t = at(day, b.startMinute)
      if (t <= atOrBefore) return t
    }
    return -1
  }

  private fun codeStart(id: Long) = (id * 4).toInt()

  private fun codeRemind(id: Long) = (id * 4 + 1).toInt()

  fun rescheduleAll(ctx: Context) {
    val store = FocusStore(ctx)
    for (code in store.scheduledAlarmCodes) Alarms.cancel(ctx, code)
    val cfg = store.config()
    val now = System.currentTimeMillis()
    val codes = HashSet<Int>()

    if (cfg.scheduleEnabled && cfg.isPremium(now)) {
      for (b in cfg.blocks) {
        if (!b.enabled) continue
        val occ = nextOccurrence(b, now)
        if (occ < 0) continue
        if (cfg.scheduleReminder && occ - REMIND_BEFORE_MS > now) {
          val pi =
            Alarms.pending(ctx, codeRemind(b.id)) {
              putExtra("type", AlarmReceiver.TYPE_REMIND)
              putExtra("blockId", b.id)
              putExtra("occurrence", occ)
            }
          Alarms.set(ctx, AlarmManager.RTC_WAKEUP, occ - REMIND_BEFORE_MS, pi)
          codes.add(codeRemind(b.id))
        }
        val pi =
          Alarms.pending(ctx, codeStart(b.id)) {
            putExtra("type", AlarmReceiver.TYPE_START)
            putExtra("blockId", b.id)
            putExtra("occurrence", occ)
          }
        Alarms.set(ctx, AlarmManager.RTC_WAKEUP, occ, pi)
        codes.add(codeStart(b.id))
      }
    }

    if (cfg.dailyReminder) {
      var t = at(Fa.startOfDay(now), cfg.dailyReminderMinute)
      if (t <= now) t = at(dayStart(now, 1), cfg.dailyReminderMinute)
      Alarms.set(ctx, AlarmManager.RTC_WAKEUP, t, Alarms.pending(ctx, Alarms.CODE_DAILY) { putExtra("type", AlarmReceiver.TYPE_DAILY) })
      codes.add(Alarms.CODE_DAILY)
    }

    if (cfg.expiryReminder && cfg.expiryReminderAt > now) {
      Alarms.set(
        ctx,
        AlarmManager.RTC_WAKEUP,
        cfg.expiryReminderAt,
        Alarms.pending(ctx, Alarms.CODE_EXPIRY) { putExtra("type", AlarmReceiver.TYPE_EXPIRY) },
      )
      codes.add(Alarms.CODE_EXPIRY)
    }

    store.scheduledAlarmCodes = codes
  }

  /**
   * Called after JS pushes a new config: everything already in the past counts as
   * handled, so a new or edited block is never reported as "missed".
   */
  fun markPastHandled(ctx: Context) {
    val store = FocusStore(ctx)
    val now = System.currentTimeMillis()
    for (b in store.config().blocks) {
      val last = lastOccurrence(b, now)
      if (last > store.lastHandled(b.id)) store.setLastHandled(b.id, last)
    }
  }

  fun onStart(ctx: Context, blockId: Long, occurrence: Long) {
    val store = FocusStore(ctx)
    val cfg = store.config()
    store.setLastHandled(blockId, occurrence)
    Notifications.cancelBlockReminder(ctx, blockId)
    val b = cfg.blocks.find { it.id == blockId } ?: return
    if (!b.enabled || !cfg.scheduleEnabled || !cfg.isPremium()) return
    if (store.isSkipped(blockId, occurrence)) return
    // Another session is running: this block does not run.
    if (SessionEngine.active(ctx) != null) return
    val end = occurrence + b.durationMinutes * 60_000L
    val err = SessionEngine.startScheduled(ctx, b, end)
    if (err == "missing_permissions") {
      store.addPendingSkip(blockId, Fa.startOfDay(occurrence), "missed")
      Notifications.broken(ctx)
    }
  }

  fun onRemind(ctx: Context, blockId: Long, occurrence: Long) {
    val cfg = FocusStore(ctx).config()
    val b = cfg.blocks.find { it.id == blockId } ?: return
    if (!b.enabled || !cfg.scheduleEnabled || !cfg.isPremium() || !cfg.scheduleReminder) return
    if (SessionEngine.active(ctx) != null) return
    Notifications.blockReminder(ctx, b, occurrence)
  }

  /** «این نوبت نه» from the reminder notification. */
  fun skip(ctx: Context, blockId: Long, occurrence: Long) {
    val store = FocusStore(ctx)
    store.markSkipped(blockId, occurrence)
    store.addPendingSkip(blockId, Fa.startOfDay(occurrence), "skipped")
    Notifications.cancelBlockReminder(ctx, blockId)
  }

  /**
   * After boot or a clock change. A block whose start passed while the phone was off
   * starts late if we are within ten minutes (with its original end time); otherwise
   * it is recorded as missed.
   */
  fun catchUp(ctx: Context) {
    val store = FocusStore(ctx)
    val cfg = store.config()
    if (!cfg.scheduleEnabled || !cfg.isPremium()) return
    val now = System.currentTimeMillis()
    for (b in cfg.blocks) {
      if (!b.enabled) continue
      val occ = lastOccurrence(b, now)
      if (occ <= 0 || occ <= store.lastHandled(b.id)) continue
      if (now - occ <= LATE_START_MS) {
        onStart(ctx, b.id, occ)
      } else {
        if (!store.isSkipped(b.id, occ)) store.addPendingSkip(b.id, Fa.startOfDay(occ), "missed")
        store.setLastHandled(b.id, occ)
      }
    }
  }
}

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    Notifications.ensureChannels(ctx)
    when (intent.action) {
      ACTION_SKIP -> {
        Scheduler.skip(ctx, intent.getLongExtra("blockId", -1), intent.getLongExtra("occurrence", 0))
        return
      }
      ACTION_ALARM -> {}
      else -> return
    }
    when (intent.getStringExtra("type")) {
      TYPE_WATCHDOG -> {
        val s = SessionEngine.tick(ctx) ?: return
        FocusService.start(ctx)
        Alarms.scheduleWatchdog(ctx, s)
      }
      TYPE_START -> {
        Scheduler.onStart(ctx, intent.getLongExtra("blockId", -1), intent.getLongExtra("occurrence", 0))
        Scheduler.rescheduleAll(ctx)
      }
      TYPE_REMIND -> Scheduler.onRemind(ctx, intent.getLongExtra("blockId", -1), intent.getLongExtra("occurrence", 0))
      TYPE_DAILY -> {
        if (SessionEngine.active(ctx) == null) Notifications.daily(ctx)
        Scheduler.rescheduleAll(ctx)
      }
      TYPE_EXPIRY -> Notifications.expiry(ctx)
    }
  }

  companion object {
    const val ACTION_ALARM = "com.tamarkoz.focus.ALARM"
    const val ACTION_SKIP = "com.tamarkoz.focus.SKIP_BLOCK"
    const val TYPE_WATCHDOG = "watchdog"
    const val TYPE_START = "start"
    const val TYPE_REMIND = "remind"
    const val TYPE_DAILY = "daily"
    const val TYPE_EXPIRY = "expiry"
  }
}

/** Boot, app update and clock/time-zone changes. */
class SystemEventsReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    Notifications.ensureChannels(ctx)
    val s = SessionEngine.active(ctx)
    if (s != null) {
      FocusService.start(ctx)
      Alarms.scheduleWatchdog(ctx, s)
    }
    Scheduler.catchUp(ctx)
    Scheduler.rescheduleAll(ctx)
    StudyWidget.updateAll(ctx)
  }
}
