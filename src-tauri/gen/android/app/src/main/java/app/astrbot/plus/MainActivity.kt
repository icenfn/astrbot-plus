package app.astrbot.plus

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  // Last system-bar / cutout insets seen, kept so we can re-deliver them to the
  // WebView when it (re)appears or regains focus.
  private var insetTop = 0
  private var insetBottom = 0
  private var insetLeft = 0
  private var insetRight = 0

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // --- Edge-to-edge, single source of insets ------------------------------
    // Previously the decorView was padded by the raw system-bar insets *and* the
    // web CSS padded app chrome with env(safe-area-inset-*). On devices that
    // already report non-zero safe-area values (cutouts / gesture navigation)
    // those two layers stacked up, producing the oversized top/bottom black
    // bars. (targetSdk 35+ additionally forces edge-to-edge, so the old
    // decoration-fitting padding was applied on top of a window that no longer
    // inset itself — i.e. twice.)
    //
    // Now we draw edge-to-edge and forward the system-bar / cutout insets to the
    // WebView exactly ONCE, as `--safe-area-inset-*` CSS variables. The web layer
    // reads those variables (falling back to env() elsewhere), so insets are
    // applied a single time and the dark window background no longer shows
    // through behind the bars.
    WindowCompat.setDecorFitsSystemWindows(window, false)
    makeSystemBarsTransparent()

    val decor = window.decorView
    ViewCompat.setOnApplyWindowInsetsListener(decor) { _, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      applyInsets(bars.top, bars.bottom, bars.left, bars.right)
      insets
    }
    ViewCompat.requestApplyInsets(decor)

    // The WebView may not exist yet when the first insets arrive; retry briefly.
    for (delay in longArrayOf(300L, 900L, 1800L)) {
      decor.postDelayed({ deliverInsets() }, delay)
    }

    requestBackgroundPermissions()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) deliverInsets()
  }

  private fun makeSystemBarsTransparent() {
    // Let the (already theme-coloured) web app paint under the bars.
    window.statusBarColor = Color.TRANSPARENT
    window.navigationBarColor = Color.TRANSPARENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isStatusBarContrastEnforced = false
      window.isNavigationBarContrastEnforced = false
    }
  }

  /** Store insets (converted from physical px to CSS px) and push them to the WebView. */
  private fun applyInsets(topPx: Int, bottomPx: Int, leftPx: Int, rightPx: Int) {
    val density = resources.displayMetrics.density.takeIf { it > 0f } ?: 1f
    insetTop = (topPx / density).toInt()
    insetBottom = (bottomPx / density).toInt()
    insetLeft = (leftPx / density).toInt()
    insetRight = (rightPx / density).toInt()
    deliverInsets()
  }

  private fun deliverInsets() {
    val web = findWebView() ?: return
    val js = "window.__astrbotApplyInsets&&window.__astrbotApplyInsets($insetTop,$insetBottom,$insetLeft,$insetRight);"
    web.post { web.evaluateJavascript(js, null) }
  }

  private fun findWebView(): android.webkit.WebView? {
    var web: android.webkit.WebView? = null
    fun scan(v: View) {
      if (web != null) return
      if (v is android.webkit.WebView) { web = v; return }
      if (v is android.view.ViewGroup) {
        for (i in 0 until v.childCount) scan(v.getChildAt(i))
      }
    }
    scan(window.decorView)
    return web
  }

  // 硬件返回键：向 WebView 派发 `android:back` 事件，让前端决定关闭会话 / 返回 / 退出，
  // 而不是直接结束 Activity。
  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    notifyWebviewBack()
  }

  private fun requestBackgroundPermissions() {
    try {
      if (Build.VERSION.SDK_INT >= 33) {
        requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
      }
      val pm = getSystemService(POWER_SERVICE) as android.os.PowerManager
      if (!pm.isIgnoringBatteryOptimizations(packageName)) {
        val intent = android.content.Intent(
          android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
        )
        intent.data = android.net.Uri.parse("package:$packageName")
        startActivity(intent)
      }
    } catch (_: Exception) {}
  }

  private fun notifyWebviewBack() {
    try {
      val web = findWebView() ?: return finish()
      web.post {
        web.evaluateJavascript(
          "window.dispatchEvent(new CustomEvent('android:back'))", null
        )
      }
    } catch (_: Exception) {
      finish()
    }
  }
}
