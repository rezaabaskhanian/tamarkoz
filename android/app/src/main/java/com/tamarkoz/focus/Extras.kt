package com.tamarkoz.focus

import android.app.admin.DeviceAdminReceiver
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.view.View
import android.widget.RemoteViews
import androidx.core.content.FileProvider
import com.tamarkoz.R
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/** Home-screen widget (F24, paid): exam countdown, today's study time, quick start. */
class StudyWidget : AppWidgetProvider() {
  override fun onUpdate(ctx: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) manager.updateAppWidget(id, views(ctx))
  }

  companion object {
    fun updateAll(ctx: Context) {
      val manager = AppWidgetManager.getInstance(ctx)
      val ids = manager.getAppWidgetIds(ComponentName(ctx, StudyWidget::class.java))
      if (ids.isEmpty()) return
      val v = views(ctx)
      for (id in ids) manager.updateAppWidget(id, v)
    }

    private fun views(ctx: Context): RemoteViews {
      val cfg = FocusStore(ctx).config()
      val v = RemoteViews(ctx.packageName, R.layout.widget_study)
      if (!cfg.isPremium()) {
        v.setViewVisibility(R.id.widget_content, View.GONE)
        v.setViewVisibility(R.id.widget_locked, View.VISIBLE)
        v.setOnClickPendingIntent(R.id.widget_root, Notifications.openApp(ctx, "purchase", 11))
        return v
      }
      v.setViewVisibility(R.id.widget_content, View.VISIBLE)
      v.setViewVisibility(R.id.widget_locked, View.GONE)

      val now = System.currentTimeMillis()
      if (cfg.examDate > 0 && cfg.examDate >= Fa.startOfDay(now)) {
        val days = Math.round((Fa.startOfDay(cfg.examDate) - Fa.startOfDay(now)) / 86_400_000.0)
        v.setTextViewText(R.id.widget_days, Fa.digits(days))
        v.setTextViewText(R.id.widget_days_label, "روز تا کنکور")
      } else {
        v.setTextViewText(R.id.widget_days, "—")
        v.setTextViewText(R.id.widget_days_label, "تاریخ کنکور را وارد کن")
      }

      var minutes = if (cfg.todayKey == Fa.dayKey(now)) cfg.todayMinutes.toLong() else 0L
      val s = SessionEngine.active(ctx)
      if (s != null && Fa.dayKey(s.startedAt) == Fa.dayKey(now)) minutes += s.studiedMs / 60_000
      v.setTextViewText(R.id.widget_today, "امروز: ${Fa.duration(minutes)}")
      v.setTextViewText(R.id.widget_start, if (s != null) "جلسه در حال اجرا" else "شروع سریع")
      v.setOnClickPendingIntent(R.id.widget_start, Notifications.openApp(ctx, if (s != null) "session" else "start", 12))
      v.setOnClickPendingIntent(R.id.widget_root, Notifications.openApp(ctx, "home", 13))
      return v
    }
  }
}

/**
 * Device admin (F27). While it is active Android refuses to uninstall the app
 * until admin is turned off in Settings — which strict mode locks during a session.
 */
class AdminReceiver : DeviceAdminReceiver() {
  override fun onDisableRequested(context: Context, intent: Intent): CharSequence =
    "با غیرفعال کردن این گزینه، محافظت در برابر حذف اپ در حالت سخت برداشته می‌شود."
}

/** Draws a shareable study-time card (F22) and opens the system share sheet. */
object ShareCard {
  fun share(ctx: Context, card: JSONObject) {
    val w = 1080
    val h = 1350
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val bg = Paint().apply { shader = LinearGradient(0f, 0f, w.toFloat(), h.toFloat(), 0xFF3E5BDB.toInt(), 0xFF1B2552.toInt(), Shader.TileMode.CLAMP) }
    c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), bg)

    fun draw(text: String, size: Float, y: Float, bold: Boolean, alpha: Int = 255) {
      val p =
        TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
          color = Color.WHITE
          this.alpha = alpha
          textSize = size
          typeface = if (bold) Fonts.bold(ctx) else Fonts.regular(ctx)
        }
      val layout = StaticLayout.Builder.obtain(text, 0, text.length, p, w - 160).setAlignment(Layout.Alignment.ALIGN_CENTER).build()
      c.save()
      c.translate(80f, y)
      layout.draw(c)
      c.restore()
    }

    draw(card.optString("title"), 64f, 300f, false, 220)
    draw(card.optString("value"), 120f, 470f, true)
    draw(card.optString("subtitle"), 52f, 760f, false, 220)
    draw(card.optString("detail"), 44f, 880f, false, 200)
    draw("تمرکز · اپ قفل گوشی برای کنکوری‌ها", 40f, 1180f, false, 180)

    val dir = File(ctx.cacheDir, "share").apply { mkdirs() }
    val file = File(dir, "study-card.png")
    FileOutputStream(file).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    bmp.recycle()

    val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.files", file)
    val send =
      Intent(Intent.ACTION_SEND)
        .setType("image/png")
        .putExtra(Intent.EXTRA_STREAM, uri)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    val chooser = Intent.createChooser(send, "اشتراک‌گذاری").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    ctx.startActivity(chooser)
  }
}
