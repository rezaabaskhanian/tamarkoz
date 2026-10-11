package com.tamarkoz.focus

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Native-side persistent state. Lives in SharedPreferences so the lock service,
 * alarms and receivers work without React Native. JS drains finished sessions
 * and schedule skips from here into SQLite (getPending / ackPending).
 */
class FocusStore(ctx: Context) {
  private val prefs: SharedPreferences =
    ctx.applicationContext.getSharedPreferences("focus_store", Context.MODE_PRIVATE)

  // --- active session ---

  fun loadActive(): ActiveSession? =
    prefs.getString(KEY_ACTIVE, null)?.let {
      try {
        ActiveSession.fromJson(JSONObject(it))
      } catch (e: Exception) {
        null
      }
    }

  /** [sync] = true for state transitions (commit), false for 15-second heartbeats (apply). */
  fun saveActive(s: ActiveSession?, sync: Boolean) {
    val e = prefs.edit()
    if (s == null) e.remove(KEY_ACTIVE) else e.putString(KEY_ACTIVE, s.toJson().toString())
    if (sync) e.commit() else e.apply()
  }

  // --- config pushed from JS ---

  fun config(): FocusConfig =
    FocusConfig(prefs.getString(KEY_CONFIG, null)?.let { JSONObject(it) } ?: JSONObject())

  fun saveConfig(json: String) {
    prefs.edit().putString(KEY_CONFIG, json).commit()
  }

  // --- finished sessions waiting for JS ---

  fun pendingSessions(): JSONArray = JSONArray(prefs.getString(KEY_PENDING, "[]"))

  fun addPendingSession(o: JSONObject) {
    val arr = pendingSessions().put(o)
    prefs.edit().putString(KEY_PENDING, arr.toString()).commit()
  }

  fun pendingSkips(): JSONArray = JSONArray(prefs.getString(KEY_SKIPS, "[]"))

  fun addPendingSkip(blockId: Long, date: Long, reason: String) {
    val arr = pendingSkips()
    val key = "$blockId:$date"
    for (i in 0 until arr.length()) if (arr.getJSONObject(i).optString("key") == key) return
    arr.put(JSONObject().put("key", key).put("blockId", blockId).put("date", date).put("reason", reason))
    prefs.edit().putString(KEY_SKIPS, arr.toString()).commit()
  }

  fun ack(nativeIds: Set<String>, skipKeys: Set<String>) {
    val sessions = pendingSessions()
    val keptSessions = JSONArray()
    for (i in 0 until sessions.length()) {
      val o = sessions.getJSONObject(i)
      if (o.getString("nativeId") !in nativeIds) keptSessions.put(o)
    }
    val skips = pendingSkips()
    val keptSkips = JSONArray()
    for (i in 0 until skips.length()) {
      val o = skips.getJSONObject(i)
      if (o.getString("key") !in skipKeys) keptSkips.put(o)
    }
    prefs.edit().putString(KEY_PENDING, keptSessions.toString()).putString(KEY_SKIPS, keptSkips.toString()).commit()
  }

  fun lastFinished(): JSONObject? = prefs.getString(KEY_LAST_FINISHED, null)?.let { JSONObject(it) }

  fun setLastFinished(o: JSONObject) {
    prefs.edit().putString(KEY_LAST_FINISHED, o.toString()).commit()
  }

  // --- emergency exit quota: once per calendar day ---

  var emergencyDay: String?
    get() = prefs.getString(KEY_EMERGENCY_DAY, null)
    set(v) {
      prefs.edit().putString(KEY_EMERGENCY_DAY, v).commit()
    }

  // --- weekly schedule bookkeeping ---

  /** Last occurrence (wall ms) of each block that was started, skipped or marked missed. */
  fun lastHandled(blockId: Long): Long = JSONObject(prefs.getString(KEY_HANDLED, "{}")).optLong(blockId.toString(), 0)

  fun setLastHandled(blockId: Long, occurrence: Long) {
    val o = JSONObject(prefs.getString(KEY_HANDLED, "{}"))
    o.put(blockId.toString(), occurrence)
    prefs.edit().putString(KEY_HANDLED, o.toString()).commit()
  }

  fun isSkipped(blockId: Long, occurrence: Long): Boolean =
    JSONArray(prefs.getString(KEY_SKIPPED_OCC, "[]")).toStringList().contains("$blockId:$occurrence")

  fun markSkipped(blockId: Long, occurrence: Long) {
    val now = System.currentTimeMillis()
    // Keep only recent entries so the list does not grow forever.
    val list =
      JSONArray(prefs.getString(KEY_SKIPPED_OCC, "[]")).toStringList().filter {
        (it.substringAfter(':').toLongOrNull() ?: 0) > now - 2 * DAY_MS
      } + "$blockId:$occurrence"
    prefs.edit().putString(KEY_SKIPPED_OCC, JSONArray(list).toString()).commit()
  }

  var scheduledAlarmCodes: Set<Int>
    get() = JSONArray(prefs.getString(KEY_ALARM_CODES, "[]")).toStringList().map { it.toInt() }.toSet()
    set(v) {
      prefs.edit().putString(KEY_ALARM_CODES, JSONArray(v.map { it.toString() }).toString()).commit()
    }

  fun clearAll() {
    prefs.edit().clear().commit()
  }

  companion object {
    const val DAY_MS = 24 * 60 * 60 * 1000L
    private const val KEY_ACTIVE = "active"
    private const val KEY_CONFIG = "config"
    private const val KEY_PENDING = "pending_sessions"
    private const val KEY_SKIPS = "pending_skips"
    private const val KEY_LAST_FINISHED = "last_finished"
    private const val KEY_EMERGENCY_DAY = "emergency_day"
    private const val KEY_HANDLED = "schedule_last_handled"
    private const val KEY_SKIPPED_OCC = "schedule_skipped_occ"
    private const val KEY_ALARM_CODES = "alarm_codes"
  }
}
