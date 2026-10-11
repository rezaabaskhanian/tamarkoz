package com.tamarkoz.focus

import android.content.Context
import android.graphics.Typeface
import java.util.Calendar

/** Persian text helpers for the native screens (lock overlay, notifications, widget). */
object Fa {
  private const val DIGITS = "۰۱۲۳۴۵۶۷۸۹"

  fun digits(value: Any): String =
    value.toString().map { c -> if (c in '0'..'9') DIGITS[c - '0'] else c }.joinToString("")

  private fun pad2(n: Long) = digits(n.toString().padStart(2, '0'))

  /** 125 s → «۰۲:۰۵», 3725 s → «۱:۰۲:۰۵». */
  fun clock(totalSeconds: Long): String {
    val s = totalSeconds.coerceAtLeast(0)
    val h = s / 3600
    val m = (s % 3600) / 60
    val sec = s % 60
    val mmss = "${pad2(m)}:${pad2(sec)}"
    return if (h > 0) "${digits(h)}:$mmss" else mmss
  }

  /** 135 → «۲ ساعت و ۱۵ دقیقه». */
  fun duration(totalMinutes: Long): String {
    val m = totalMinutes.coerceAtLeast(0)
    val h = m / 60
    val r = m % 60
    return when {
      h == 0L -> "${digits(r)} دقیقه"
      r == 0L -> "${digits(h)} ساعت"
      else -> "${digits(h)} ساعت و ${digits(r)} دقیقه"
    }
  }

  val QUOTES =
    listOf(
      "هر دقیقه‌ی تمرکز، یک قدم به روز کنکور نزدیک‌ترت می‌کند.",
      "گوشی صبر می‌کند؛ کنکور نه.",
      "الان فقط همین درس مهم است.",
      "کمی دیگر بمان؛ بعدش با خیال راحت استراحت کن.",
      "عادت‌های کوچک، نتیجه‌های بزرگ می‌سازند.",
      "تو برای این جلسه برنامه ریختی؛ به خودت قول داده‌ای.",
      "پیام‌ها بعد از جلسه هم همان‌جا هستند.",
      "تمرکز مثل ماهیچه است؛ با تمرین قوی‌تر می‌شود.",
    )

  /** Local calendar day as "yyyy-MM-dd". */
  fun dayKey(ms: Long = System.currentTimeMillis()): String {
    val c = Calendar.getInstance().apply { timeInMillis = ms }
    return "%04d-%02d-%02d".format(
      c.get(Calendar.YEAR),
      c.get(Calendar.MONTH) + 1,
      c.get(Calendar.DAY_OF_MONTH),
    )
  }

  fun startOfDay(ms: Long): Long =
    Calendar.getInstance()
      .apply {
        timeInMillis = ms
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      .timeInMillis

  fun nextMidnight(ms: Long = System.currentTimeMillis()): Long =
    Calendar.getInstance()
      .apply {
        timeInMillis = startOfDay(ms)
        add(Calendar.DAY_OF_MONTH, 1)
      }
      .timeInMillis
}

object Fonts {
  private var regular: Typeface? = null
  private var bold: Typeface? = null

  fun regular(ctx: Context): Typeface =
    regular ?: Typeface.createFromAsset(ctx.assets, "fonts/Vazirmatn-Regular.ttf").also { regular = it }

  fun bold(ctx: Context): Typeface =
    bold ?: Typeface.createFromAsset(ctx.assets, "fonts/Vazirmatn-Bold.ttf").also { bold = it }
}
