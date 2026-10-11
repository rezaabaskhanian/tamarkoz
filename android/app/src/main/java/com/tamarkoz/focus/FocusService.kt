package com.tamarkoz.focus

import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Foreground service that runs only during a session (F05). While the screen is
 * on it reads the foreground app every 500 ms and covers forbidden apps with the
 * native lock overlay (F06). It never depends on React Native.
 */
class FocusService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var detector: ForegroundDetector
  private lateinit var overlay: LockOverlay
  private var never: Set<String> = emptySet()
  private var neverComputedAt = 0L
  private var screenOn = true
  private var lastPermCheck = 0L
  private var lastNotify = 0L
  private var lastPhase = ""
  private var lastState = ""
  private var lockedPkg: String? = null

  private val screenReceiver =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        screenOn = intent.action != Intent.ACTION_SCREEN_OFF
        handler.removeCallbacks(loop)
        handler.post(loop)
      }
    }

  private val loop = Runnable { step() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    Notifications.ensureChannels(this)
    detector = ForegroundDetector(this)
    overlay = LockOverlay(this)
    screenOn = (getSystemService(Context.POWER_SERVICE) as PowerManager).isInteractive
    val filter =
      IntentFilter().apply {
        addAction(Intent.ACTION_SCREEN_ON)
        addAction(Intent.ACTION_SCREEN_OFF)
      }
    ContextCompat.registerReceiver(this, screenReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val s = SessionEngine.active(this)
    if (s == null) {
      stopSelf()
      return START_NOT_STICKY
    }
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
    ServiceCompat.startForeground(this, Notifications.ID_SESSION, Notifications.session(this, s), type)
    Notifications.cancel(this, Notifications.ID_RESTART)
    Alarms.scheduleWatchdog(this, s)
    handler.removeCallbacks(loop)
    handler.post(loop)
    return START_STICKY
  }

  private fun step() {
    val s = SessionEngine.tick(this)
    if (s == null) {
      overlay.hide()
      stopSelf()
      return
    }
    val now = SystemClock.elapsedRealtime()

    if (now - lastPermCheck > 2_000) {
      lastPermCheck = now
      if (!Permissions.hasRequired(this)) {
        overlay.hide()
        SessionEngine.finish(this, EndReason.BROKEN)
        return
      }
    }

    if (screenOn) {
      if (now - neverComputedAt > 60_000) {
        never = NeverBlock.compute(this)
        neverComputedAt = now
      }
      val fg = detector.poll()
      val shouldLock =
        fg != null &&
          !s.isBreak &&
          fg !in never &&
          (fg in s.blocked || (s.blockSystemSettings && fg in NeverBlock.SYSTEM_SETTINGS))
      if (shouldLock) {
        if (lockedPkg != fg) {
          lockedPkg = fg
          SessionEngine.recordAttempt(this)
        }
        overlay.show(s, InstalledApps.label(this, fg!!))
      } else {
        lockedPkg = null
        overlay.hide()
      }
    }

    val phaseOrState = s.phase + s.state
    if (now - lastNotify > 15_000 || phaseOrState != lastPhase + lastState) {
      lastNotify = now
      lastPhase = s.phase
      lastState = s.state
      try {
        getSystemService(android.app.NotificationManager::class.java)
          .notify(Notifications.ID_SESSION, Notifications.session(this, s))
      } catch (e: SecurityException) {}
    }

    val delay = if (screenOn) 500L else minOf(15_000L, s.remainingMs.coerceAtLeast(250))
    handler.postDelayed(loop, delay)
  }

  override fun onDestroy() {
    handler.removeCallbacks(loop)
    overlay.hide()
    try {
      unregisterReceiver(screenReceiver)
    } catch (e: Exception) {}
    super.onDestroy()
  }

  companion object {
    /** Returns false when Android refused to start a foreground service from the background. */
    fun start(ctx: Context): Boolean =
      try {
        ContextCompat.startForegroundService(ctx, Intent(ctx, FocusService::class.java))
        true
      } catch (e: Exception) {
        Notifications.ensureChannels(ctx)
        Notifications.needsRestart(ctx)
        false
      }

    fun stop(ctx: Context) {
      ctx.stopService(Intent(ctx, FocusService::class.java))
    }
  }
}
