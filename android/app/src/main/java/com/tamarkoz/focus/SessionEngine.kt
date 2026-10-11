package com.tamarkoz.focus

import android.content.Context
import android.os.SystemClock
import android.provider.Settings
import org.json.JSONObject
import java.util.UUID
import kotlin.math.min
import kotlin.math.roundToLong

/**
 * Owner of the active session (state machine of the spec). Every caller — lock
 * service, alarms, the RN module — goes through here, so there is exactly one
 * in-memory copy per process, backed by FocusStore.
 */
object SessionEngine {
  const val STRICT_MAX_MINUTES = 240
  const val EMERGENCY_WAIT_MS = 60_000L
  private const val HEARTBEAT_MS = 15_000L

  private var cached: ActiveSession? = null
  private var loaded = false
  private var lastSavedElapsed = 0L

  /** Set by the RN module to forward "changed" / "ended" events to JS. */
  @Volatile var listener: ((event: String, payload: JSONObject?) -> Unit)? = null

  private fun bootCount(ctx: Context): Int =
    Settings.Global.getInt(ctx.contentResolver, Settings.Global.BOOT_COUNT, 0)

  private fun ensureLoaded(ctx: Context) {
    if (!loaded) {
      cached = FocusStore(ctx).loadActive()
      loaded = true
    }
  }

  @Synchronized
  fun active(ctx: Context): ActiveSession? {
    ensureLoaded(ctx)
    val s = cached ?: return null
    advance(ctx, s)
    return s
  }

  /**
   * Moves the session forward by the monotonic time since its anchor. After a
   * reboot elapsedRealtime restarts, so the delta is 0: the session continues
   * from the last saved time and the time the phone was off is not subtracted.
   */
  private fun advance(ctx: Context, s: ActiveSession) {
    val now = SystemClock.elapsedRealtime()
    val boot = bootCount(ctx)
    var delta = if (boot == s.anchorBoot && now >= s.anchorElapsed) now - s.anchorElapsed else 0L
    s.anchorElapsed = now
    s.anchorBoot = boot
    if (s.emergencyElapsed > 0 && s.emergencyBoot != boot) {
      // A reboot during the emergency wait restarts the 60-second countdown.
      s.emergencyElapsed = now
      s.emergencyBoot = boot
    }
    while (delta > 0 && s.studiedMs < s.plannedMs) {
      if (s.workMs <= 0) {
        val take = min(delta, s.plannedMs - s.studiedMs)
        s.studiedMs += take
        delta -= take
      } else if (s.phase == "work") {
        if (s.phaseMs >= s.workMs) {
          s.phase = "break"
          s.phaseMs = 0
          continue
        }
        val take = minOf(delta, s.workMs - s.phaseMs, s.plannedMs - s.studiedMs)
        s.studiedMs += take
        s.phaseMs += take
        delta -= take
      } else {
        val take = min(delta, s.breakMs - s.phaseMs)
        s.phaseMs += take
        delta -= take
        if (s.phaseMs >= s.breakMs) {
          s.phase = "work"
          s.phaseMs = 0
        }
      }
    }
    if (now - lastSavedElapsed >= HEARTBEAT_MS) save(ctx, s, sync = false)
  }

  private fun save(ctx: Context, s: ActiveSession?, sync: Boolean) {
    FocusStore(ctx).saveActive(s, sync)
    lastSavedElapsed = SystemClock.elapsedRealtime()
  }

  /** Called by the lock service loop. Returns null once the session has ended. */
  @Synchronized
  fun tick(ctx: Context): ActiveSession? {
    val s = active(ctx) ?: return null
    if (s.remainingMs <= 0) {
      finishLocked(ctx, s, EndReason.COMPLETED)
      return null
    }
    return s
  }

  @Synchronized
  fun start(ctx: Context, req: JSONObject): JSONObject {
    ensureLoaded(ctx)
    if (cached != null) return error("already_active")
    if (!Permissions.hasRequired(ctx)) return error("missing_permissions")
    val mode = req.optString("mode", "normal")
    var minutes = req.optInt("plannedMinutes", 0)
    if (minutes < 1) return error("invalid_duration")
    if (mode == "strict") minutes = min(minutes, STRICT_MAX_MINUTES)
    val pomodoro = req.optJSONObject("pomodoro")
    val s =
      create(
        ctx,
        mode = mode,
        source = req.optString("source", "manual"),
        subjectId = req.getLong("subjectId"),
        subjectName = req.optString("subjectName"),
        scheduleBlockId = -1,
        plannedMs = minutes * 60_000L,
        blocked = req.optJSONArray("blocked").toStringList(),
        workMs = (pomodoro?.optInt("work") ?: 0) * 60_000L,
        breakMs = (pomodoro?.optInt("break") ?: 0) * 60_000L,
      ) ?: return error("no_apps")
    begin(ctx, s)
    return JSONObject().put("ok", true).put("session", snapshot(s))
  }

  /** Weekly schedule start (F13). The end time is fixed, so a late start is shorter. */
  @Synchronized
  fun startScheduled(ctx: Context, b: ScheduleBlock, endWall: Long): String? {
    ensureLoaded(ctx)
    if (cached != null) return "already_active"
    if (!Permissions.hasRequired(ctx)) return "missing_permissions"
    val cfg = FocusStore(ctx).config()
    val subjectId = if (b.subjectId > 0) b.subjectId else cfg.defaultSubjectId
    val subjectName = if (b.subjectId > 0) b.subjectName else cfg.defaultSubjectName
    var plannedMs = endWall - System.currentTimeMillis()
    if (b.mode == "strict") plannedMs = min(plannedMs, STRICT_MAX_MINUTES * 60_000L)
    if (plannedMs < 60_000) return "too_late"
    val s =
      create(
        ctx,
        mode = b.mode,
        source = "schedule",
        subjectId = subjectId,
        subjectName = subjectName.ifEmpty { "بدون درس" },
        scheduleBlockId = b.id,
        plannedMs = plannedMs,
        blocked = cfg.blockedApps,
        workMs = 0,
        breakMs = 0,
      ) ?: return "no_apps"
    begin(ctx, s)
    return null
  }

  private fun create(
    ctx: Context,
    mode: String,
    source: String,
    subjectId: Long,
    subjectName: String,
    scheduleBlockId: Long,
    plannedMs: Long,
    blocked: List<String>,
    workMs: Long,
    breakMs: Long,
  ): ActiveSession? {
    val never = NeverBlock.compute(ctx)
    val apps = blocked.filter { it !in never && InstalledApps.isInstalled(ctx, it) }.toMutableSet()
    if (apps.isEmpty()) return null
    val cfg = FocusStore(ctx).config()
    return ActiveSession(
      id = UUID.randomUUID().toString(),
      state = SessionState.RUNNING,
      mode = mode,
      source = source,
      subjectId = subjectId,
      subjectName = subjectName,
      scheduleBlockId = scheduleBlockId,
      startedAt = System.currentTimeMillis(),
      plannedMs = plannedMs,
      studiedMs = 0,
      blocked = apps,
      blockedAttempts = 0,
      blockSystemSettings = mode == "strict" && cfg.blockSystemSettingsInStrict,
      workMs = workMs,
      breakMs = if (workMs > 0) breakMs.coerceAtLeast(60_000) else 0,
      phase = "work",
      phaseMs = 0,
      anchorElapsed = SystemClock.elapsedRealtime(),
      anchorBoot = bootCount(ctx),
      emergencyElapsed = 0,
      emergencyBoot = 0,
    )
  }

  private fun begin(ctx: Context, s: ActiveSession) {
    cached = s
    save(ctx, s, sync = true)
    FocusService.start(ctx)
    Alarms.scheduleWatchdog(ctx, s)
    StudyWidget.updateAll(ctx)
    listener?.invoke("changed", snapshot(s))
  }

  @Synchronized
  fun finish(ctx: Context, reason: String) {
    val s = active(ctx) ?: return
    finishLocked(ctx, s, reason)
  }

  private fun finishLocked(ctx: Context, s: ActiveSession, reason: String) {
    val store = FocusStore(ctx)
    val now = System.currentTimeMillis()
    val recorded = s.studiedMs >= 60_000 // sessions under one minute are not recorded
    val record =
      JSONObject()
        .put("nativeId", s.id)
        .put("subjectId", s.subjectId)
        .put("subjectName", s.subjectName)
        .put("mode", s.mode)
        .put("source", s.source)
        .put("plannedMinutes", (s.plannedMs / 60_000.0).roundToLong())
        .put("actualSeconds", s.studiedMs / 1000)
        .put("startedAt", s.startedAt)
        .put("endedAt", now)
        .put("endReason", reason)
        .put("blockedAttempts", s.blockedAttempts)
        .put("scheduleBlockId", if (s.scheduleBlockId > 0) s.scheduleBlockId else JSONObject.NULL)
        .put("recorded", recorded)
    if (recorded) store.addPendingSession(record)
    store.setLastFinished(record)
    if (reason == EndReason.EMERGENCY) store.emergencyDay = Fa.dayKey()
    cached = null
    save(ctx, null, sync = true)
    Alarms.cancelWatchdog(ctx)
    FocusService.stop(ctx)
    Notifications.cancel(ctx, Notifications.ID_SESSION)
    when (reason) {
      EndReason.COMPLETED -> Notifications.finished(ctx, s.subjectName, s.studiedMs / 1000, store.config().finishSound)
      EndReason.BROKEN -> Notifications.broken(ctx)
    }
    StudyWidget.updateAll(ctx)
    listener?.invoke("ended", record)
  }

  @Synchronized
  fun endEarly(ctx: Context): JSONObject {
    val s = active(ctx) ?: return error("no_session")
    if (s.isStrict) return error("strict")
    finishLocked(ctx, s, EndReason.ENDED_EARLY)
    return JSONObject().put("ok", true)
  }

  @Synchronized
  fun addMinutes(ctx: Context, minutes: Int): JSONObject {
    val s = active(ctx) ?: return error("no_session")
    s.plannedMs += minutes.coerceIn(1, 120) * 60_000L
    save(ctx, s, sync = true)
    Alarms.scheduleWatchdog(ctx, s)
    listener?.invoke("changed", snapshot(s))
    return JSONObject().put("ok", true).put("session", snapshot(s))
  }

  @Synchronized
  fun requestEmergency(ctx: Context): JSONObject {
    val s = active(ctx) ?: return error("no_session")
    if (!s.isStrict) return error("not_strict")
    if (FocusStore(ctx).emergencyDay == Fa.dayKey()) return error("used_today")
    if (s.state != SessionState.EMERGENCY_WAIT) {
      s.state = SessionState.EMERGENCY_WAIT
      s.emergencyElapsed = SystemClock.elapsedRealtime()
      s.emergencyBoot = bootCount(ctx)
      save(ctx, s, sync = true)
    }
    listener?.invoke("changed", snapshot(s))
    return JSONObject().put("ok", true).put("session", snapshot(s))
  }

  @Synchronized
  fun cancelEmergency(ctx: Context): JSONObject {
    val s = active(ctx) ?: return error("no_session")
    s.state = SessionState.RUNNING
    s.emergencyElapsed = 0
    save(ctx, s, sync = true)
    listener?.invoke("changed", snapshot(s))
    return JSONObject().put("ok", true).put("session", snapshot(s))
  }

  @Synchronized
  fun confirmEmergency(ctx: Context): JSONObject {
    val s = active(ctx) ?: return error("no_session")
    if (s.state != SessionState.EMERGENCY_WAIT) return error("not_waiting")
    if (SystemClock.elapsedRealtime() - s.emergencyElapsed < EMERGENCY_WAIT_MS) return error("too_early")
    if (FocusStore(ctx).emergencyDay == Fa.dayKey()) return error("used_today")
    finishLocked(ctx, s, EndReason.EMERGENCY)
    return JSONObject().put("ok", true)
  }

  fun emergencyStatus(ctx: Context): JSONObject {
    val used = FocusStore(ctx).emergencyDay == Fa.dayKey()
    return JSONObject().put("usedToday", used).put("releaseAt", if (used) Fa.nextMidnight() else 0)
  }

  /** Normal mode only: apps can be added during a session, never removed. */
  @Synchronized
  fun addBlocked(ctx: Context, packages: List<String>): JSONObject {
    val s = active(ctx) ?: return error("no_session")
    if (s.isStrict) return error("strict")
    val never = NeverBlock.compute(ctx)
    s.blocked.addAll(packages.filter { it !in never })
    save(ctx, s, sync = true)
    return JSONObject().put("ok", true).put("session", snapshot(s))
  }

  @Synchronized
  fun recordAttempt(ctx: Context) {
    val s = cached ?: return
    s.blockedAttempts++
    save(ctx, s, sync = false)
    listener?.invoke("changed", snapshot(s))
  }

  @Synchronized
  fun clearAll(ctx: Context) {
    cached = null
    loaded = true
    Alarms.cancelWatchdog(ctx)
    FocusService.stop(ctx)
    FocusStore(ctx).clearAll()
  }

  fun snapshot(s: ActiveSession): JSONObject {
    val o = s.toJson()
    o.put("remainingMs", s.remainingMs)
    o.put("phaseRemainingMs", if (s.workMs > 0) (if (s.isBreak) s.breakMs else s.workMs) - s.phaseMs else 0)
    o.put(
      "emergencyWaitMs",
      if (s.state == SessionState.EMERGENCY_WAIT) SystemClock.elapsedRealtime() - s.emergencyElapsed else 0,
    )
    return o
  }

  private fun error(code: String) = JSONObject().put("ok", false).put("error", code)
}
