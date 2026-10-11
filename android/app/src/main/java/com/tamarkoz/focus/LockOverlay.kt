package com.tamarkoz.focus

import android.content.Context
import android.content.Intent
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.tamarkoz.R

/**
 * Native full-screen lock (F06), drawn as a system overlay above the forbidden app.
 * Visual design: memory/ui/_3. No ads and no purchase buttons.
 * Back and «برگشتم سر درسم» both go to the home screen.
 */
class LockOverlay(private val ctx: Context) {
  private val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var root: View? = null
  private lateinit var titleView: TextView
  private lateinit var timeView: TextView
  private lateinit var subjectView: TextView
  private lateinit var attemptsView: TextView
  private lateinit var endLink: TextView
  private var quote = Fa.QUOTES.random()

  fun show(s: ActiveSession, appLabel: String) {
    if (root == null) {
      quote = Fa.QUOTES.random()
      val view = build()
      val params =
        WindowManager.LayoutParams(
          WindowManager.LayoutParams.MATCH_PARENT,
          WindowManager.LayoutParams.MATCH_PARENT,
          WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
          WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
          PixelFormat.OPAQUE,
        )
      params.gravity = Gravity.CENTER
      try {
        wm.addView(view, params)
        root = view
      } catch (e: Exception) {
        return // overlay permission revoked; the service will end the session as broken
      }
    }
    titleView.text = "$appLabel فعلاً قفل است!"
    timeView.text = Fa.clock(s.remainingMs / 1000)
    subjectView.text = "درس جاری:  ●  ${s.subjectName}"
    if (s.blockedAttempts > 1) {
      attemptsView.visibility = View.VISIBLE
      attemptsView.text = "⚠  این جلسه ${Fa.digits(s.blockedAttempts)} بار سعی کردی بیای اینجا!"
    } else {
      attemptsView.visibility = View.GONE
    }
    // Strict mode has no way to end the session from the lock screen.
    endLink.visibility = if (s.isStrict) View.GONE else View.VISIBLE
  }

  fun hide() {
    root?.let {
      try {
        wm.removeViewImmediate(it)
      } catch (e: Exception) {}
    }
    root = null
  }

  private fun goHome() {
    val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      ctx.startActivity(home)
    } catch (e: Exception) {}
    hide()
  }

  private fun openSession() {
    val intent =
      Intent(Intent.ACTION_VIEW, Uri.parse("tamarkoz://session?end=1"))
        .setPackage(ctx.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    try {
      ctx.startActivity(intent)
    } catch (e: Exception) {}
    hide()
  }

  private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, ctx.resources.displayMetrics)

  private fun rounded(color: Int, radiusDp: Float) =
    GradientDrawable().apply {
      setColor(color)
      cornerRadius = dp(radiusDp)
    }

  private fun build(): View {
    val white = 0xFFFFFFFF.toInt()
    val muted = 0xB3FFFFFF.toInt()
    val glass = 0x1AFFFFFF // translucent white panels
    val regular = Fonts.regular(ctx)
    val bold = Fonts.bold(ctx)

    val frame =
      object : FrameLayout(ctx) {
        override fun dispatchKeyEvent(event: KeyEvent): Boolean {
          if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP) goHome()
            return true
          }
          return super.dispatchKeyEvent(event)
        }
      }
    frame.background =
      GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(0xFF1E2A6E.toInt(), 0xFF1B2552.toInt(), 0xFF2B2C5E.toInt()),
      )
    frame.layoutDirection = View.LAYOUT_DIRECTION_RTL
    frame.isFocusable = true
    frame.isFocusableInTouchMode = true

    fun text(size: Float, color: Int, isBold: Boolean = false) =
      TextView(ctx).apply {
        setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
        setTextColor(color)
        typeface = if (isBold) bold else regular
        gravity = Gravity.CENTER
        textDirection = View.TEXT_DIRECTION_RTL
        setLineSpacing(0f, 1.25f)
      }

    fun pill(view: TextView, bg: Int) =
      view.apply {
        background = rounded(bg, 22f)
        val h = dp(16f).toInt()
        val v = dp(8f).toInt()
        setPadding(h, v, h, v)
      }

    fun gap(dpValue: Float) = View(ctx).apply { minimumHeight = dp(dpValue).toInt() }

    val col =
      LinearLayout(ctx).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        val pad = dp(24f).toInt()
        setPadding(pad, dp(40f).toInt(), pad, pad)
      }

    val tag = pill(text(13f, white).apply { text = "●  قفل تمرکز فعال است" }, glass)

    val lockCircle =
      FrameLayout(ctx).apply {
        background = GradientDrawable().apply {
          shape = GradientDrawable.OVAL
          setColor(0x26FFFFFF)
        }
        addView(
          ImageView(ctx).apply {
            setImageResource(R.drawable.ic_stat_focus)
            setColorFilter(white)
          },
          FrameLayout.LayoutParams(dp(44f).toInt(), dp(44f).toInt(), Gravity.CENTER),
        )
      }

    titleView = text(24f, white, true)
    val subtitle = text(14f, muted).apply { text = "اپ‌های حواس‌پرت‌کن تا پایان جلسه قفل می‌مانند." }

    val timeCard =
      LinearLayout(ctx).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        background = rounded(glass, 24f)
        val p = dp(20f).toInt()
        setPadding(p, p, p, p)
      }
    val timeLabel = text(13f, muted).apply { text = "زمان باقی‌مانده از جلسه" }
    timeView = text(60f, white, true).apply { textDirection = View.TEXT_DIRECTION_LTR }
    subjectView = pill(text(13f, 0xFFD9CCFF.toInt()), 0x1AFFFFFF)
    timeCard.addView(timeLabel)
    timeCard.addView(timeView)
    timeCard.addView(subjectView)

    val quoteView = pill(text(14f, white).apply { text = "«$quote»" }, glass)
    attemptsView = pill(text(13f, 0xFFFFC9C9.toInt(), true), 0x33D93B3B)

    val button =
      text(17f, 0xFF1B2552.toInt(), true).apply {
        text = "برگشتم سر درسم  ✍️"
        background = rounded(white, 30f)
        val h = dp(16f).toInt()
        setPadding(h, h, h, h)
        isClickable = true
        setOnClickListener { goHome() }
      }

    endLink =
      text(13f, muted).apply {
        text = "پایان زودهنگام جلسه"
        paintFlags = paintFlags or Paint.UNDERLINE_TEXT_FLAG
        val p = dp(14f).toInt()
        setPadding(p, p, p, p)
        isClickable = true
        setOnClickListener { openSession() }
      }

    val wrap = ViewGroup.LayoutParams.WRAP_CONTENT
    val match = ViewGroup.LayoutParams.MATCH_PARENT
    col.addView(tag, LinearLayout.LayoutParams(wrap, wrap))
    col.addView(gap(28f))
    col.addView(lockCircle, LinearLayout.LayoutParams(dp(112f).toInt(), dp(112f).toInt()))
    col.addView(gap(24f))
    col.addView(titleView, LinearLayout.LayoutParams(match, wrap))
    col.addView(gap(6f))
    col.addView(subtitle, LinearLayout.LayoutParams(match, wrap))
    col.addView(gap(24f))
    col.addView(timeCard, LinearLayout.LayoutParams(match, wrap))
    col.addView(gap(16f))
    col.addView(quoteView, LinearLayout.LayoutParams(match, wrap))
    col.addView(gap(12f))
    col.addView(attemptsView, LinearLayout.LayoutParams(wrap, wrap))
    col.addView(gap(24f))
    col.addView(button, LinearLayout.LayoutParams(match, wrap))
    col.addView(endLink, LinearLayout.LayoutParams(wrap, wrap))

    // Scrollable so small screens and large font sizes still reach the button.
    val scroll = ScrollView(ctx).apply { isFillViewport = true }
    val center =
      FrameLayout(ctx).apply { addView(col, FrameLayout.LayoutParams(match, wrap, Gravity.CENTER)) }
    scroll.addView(center, ViewGroup.LayoutParams(match, match))
    frame.addView(scroll, FrameLayout.LayoutParams(match, match))
    return frame
  }
}
