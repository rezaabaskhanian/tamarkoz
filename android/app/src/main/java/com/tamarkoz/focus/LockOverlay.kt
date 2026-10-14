package com.tamarkoz.focus

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
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
 * Top to bottom: status tag, lock tile, «الان نمی‌توانی X را باز کنی», «الان وقت … است»,
 * a ring timer of the time left, the user's «why» (or a quote), the resist counter,
 * «برگرد سر درس» and — normal mode only — «پایان زودهنگام جلسه».
 * No ads and no purchase buttons. Back and «برگرد سر درس» both go to the home screen.
 */
class LockOverlay(private val ctx: Context) {
  private val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var root: View? = null
  private lateinit var titleView: TextView
  private lateinit var nowView: TextView
  private lateinit var timeView: TextView
  private lateinit var ring: RingView
  private lateinit var attemptsView: TextView
  private lateinit var endLink: TextView
  private var quote = Fa.QUOTES.random()
  private var motivation = ""

  fun show(s: ActiveSession, appLabel: String) {
    if (root == null) {
      quote = Fa.QUOTES.random()
      motivation = FocusStore(ctx).config().motivation.trim()
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
    titleView.text = "الان نمی‌توانی «$appLabel» را باز کنی"
    nowView.text = "الان وقت ${s.label} است"
    timeView.text = Fa.clock(s.remainingMs / 1000)
    ring.progress = if (s.plannedMs > 0) s.remainingMs.toFloat() / s.plannedMs else 0f
    // Every return to the lesson from here is a small win against the urge to scroll.
    if (s.blockedAttempts > 0) {
      attemptsView.visibility = View.VISIBLE
      attemptsView.text = "💪  مقاومت شماره‌ی ${Fa.digits(s.blockedAttempts)}؛ هر بار که برمی‌گردی، اراده‌ات قوی‌تر می‌شود."
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
    val wrap = ViewGroup.LayoutParams.WRAP_CONTENT
    val match = ViewGroup.LayoutParams.MATCH_PARENT

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
        intArrayOf(0xFF26337A.toInt(), 0xFF1E2A5E.toInt(), 0xFF2B2C5E.toInt()),
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

    fun lp(w: Int, h: Int, top: Float = 0f) =
      LinearLayout.LayoutParams(w, h).apply {
        topMargin = dp(top).toInt()
        gravity = Gravity.CENTER_HORIZONTAL
      }

    // Flexible space: pushes the middle block to the center on tall screens.
    fun spacer() = View(ctx).apply { layoutParams = LinearLayout.LayoutParams(match, 0, 1f) }

    val col =
      LinearLayout(ctx).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        val pad = dp(24f).toInt()
        setPadding(pad, dp(48f).toInt(), pad, dp(28f).toInt())
      }

    val tag = pill(text(13f, white).apply { text = "●  قفل تمرکز فعال است" }, glass)

    // Rounded blue tile with the lock, as in the design.
    val lockTile =
      FrameLayout(ctx).apply {
        background =
          GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(0xFF6A86F0.toInt(), 0xFF3E5BDB.toInt())).apply {
            cornerRadius = dp(26f)
          }
        elevation = dp(8f)
        addView(
          ImageView(ctx).apply {
            setImageResource(R.drawable.ic_stat_focus)
            setColorFilter(white)
          },
          FrameLayout.LayoutParams(dp(46f).toInt(), dp(46f).toInt(), Gravity.CENTER),
        )
      }

    titleView = text(22f, white, true)
    nowView = text(15f, muted)

    // Ring timer: the arc shrinks as the session runs out.
    ring = RingView(ctx, dp(10f))
    timeView = text(40f, white, true).apply { textDirection = View.TEXT_DIRECTION_LTR }
    val timeLabel = text(13f, muted).apply { text = "تا پایان جلسه" }
    val ringBox =
      FrameLayout(ctx).apply {
        addView(ring, FrameLayout.LayoutParams(match, match))
        addView(
          LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            addView(timeView, LinearLayout.LayoutParams(wrap, wrap))
            addView(timeLabel, LinearLayout.LayoutParams(wrap, wrap))
          },
          FrameLayout.LayoutParams(wrap, wrap, Gravity.CENTER),
        )
      }

    // The user's own reason beats a generic quote.
    val quoteView =
      pill(
        text(14f, white, motivation.isNotEmpty()).apply {
          text = if (motivation.isNotEmpty()) "🎯  یادت هست چرا؟\n«$motivation»" else "«$quote»"
        },
        glass,
      )
    attemptsView = pill(text(13f, 0xFFC9F2DC.toInt(), true), 0x3322A06B)

    val button =
      text(17f, 0xFF1B2552.toInt(), true).apply {
        text = "برگرد سر درس"
        background = rounded(white, 30f)
        val p = dp(16f).toInt()
        setPadding(p, p, p, p)
        isClickable = true
        setOnClickListener { goHome() }
      }

    endLink =
      text(13f, muted).apply {
        text = "پایان زودهنگام جلسه"
        paintFlags = paintFlags or Paint.UNDERLINE_TEXT_FLAG
        val p = dp(12f).toInt()
        setPadding(p, p, p, p)
        isClickable = true
        setOnClickListener { openSession() }
      }

    val ringSize = dp(212f).toInt()
    col.addView(tag, lp(wrap, wrap))
    col.addView(spacer())
    col.addView(lockTile, lp(dp(92f).toInt(), dp(92f).toInt(), 24f))
    col.addView(titleView, lp(match, wrap, 24f))
    col.addView(nowView, lp(match, wrap, 6f))
    col.addView(ringBox, lp(ringSize, ringSize, 24f))
    col.addView(quoteView, lp(match, wrap, 24f))
    col.addView(attemptsView, lp(match, wrap, 10f))
    col.addView(spacer())
    col.addView(button, lp(match, wrap, 24f))
    col.addView(endLink, lp(wrap, wrap, 4f))

    // Scrollable so small screens and large font sizes still reach the button; on tall
    // screens fillViewport stretches the column and the spacers center the middle block.
    val scroll = ScrollView(ctx).apply { isFillViewport = true }
    scroll.addView(col, FrameLayout.LayoutParams(match, wrap))
    frame.addView(scroll, FrameLayout.LayoutParams(match, match))
    return frame
  }

  /** Circular countdown: a faint full track and a bright arc for the time left. */
  private class RingView(ctx: Context, private val stroke: Float) : View(ctx) {
    var progress = 1f
      set(value) {
        val v = value.coerceIn(0f, 1f)
        if (v != field) {
          field = v
          invalidate()
        }
      }

    private val track =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = stroke
        color = 0x26FFFFFF
      }
    private val arc =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = stroke
        strokeCap = Paint.Cap.ROUND
        color = 0xFF9DB1FF.toInt()
      }
    private val oval = RectF()

    override fun onDraw(canvas: Canvas) {
      val half = stroke / 2
      oval.set(half, half, width - half, height - half)
      canvas.drawOval(oval, track)
      // Clockwise from 12 o'clock.
      if (progress > 0f) canvas.drawArc(oval, -90f, 360f * progress, false, arc)
    }
  }
}
