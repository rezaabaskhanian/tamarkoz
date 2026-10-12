package com.tamarkoz.focus

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.tamarkoz.specs.NativeFocusSpec
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

class FocusModule(private val ctx: ReactApplicationContext) : NativeFocusSpec(ctx), ActivityEventListener {
  private val io = Executors.newSingleThreadExecutor()
  private var pendingExport: Pair<String, Promise>? = null
  private var pendingImport: Promise? = null

  init {
    ctx.addActivityEventListener(this)
    Notifications.ensureChannels(ctx)
    SessionEngine.listener = { event, payload ->
      try {
        ctx.emitDeviceEvent(
          if (event == "ended") "focusSessionEnded" else "focusSessionChanged",
          payload?.toString(),
        )
      } catch (e: Exception) {}
    }
    // Opening the app is a good moment to make sure an active session's service is alive.
    SessionEngine.active(ctx)?.let { FocusService.start(ctx) }
  }

  override fun invalidate() {
    SessionEngine.listener = null
    ctx.removeActivityEventListener(this)
    super.invalidate()
  }

  private fun async(promise: Promise, block: () -> Any?) {
    io.execute {
      try {
        promise.resolve(block())
      } catch (e: Exception) {
        promise.reject("E_FOCUS", e.message, e)
      }
    }
  }

  // --- permissions & apps ---

  override fun getPermissionStatus(promise: Promise) = async(promise) { Permissions.status(ctx).toString() }

  override fun openPermissionSettings(kind: String) {
    Permissions.open(ctx.currentActivity ?: ctx, kind)
  }

  override fun getInstalledApps(promise: Promise) = async(promise) { InstalledApps.list(ctx).toString() }

  override fun getDeviceInfo(promise: Promise) =
    async(promise) {
      JSONObject()
        .put("manufacturer", Build.MANUFACTURER.lowercase())
        .put("brand", Build.BRAND.lowercase())
        .put("sdk", Build.VERSION.SDK_INT)
        .put("release", Build.VERSION.RELEASE)
        .put("appVersion", com.tamarkoz.BuildConfig.VERSION_NAME)
        .put("appVersionCode", com.tamarkoz.BuildConfig.VERSION_CODE)
        // Survives «clear data»; only a full uninstall resets it. Used for the 7-day free trial.
        .put("firstInstallTime", ctx.packageManager.getPackageInfo(ctx.packageName, 0).firstInstallTime)
        .toString()
    }

  // --- config ---

  override fun syncConfig(configJson: String) {
    io.execute {
      FocusStore(ctx).saveConfig(configJson)
      Scheduler.markPastHandled(ctx)
      Scheduler.rescheduleAll(ctx)
      StudyWidget.updateAll(ctx)
    }
  }

  // --- session ---

  override fun startSession(requestJson: String, promise: Promise) =
    async(promise) { SessionEngine.start(ctx, JSONObject(requestJson)).toString() }

  override fun getActiveSession(promise: Promise) =
    async(promise) { SessionEngine.active(ctx)?.let { SessionEngine.snapshot(it).toString() } ?: "" }

  override fun addMinutes(minutes: Double, promise: Promise) =
    async(promise) { SessionEngine.addMinutes(ctx, minutes.toInt()).toString() }

  override fun endEarly(promise: Promise) = async(promise) { SessionEngine.endEarly(ctx).toString() }

  override fun requestEmergency(promise: Promise) = async(promise) { SessionEngine.requestEmergency(ctx).toString() }

  override fun cancelEmergency(promise: Promise) = async(promise) { SessionEngine.cancelEmergency(ctx).toString() }

  override fun confirmEmergency(promise: Promise) = async(promise) { SessionEngine.confirmEmergency(ctx).toString() }

  override fun getEmergencyStatus(promise: Promise) = async(promise) { SessionEngine.emergencyStatus(ctx).toString() }

  override fun addBlockedApps(packagesJson: String, promise: Promise) =
    async(promise) { SessionEngine.addBlocked(ctx, JSONArray(packagesJson).toStringList()).toString() }

  // --- results waiting for SQLite ---

  override fun getPending(promise: Promise) =
    async(promise) {
      val store = FocusStore(ctx)
      JSONObject()
        .put("sessions", store.pendingSessions())
        .put("skips", store.pendingSkips())
        .put("emergencyUsedOn", store.emergencyDay ?: JSONObject.NULL)
        .toString()
    }

  override fun ackPending(nativeIdsJson: String, skipKeysJson: String) {
    io.execute {
      FocusStore(ctx).ack(JSONArray(nativeIdsJson).toStringList().toSet(), JSONArray(skipKeysJson).toStringList().toSet())
    }
  }

  override fun getLastFinished(promise: Promise) = async(promise) { FocusStore(ctx).lastFinished()?.toString() ?: "" }

  // --- share, backup ---

  override fun shareCard(cardJson: String) {
    io.execute {
      try {
        ShareCard.share(ctx.currentActivity ?: ctx, JSONObject(cardJson))
      } catch (e: Exception) {}
    }
  }

  override fun shareReportPdf(reportJson: String, promise: Promise) =
    async(promise) { ReportPdf.share(ctx.currentActivity ?: ctx, JSONObject(reportJson)) }

  override fun exportBackup(fileName: String, content: String, promise: Promise) {
    val activity = ctx.currentActivity ?: return promise.reject("E_NO_ACTIVITY", "no activity")
    pendingExport = content to promise
    val intent =
      Intent(Intent.ACTION_CREATE_DOCUMENT)
        .addCategory(Intent.CATEGORY_OPENABLE)
        .setType("application/json")
        .putExtra(Intent.EXTRA_TITLE, fileName)
    activity.startActivityForResult(intent, REQ_EXPORT)
  }

  override fun importBackup(promise: Promise) {
    val activity = ctx.currentActivity ?: return promise.reject("E_NO_ACTIVITY", "no activity")
    pendingImport = promise
    val intent =
      Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
    activity.startActivityForResult(intent, REQ_IMPORT)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    when (requestCode) {
      REQ_EXPORT -> {
        val (content, promise) = pendingExport ?: return
        pendingExport = null
        val uri = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null) return promise.resolve(false)
        io.execute {
          try {
            ctx.contentResolver.openOutputStream(uri, "wt")!!.use { it.write(content.toByteArray(Charsets.UTF_8)) }
            promise.resolve(true)
          } catch (e: Exception) {
            promise.reject("E_EXPORT", e.message, e)
          }
        }
      }
      REQ_IMPORT -> {
        val promise = pendingImport ?: return
        pendingImport = null
        val uri = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null) return promise.resolve("")
        io.execute {
          try {
            val text = ctx.contentResolver.openInputStream(uri)!!.use { it.readBytes().toString(Charsets.UTF_8) }
            promise.resolve(text)
          } catch (e: Exception) {
            promise.reject("E_IMPORT", e.message, e)
          }
        }
      }
    }
  }

  override fun onNewIntent(intent: Intent) {}

  // --- device admin (F27) ---

  private val admin by lazy { ComponentName(ctx, AdminReceiver::class.java) }

  private val dpm by lazy { ctx.getSystemService(DevicePolicyManager::class.java) }

  override fun isDeviceAdminActive(promise: Promise) = async(promise) { dpm.isAdminActive(admin) }

  override fun requestDeviceAdmin() {
    val intent =
      Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
        .putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin)
        .putExtra(
          DevicePolicyManager.EXTRA_ADD_EXPLANATION,
          "با فعال کردن این گزینه، حذف اپ تا وقتی این دسترسی را در تنظیمات گوشی خاموش نکنی ممکن نیست. در حالت سخت تنظیمات گوشی قفل است.",
        )
    val activity = ctx.currentActivity
    if (activity != null) activity.startActivity(intent) else ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  override fun removeDeviceAdmin() {
    if (SessionEngine.active(ctx)?.isStrict == true) return
    try {
      dpm.removeActiveAdmin(admin)
    } catch (e: Exception) {}
  }

  override fun clearNativeData(promise: Promise) =
    async(promise) {
      if (SessionEngine.active(ctx) != null) return@async false
      // Cancel alarms first: rescheduling with an empty config clears every known alarm code.
      FocusStore(ctx).saveConfig("{}")
      Scheduler.rescheduleAll(ctx)
      SessionEngine.clearAll(ctx)
      StudyWidget.updateAll(ctx)
      true
    }

  companion object {
    const val NAME = NativeFocusSpec.NAME
    private const val REQ_EXPORT = 7101
    private const val REQ_IMPORT = 7102
  }
}
