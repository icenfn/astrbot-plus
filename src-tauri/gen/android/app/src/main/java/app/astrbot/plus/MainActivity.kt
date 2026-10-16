package app.astrbot.plus

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import android.content.res.Configuration

class MainActivity : TauriActivity() {
  // Last system-bar / cutout insets seen, kept so we can re-deliver them to the
  // WebView when it (re)appears or regains focus.
  private var insetTop = 0
  private var insetBottom = 0
  private var insetLeft = 0
  private var insetRight = 0
  // Height of the on-screen keyboard (IME), in CSS px. 0 when it is hidden.
  private var keyboardHeight = 0
  // Whether the JS↔native bridge has been attached to the WebView.
  private var bridgeAdded = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // --- Edge-to-edge, single source of insets ------------------------------
    // The decorView is intentionally NOT padded here: doing so on top of a window
    // that already insets itself (cutouts / gesture navigation) applied the safe
    // area twice and produced the oversized top/bottom black bars.
    //
    // We draw edge-to-edge and forward the system-bar / cutout insets to the
    // WebView exactly ONCE, as `--safe-area-inset-*` CSS variables, plus the IME
    // (keyboard) height as `--keyboard-height`. The web layer reads those
    // variables (falling back to env() elsewhere), so insets are applied a single
    // time and the dark window background no longer shows through behind the bars.
    WindowCompat.setDecorFitsSystemWindows(window, false)
    makeSystemBarsTransparent()

    val decor = window.decorView
    ViewCompat.setOnApplyWindowInsetsListener(decor) { _, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      // The soft keyboard arrives as its own inset. Because the app is
      // edge-to-edge (and targetSdk 35+ forces it), the WebView is NOT resized
      // for the keyboard, so the web layer relies on this value to lift the
      // message composer above the keyboard instead of hiding it.
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      applyInsets(bars.top, bars.bottom, bars.left, bars.right, ime)
      insets
    }
    ViewCompat.requestApplyInsets(decor)

    // The WebView may not exist yet when the first insets arrive; retry briefly.
    for (delay in longArrayOf(300L, 900L, 1800L)) {
      decor.postDelayed({ deliverInsets() }, delay)
    }

    // NOTE: notification / battery-optimisation permissions are deliberately NOT
    // requested here. Asking on launch is intrusive; the web layer calls the
    // `requestBackgroundPermissions` / `requestNotificationPermission` bridge
    // methods only after the user opts in (设置 or 向导 → 后台运行 / 通知).
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      // Focus changes (e.g. returning from the IME) can change the insets.
      ViewCompat.requestApplyInsets(window.decorView)
      deliverInsets()
    }
  }

  private fun makeSystemBarsTransparent() {
    // Let the (already theme-coloured) web app paint under the bars.
    window.statusBarColor = Color.TRANSPARENT
    window.navigationBarColor = Color.TRANSPARENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isStatusBarContrastEnforced = false
      window.isNavigationBarContrastEnforced = false
    }
    // Seed the bar-icon colour from the current system setting; the web layer
    // refines it through the bridge as soon as it knows the user's chosen theme.
    val nightMask = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
    applyBarAppearance(nightMask != Configuration.UI_MODE_NIGHT_YES)
  }

  /**
   * Toggle the status/navigation bar icon colour.
   *
   * `light = true` paints DARK icons (for a light background) and `false` paints
   * LIGHT icons (for a dark background). Because the app draws edge-to-edge with
   * transparent bars, the platform default (light icons) becomes invisible on the
   * light Telegram surface — the reported「状态栏不显示」symptom. Keeping the icons
   * in sync with the theme makes them legible in both palettes.
   */
  private fun applyBarAppearance(light: Boolean) {
    runOnUiThread {
      val controller = WindowInsetsControllerCompat(window, window.decorView)
      controller.isAppearanceLightStatusBars = light
      controller.isAppearanceLightNavigationBars = light
    }
  }

  /** Bridge exposed to the WebView as `window.AstrbotNative`. */
  private inner class NativeBridge {
    @android.webkit.JavascriptInterface
    fun setStatusBarAppearance(light: Boolean) {
      applyBarAppearance(light)
    }

    /**
     * Send the task to the background (the launcher) WITHOUT finishing it, so the
     * app keeps running. Used by the web layer when the Android back button is
     * pressed on the 首页 frame —「从 app 回到桌面，app 不退出不关闭」.
     */
    @android.webkit.JavascriptInterface
    fun moveToBackground() {
      runOnUiThread { moveTaskToBack(true) }
    }

    /**
     * Request background-running permissions (POST_NOTIFICATIONS + exemption from
     * battery optimisation). Invoked by the web layer only after the user opts in
     * to 后台运行, so nothing is prompted on a cold start.
     */
    @android.webkit.JavascriptInterface
    fun requestBackgroundPermissions() {
      runOnUiThread {
        promptNotificationPermission()
        promptIgnoreBatteryOptimizations()
      }
    }

    /** Request only the POST_NOTIFICATIONS permission (when notifications are on). */
    @android.webkit.JavascriptInterface
    fun requestNotificationPermission() {
      runOnUiThread { promptNotificationPermission() }
    }
  }

  /** Store insets (converted from physical px to CSS px) and push them to the WebView. */
  private fun applyInsets(topPx: Int, bottomPx: Int, leftPx: Int, rightPx: Int, imePx: Int) {
    val density = resources.displayMetrics.density.takeIf { it > 0f } ?: 1f
    insetTop = (topPx / density).toInt()
    insetLeft = (leftPx / density).toInt()
    insetRight = (rightPx / density).toInt()

    val barsBottomCss = (bottomPx / density).toInt()
    val imeCss = (imePx / density).toInt()
    // The on-screen keyboard overlays the navigation bar, so the two must never
    // both be consumed: expose only the part of the bar the keyboard does not
    // already cover. When the keyboard is open this is 0 (no extra gap); when it
    // is closed it is the full gesture-bar height.
    insetBottom = (barsBottomCss - imeCss).coerceAtLeast(0)
    keyboardHeight = imeCss

    deliverInsets()
  }

  private fun deliverInsets() {
    val web = findWebView() ?: return
    if (!bridgeAdded) {
      web.addJavascriptInterface(NativeBridge(), "AstrbotNative")
      bridgeAdded = true
    }
    val js = "window.__astrbotApplyInsets&&window.__astrbotApplyInsets($insetTop,$insetBottom,$insetLeft,$insetRight,$keyboardHeight);"
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

  /** Ask for the POST_NOTIFICATIONS runtime permission (Android 13+). */
  private fun promptNotificationPermission() {
    try {
      if (Build.VERSION.SDK_INT >= 33) {
        requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
      }
    } catch (_: Exception) {}
  }

  /**
   * Ask the user to exempt the app from battery optimisation, so Doze does not
   * suspend the Socket.io connection while the app is backgrounded.
   */
  private fun promptIgnoreBatteryOptimizations() {
    try {
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
