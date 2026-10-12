package com.tamarkoz.focus

import org.json.JSONArray
import org.json.JSONObject

object SessionState {
  const val RUNNING = "RUNNING"
  const val EMERGENCY_WAIT = "EMERGENCY_WAIT"
}

object EndReason {
  const val COMPLETED = "completed"
  const val ENDED_EARLY = "ended_early"
  const val EMERGENCY = "emergency"
  const val BROKEN = "broken"
}

/**
 * The single active session. Time is accounted on the monotonic clock
 * (SystemClock.elapsedRealtime), never the wall clock, so changing the phone's
 * clock does not change the remaining time.
 */
class ActiveSession(
  val id: String,
  var state: String,
  val mode: String, // normal | strict
  val source: String, // manual | schedule
  val subjectId: Long,
  val subjectName: String,
  val topic: String, // chapter / topic, may be empty
  val kind: String, // study | practice | test
  // What the session is for: "study" (counts as study time) or another activity
  // such as sleep / deep_work / meal / rest / exercise / custom:<id>.
  val activity: String,
  val activityName: String, // display name for non-study activities («خواب»)
  val scheduleBlockId: Long, // -1 when not from the weekly schedule
  val startedAt: Long, // wall clock, only for the history record
  var plannedMs: Long, // total study time including "+10 minutes"
  var studiedMs: Long,
  val blocked: MutableSet<String>,
  var blockedAttempts: Int,
  val blockSystemSettings: Boolean, // strict mode only
  // Pomodoro (F18): workMs == 0 means a plain session.
  val workMs: Long,
  val breakMs: Long,
  var phase: String, // work | break
  var phaseMs: Long,
  // Monotonic anchor of the last accounting step.
  var anchorElapsed: Long,
  var anchorBoot: Int,
  // Emergency exit wait (strict mode).
  var emergencyElapsed: Long,
  var emergencyBoot: Int,
) {
  val remainingMs: Long
    get() = (plannedMs - studiedMs).coerceAtLeast(0)

  val isStrict: Boolean
    get() = mode == "strict"

  val isBreak: Boolean
    get() = workMs > 0 && phase == "break"

  val isStudy: Boolean
    get() = activity == "study"

  /** «ریاضیات · مشتق» or «خواب» for the lock screen and notification. */
  val label: String
    get() =
      when {
        !isStudy -> activityName
        topic.isNotEmpty() -> "$subjectName · $topic"
        else -> subjectName
      }

  fun toJson(): JSONObject =
    JSONObject()
      .put("id", id)
      .put("state", state)
      .put("mode", mode)
      .put("source", source)
      .put("subjectId", subjectId)
      .put("subjectName", subjectName)
      .put("topic", topic)
      .put("kind", kind)
      .put("activity", activity)
      .put("activityName", activityName)
      .put("scheduleBlockId", scheduleBlockId)
      .put("startedAt", startedAt)
      .put("plannedMs", plannedMs)
      .put("studiedMs", studiedMs)
      .put("blocked", JSONArray(blocked.toList()))
      .put("blockedAttempts", blockedAttempts)
      .put("blockSystemSettings", blockSystemSettings)
      .put("workMs", workMs)
      .put("breakMs", breakMs)
      .put("phase", phase)
      .put("phaseMs", phaseMs)
      .put("anchorElapsed", anchorElapsed)
      .put("anchorBoot", anchorBoot)
      .put("emergencyElapsed", emergencyElapsed)
      .put("emergencyBoot", emergencyBoot)

  companion object {
    fun fromJson(o: JSONObject): ActiveSession =
      ActiveSession(
        id = o.getString("id"),
        state = o.getString("state"),
        mode = o.getString("mode"),
        source = o.optString("source", "manual"),
        subjectId = o.getLong("subjectId"),
        subjectName = o.optString("subjectName"),
        topic = o.optString("topic", ""),
        kind = o.optString("kind", "study"),
        activity = o.optString("activity", "study"),
        activityName = o.optString("activityName", ""),
        scheduleBlockId = o.optLong("scheduleBlockId", -1),
        startedAt = o.getLong("startedAt"),
        plannedMs = o.getLong("plannedMs"),
        studiedMs = o.getLong("studiedMs"),
        blocked = o.getJSONArray("blocked").toStringList().toMutableSet(),
        blockedAttempts = o.optInt("blockedAttempts"),
        blockSystemSettings = o.optBoolean("blockSystemSettings"),
        workMs = o.optLong("workMs"),
        breakMs = o.optLong("breakMs"),
        phase = o.optString("phase", "work"),
        phaseMs = o.optLong("phaseMs"),
        anchorElapsed = o.getLong("anchorElapsed"),
        anchorBoot = o.optInt("anchorBoot"),
        emergencyElapsed = o.optLong("emergencyElapsed"),
        emergencyBoot = o.optInt("emergencyBoot"),
      )
  }
}

class ScheduleBlock(
  val id: Long,
  val weekday: Int, // 0 = Saturday … 6 = Friday
  val startMinute: Int,
  val durationMinutes: Int,
  val subjectId: Long, // -1 = none
  val subjectName: String,
  val mode: String,
  val enabled: Boolean,
  val activity: String, // "study" or another activity key
  val activityName: String,
  // One-off blocks (study marathon): no occurrence at or after this moment runs. 0 = weekly forever.
  val expiresAt: Long,
) {
  fun runsAt(occurrence: Long) = expiresAt <= 0 || occurrence < expiresAt
}

/** Everything the native side needs while React Native is not running; pushed by JS via syncConfig. */
class FocusConfig(val raw: JSONObject) {
  val blockedApps: List<String> = raw.optJSONArray("blockedApps").toStringList()
  val scheduleEnabled = raw.optBoolean("scheduleEnabled", true)
  val premiumUntil = raw.optLong("premiumUntil", 0)
  val blockSystemSettingsInStrict = raw.optBoolean("blockSystemSettingsInStrict", true)
  val defaultSubjectId = raw.optLong("defaultSubjectId", -1)
  val defaultSubjectName: String = raw.optString("defaultSubjectName", "")
  val finishSound = raw.optBoolean("finishSound", true)
  val scheduleReminder = raw.optBoolean("scheduleReminder", true)
  val dailyReminder = raw.optBoolean("dailyReminder", false)
  val dailyReminderMinute = raw.optInt("dailyReminderMinute", 17 * 60)
  val expiryReminder = raw.optBoolean("expiryReminder", true)
  val expiryReminderAt = raw.optLong("expiryReminderAt", 0) // 0 = nothing expires
  val examDate = raw.optLong("examDate", 0)
  val todayKey: String = raw.optString("todayKey", "")
  val todayMinutes = raw.optInt("todayMinutes", 0)
  val darkTheme = raw.optBoolean("darkTheme", false)
  /** «چرا درس می‌خوانم؟» — the user's own reason, shown on the lock screen. */
  val motivation: String = raw.optString("motivation", "")

  val blocks: List<ScheduleBlock> =
    raw.optJSONArray("blocks")?.let { arr ->
      (0 until arr.length()).map { i ->
        val b = arr.getJSONObject(i)
        ScheduleBlock(
          id = b.getLong("id"),
          weekday = b.getInt("weekday"),
          startMinute = b.getInt("startMinute"),
          durationMinutes = b.getInt("durationMinutes"),
          subjectId = b.optLong("subjectId", -1),
          subjectName = b.optString("subjectName", ""),
          mode = b.optString("mode", "normal"),
          enabled = b.optBoolean("enabled", true),
          activity = b.optString("activity", "study"),
          activityName = b.optString("activityName", ""),
          expiresAt = b.optLong("expiresAt", 0),
        )
      }
    } ?: emptyList()

  fun isPremium(now: Long = System.currentTimeMillis()) = premiumUntil > now
}

fun JSONArray?.toStringList(): List<String> =
  if (this == null) emptyList() else (0 until length()).map { getString(it) }
