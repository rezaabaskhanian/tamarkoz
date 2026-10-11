package com.tamarkoz.focus

import android.Manifest
import android.app.AlarmManager
import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import androidx.core.content.ContextCompat
import org.json.JSONObject

object Permissions {
  fun hasUsageAccess(ctx: Context): Boolean {
    val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
      } else {
        @Suppress("DEPRECATION")
        ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
      }
    return if (mode == AppOpsManager.MODE_DEFAULT) {
      ctx.checkCallingOrSelfPermission(Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED
    } else {
      mode == AppOpsManager.MODE_ALLOWED
    }
  }

  fun hasOverlay(ctx: Context): Boolean = Settings.canDrawOverlays(ctx)

  fun hasRequired(ctx: Context): Boolean = hasUsageAccess(ctx) && hasOverlay(ctx)

  fun hasNotifications(ctx: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

  fun ignoresBatteryOptimizations(ctx: Context): Boolean =
    (ctx.getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(ctx.packageName)

  fun canScheduleExact(ctx: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      (ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()

  fun status(ctx: Context): JSONObject =
    JSONObject()
      .put("usage", hasUsageAccess(ctx))
      .put("overlay", hasOverlay(ctx))
      .put("notifications", hasNotifications(ctx))
      .put("battery", ignoresBatteryOptimizations(ctx))
      .put("exactAlarm", canScheduleExact(ctx))
      .put("notificationsRuntime", Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
      .put("exactAlarmRuntime", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
      .put("manufacturer", Build.MANUFACTURER.lowercase())

  /** Opens the system screen for one permission. Falls back to the app's details page. */
  fun open(ctx: Context, kind: String) {
    val pkgUri = Uri.parse("package:${ctx.packageName}")
    val intents: List<Intent> =
      when (kind) {
        "usage" -> listOf(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        "overlay" -> listOf(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, pkgUri))
        "notifications" ->
          listOf(
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
          )
        "battery" ->
          listOf(
            @Suppress("BatteryLife") Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkgUri),
            Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
          )
        "exactAlarm" ->
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            listOf(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkgUri))
          } else {
            emptyList()
          }
        "autostart" -> autostartIntents()
        else -> emptyList()
      } + Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkgUri)

    for (intent in intents) {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        ctx.startActivity(intent)
        return
      } catch (e: Exception) {
        // try the next candidate
      }
    }
  }

  // Manufacturer "auto-start" managers. These component names are not public API and
  // change between ROM versions; any failure falls through to the app details page.
  private fun autostartIntents(): List<Intent> {
    val components =
      when (Build.MANUFACTURER.lowercase()) {
        "xiaomi", "redmi", "poco" ->
          listOf(ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"))
        "huawei", "honor" ->
          listOf(
            ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
            ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
          )
        "oppo", "realme" ->
          listOf(ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"))
        "vivo" ->
          listOf(ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"))
        "samsung" ->
          listOf(ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity"))
        else -> emptyList()
      }
    return components.map { Intent().setComponent(it) }
  }
}
