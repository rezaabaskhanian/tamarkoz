package com.tamarkoz.focus

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.provider.Telephony
import android.telecom.TelecomManager
import android.view.inputmethod.InputMethodManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/** Packages that must never be locked: this app, launchers, system UI, phone, SMS, keyboards, emergency. */
object NeverBlock {
  private val FIXED =
    setOf(
      "com.android.systemui",
      "com.android.phone",
      "com.android.server.telecom",
      "com.android.incallui",
      "com.android.dialer",
      "com.google.android.dialer",
      "com.samsung.android.dialer",
      "com.android.emergency",
      "com.google.android.apps.safetyhub",
      "com.android.permissioncontroller",
      "com.google.android.permissioncontroller",
      "com.android.mms",
      "com.google.android.apps.messaging",
      "com.samsung.android.messaging",
    )

  fun compute(ctx: Context): Set<String> {
    val pm = ctx.packageManager
    val out = HashSet(FIXED)
    out.add(ctx.packageName)
    val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
    pm.queryIntentActivities(home, 0).forEach { out.add(it.activityInfo.packageName) }
    try {
      (ctx.getSystemService(Context.TELECOM_SERVICE) as TelecomManager).defaultDialerPackage?.let { out.add(it) }
    } catch (e: Exception) {}
    try {
      Telephony.Sms.getDefaultSmsPackage(ctx)?.let { out.add(it) }
    } catch (e: Exception) {}
    try {
      (ctx.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).enabledInputMethodList.forEach {
        out.add(it.packageName)
      }
    } catch (e: Exception) {}
    return out
  }

  /** Locked in strict mode when "lock phone settings" is on: the Settings app and the uninstall screens. */
  val SYSTEM_SETTINGS =
    setOf(
      "com.android.settings",
      "com.android.packageinstaller",
      "com.google.android.packageinstaller",
      "com.miui.securitycenter",
    )
}

/** Reads the app currently in front from usage events. */
class ForegroundDetector(ctx: Context) {
  private val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
  private var lastQuery = 0L
  var current: String? = null
    private set

  fun poll(): String? {
    val now = System.currentTimeMillis()
    var begin = if (lastQuery == 0L) now - 60_000 else lastQuery - 2_000
    // The wall clock may have moved backwards (user changed the time).
    if (begin > now || now - begin > 10 * 60_000) begin = now - 60_000
    try {
      val events = usm.queryEvents(begin, now)
      val e = UsageEvents.Event()
      var latestTs = 0L
      while (events.hasNextEvent()) {
        events.getNextEvent(e)
        if (e.eventType == RESUMED && e.timeStamp >= latestTs) {
          latestTs = e.timeStamp
          current = e.packageName
        }
      }
    } catch (e: Exception) {
      // usage access revoked: the service notices through the permission check
    }
    lastQuery = now
    return current
  }

  companion object {
    // UsageEvents.Event.ACTIVITY_RESUMED (API 29) has the same value as the deprecated MOVE_TO_FOREGROUND.
    private const val RESUMED = 1
  }
}

object InstalledApps {
  private val KNOWN_DISTRACTING =
    setOf(
      "org.telegram.messenger",
      "org.telegram.plus",
      "org.thunderdog.challegram",
      "com.whatsapp",
      "com.whatsapp.w4b",
      "com.instagram.android",
      "com.instagram.barcelona",
      "ir.eitaa.messenger",
      "ir.resaneh1.iptv",
      "ir.nasim",
      "mobi.mmdt.ottplus",
      "net.iGap",
      "com.aparat",
      "com.google.android.youtube",
      "com.zhiliaoapp.musically",
      "com.ss.android.ugc.trill",
      "com.twitter.android",
      "com.facebook.katana",
      "com.snapchat.android",
      "com.pinterest",
      "com.reddit.frontpage",
      "com.netflix.mediaclient",
      "ir.filimo.android",
      "com.namava",
      "ir.medu.shad",
      "com.discord",
      "tv.twitch.android.app",
      "com.spotify.music",
    )

  /** Launchable apps (minus never-blocked ones) with cached icon files. */
  fun list(ctx: Context): JSONArray {
    val pm = ctx.packageManager
    val never = NeverBlock.compute(ctx)
    val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val iconDir = File(ctx.cacheDir, "app_icons").apply { mkdirs() }
    val seen = HashSet<String>()
    val out = JSONArray()
    for (ri in pm.queryIntentActivities(launcher, 0)) {
      val pkg = ri.activityInfo.packageName
      if (pkg in never || !seen.add(pkg)) continue
      val ai = ri.activityInfo.applicationInfo
      val version =
        try {
          @Suppress("DEPRECATION") pm.getPackageInfo(pkg, 0).lastUpdateTime
        } catch (e: Exception) {
          0L
        }
      val iconFile = File(iconDir, "${pkg}_$version.png")
      if (!iconFile.exists()) {
        try {
          saveIcon(ri.loadIcon(pm), iconFile)
        } catch (e: Exception) {}
      }
      val category = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ai.category else -1
      val suggested =
        pkg in KNOWN_DISTRACTING ||
          category == ApplicationInfo.CATEGORY_SOCIAL ||
          category == ApplicationInfo.CATEGORY_VIDEO ||
          category == ApplicationInfo.CATEGORY_GAME ||
          (ai.flags and ApplicationInfo.FLAG_IS_GAME) != 0
      out.put(
        JSONObject()
          .put("packageName", pkg)
          .put("label", ri.loadLabel(pm).toString())
          .put("icon", if (iconFile.exists()) "file://${iconFile.absolutePath}" else "")
          .put("suggested", suggested)
      )
    }
    return out
  }

  fun label(ctx: Context, pkg: String): String =
    try {
      val pm = ctx.packageManager
      pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    } catch (e: PackageManager.NameNotFoundException) {
      pkg
    }

  fun isInstalled(ctx: Context, pkg: String): Boolean =
    try {
      ctx.packageManager.getApplicationInfo(pkg, 0)
      true
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }

  private fun saveIcon(d: android.graphics.drawable.Drawable, file: File) {
    val size = 96
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    d.setBounds(0, 0, size, size)
    d.draw(c)
    FileOutputStream(file).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    bmp.recycle()
  }
}
