package com.tamarkoz.focus

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.pdf.PdfDocument
import android.text.Layout
import android.text.StaticLayout
import android.text.TextDirectionHeuristics
import android.text.TextPaint
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * Study report as a PDF for a counselor (built on the phone, shared by the user —
 * nothing is uploaded). All strings arrive already formatted in Persian from JS;
 * this class only lays them out right-to-left on A4 pages.
 */
object ReportPdf {
  private const val W = 595 // A4 in PostScript points
  private const val H = 842
  private const val M = 40f // page margin
  private const val CONTENT_W = W - 2 * M

  private val PRIMARY = Color.parseColor("#3E5BDB")
  private val TEXT = Color.parseColor("#1C2033")
  private val MUTED = Color.parseColor("#6B7086")
  private val TINT = Color.parseColor("#F0F1FB")
  private val BORDER = Color.parseColor("#ECEDF5")

  fun share(ctx: Context, report: JSONObject): Boolean {
    val file = render(ctx, report)
    val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.files", file)
    val send =
      Intent(Intent.ACTION_SEND)
        .setType("application/pdf")
        .putExtra(Intent.EXTRA_STREAM, uri)
        .putExtra(Intent.EXTRA_SUBJECT, report.optString("title"))
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    ctx.startActivity(Intent.createChooser(send, "ارسال گزارش").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    return true
  }

  private class Writer(val ctx: Context, val doc: PdfDocument, val footer: String) {
    var page: PdfDocument.Page? = null
    var y = 0f
    var pageNo = 0
    val canvas: Canvas
      get() = page!!.canvas

    fun newPage() {
      finishPage()
      pageNo++
      page = doc.startPage(PdfDocument.PageInfo.Builder(W, H, pageNo).create())
      y = M
    }

    fun finishPage() {
      page?.let {
        // footer on every page
        text("$footer  ·  صفحه‌ی ${Fa.digits(pageNo)}", 8f, MUTED, y = H - M + 8, align = Layout.Alignment.ALIGN_CENTER)
        doc.finishPage(it)
      }
      page = null
    }

    /** Starts a new page if fewer than [needed] points are left. */
    fun ensure(needed: Float) {
      if (page == null || y + needed > H - M - 16) newPage()
    }

    fun paint(size: Float, color: Int, bold: Boolean) =
      TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = size
        this.color = color
        typeface = if (bold) Fonts.bold(ctx) else Fonts.regular(ctx)
      }

    /** Draws RTL text at the current (or given) y; returns its height. ALIGN_NORMAL = right edge. */
    fun text(
      s: String,
      size: Float,
      color: Int = TEXT,
      bold: Boolean = false,
      x: Float = M,
      width: Float = CONTENT_W,
      y: Float = this.y,
      align: Layout.Alignment = Layout.Alignment.ALIGN_NORMAL,
    ): Float {
      val layout =
        StaticLayout.Builder.obtain(s, 0, s.length, paint(size, color, bold), width.toInt())
          .setAlignment(align)
          .setTextDirection(TextDirectionHeuristics.RTL)
          .setLineSpacing(0f, 1.15f)
          .build()
      canvas.save()
      canvas.translate(x, y)
      layout.draw(canvas)
      canvas.restore()
      return layout.height.toFloat()
    }

    fun rect(l: Float, t: Float, r: Float, b: Float, color: Int, radius: Float = 6f) {
      canvas.drawRoundRect(RectF(l, t, r, b), radius, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
    }

    fun section(title: String) {
      ensure(60f)
      y += 14f
      y += text(title, 13f, PRIMARY, bold = true)
      y += 4f
      canvas.drawLine(M, y, W - M, y, Paint().apply { color = BORDER; strokeWidth = 1f })
      y += 8f
    }
  }

  private fun render(ctx: Context, r: JSONObject): File {
    val doc = PdfDocument()
    val w = Writer(ctx, doc, r.optString("footer"))
    w.newPage()

    // Header band
    w.rect(M, w.y, W - M, w.y + 78f, PRIMARY, 10f)
    w.text(r.optString("title"), 18f, Color.WHITE, bold = true, x = M + 16, width = CONTENT_W - 32, y = w.y + 12)
    w.text(r.optString("period"), 11f, Color.WHITE, x = M + 16, width = CONTENT_W - 32, y = w.y + 40)
    val meta = listOf(r.optString("field"), r.optString("examLine")).filter { it.isNotEmpty() }.joinToString("  ·  ")
    if (meta.isNotEmpty()) {
      w.text(meta, 10f, Color.WHITE, x = M + 16, width = CONTENT_W - 32, y = w.y + 40, align = Layout.Alignment.ALIGN_OPPOSITE)
    }
    w.y += 92f

    // Summary tiles, three per row
    val summary = r.optJSONArray("summary") ?: JSONArray()
    val cols = 3
    val gap = 8f
    val tileW = (CONTENT_W - gap * (cols - 1)) / cols
    for (i in 0 until summary.length()) {
      val item = summary.getJSONObject(i)
      val c = i % cols
      if (c == 0) w.ensure(54f)
      // column 0 is the rightmost in RTL
      val right = W - M - c * (tileW + gap)
      val left = right - tileW
      w.rect(left, w.y, right, w.y + 46f, TINT)
      w.text(item.optString("value"), 13f, TEXT, bold = true, x = left + 8, width = tileW - 16, y = w.y + 6)
      w.text(item.optString("label"), 8.5f, MUTED, x = left + 8, width = tileW - 16, y = w.y + 27)
      if (c == cols - 1 || i == summary.length() - 1) w.y += 54f
    }

    // Days
    val days = r.optJSONArray("days") ?: JSONArray()
    if (days.length() > 0) {
      w.section(r.optString("daysTitle", "مطالعه‌ی هر روز"))
      var max = 1
      for (i in 0 until days.length()) max = maxOf(max, days.getJSONObject(i).optInt("minutes"))
      val labelW = 110f
      val valueW = 90f
      val barMax = CONTENT_W - labelW - valueW - 16
      for (i in 0 until days.length()) {
        val d = days.getJSONObject(i)
        w.ensure(20f)
        w.text(d.optString("label"), 9.5f, TEXT, x = W - M - labelW, width = labelW, y = w.y)
        val barRight = W - M - labelW - 8
        val len = barMax * d.optInt("minutes") / max
        w.rect(barRight - barMax, w.y + 3, barRight, w.y + 13, TINT, 4f)
        if (len > 0) w.rect(barRight - len, w.y + 3, barRight, w.y + 13, PRIMARY, 4f)
        w.text(d.optString("text"), 9.5f, MUTED, x = M, width = valueW, y = w.y, align = Layout.Alignment.ALIGN_OPPOSITE)
        w.y += 19f
      }
    }

    // Subjects
    val subjects = r.optJSONArray("subjects") ?: JSONArray()
    if (subjects.length() > 0) {
      w.section("سهم هر درس")
      val labelW = 130f
      val valueW = 120f
      val barMax = CONTENT_W - labelW - valueW - 16
      for (i in 0 until subjects.length()) {
        val sub = subjects.getJSONObject(i)
        w.ensure(20f)
        val color = try { Color.parseColor(sub.optString("color")) } catch (e: Exception) { PRIMARY }
        canvas(w).drawCircle(W - M - 4, w.y + 8, 4f, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
        w.text(sub.optString("name"), 9.5f, TEXT, x = W - M - labelW, width = labelW - 14, y = w.y)
        val barRight = W - M - labelW - 8
        val len = barMax * sub.optDouble("share", 0.0).toFloat()
        w.rect(barRight - barMax, w.y + 3, barRight, w.y + 13, TINT, 4f)
        if (len > 0) w.rect(barRight - len, w.y + 3, barRight, w.y + 13, color, 4f)
        w.text(sub.optString("text"), 9.5f, MUTED, x = M, width = valueW, y = w.y, align = Layout.Alignment.ALIGN_OPPOSITE)
        w.y += 19f
      }
    }

    // Sessions table
    val sessions = r.optJSONArray("sessions") ?: JSONArray()
    if (sessions.length() > 0) {
      w.section("فهرست جلسه‌ها")
      val dateW = 120f
      val durW = 110f
      val noteW = 70f
      for (i in 0 until sessions.length()) {
        val x = sessions.getJSONObject(i)
        w.ensure(18f)
        if (i % 2 == 0) w.rect(M, w.y - 2, W - M, w.y + 15, TINT, 3f)
        w.text(x.optString("date"), 9f, MUTED, x = W - M - dateW - 4, width = dateW, y = w.y)
        w.text(
          x.optString("subject"),
          9f,
          TEXT,
          bold = true,
          x = M + durW + noteW,
          width = CONTENT_W - dateW - durW - noteW - 8,
          y = w.y,
        )
        w.text(x.optString("note"), 8.5f, MUTED, x = M + durW, width = noteW, y = w.y)
        w.text(x.optString("duration"), 9f, TEXT, x = M + 4, width = durW, y = w.y, align = Layout.Alignment.ALIGN_OPPOSITE)
        w.y += 17f
      }
    }

    r.optString("note").takeIf { it.isNotEmpty() }?.let {
      w.ensure(40f)
      w.y += 14f
      w.y += w.text(it, 8.5f, MUTED)
    }

    w.finishPage()
    val dir = File(ctx.cacheDir, "share").apply { mkdirs() }
    val file = File(dir, r.optString("fileName", "tamarkoz-report.pdf"))
    FileOutputStream(file).use { doc.writeTo(it) }
    doc.close()
    return file
  }

  private fun canvas(w: Writer) = w.canvas
}
