package app.astrbot.plus

import android.os.Bundle

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // 为状态栏/刘海/导航栏留出内边距，避免内容被系统栏遮挡
    window.decorView.setOnApplyWindowInsetsListener { v: android.view.View, insets: android.view.WindowInsets ->
      if (android.os.Build.VERSION.SDK_INT >= 30) {
        val bars = insets.getInsets(
          android.view.WindowInsets.Type.systemBars() or
          android.view.WindowInsets.Type.displayCutout()
        )
        v.setPadding(0, bars.top, 0, bars.bottom)
      } else {
        v.setPadding(0, insets.systemWindowInsetTop, 0, insets.systemWindowInsetBottom)
      }
      insets
    }
    window.decorView.requestApplyInsets()
    requestBackgroundPermissions()
  }

  // 硬件返回键：向 WebView 派发 `android:back` 事件，让前端决定关闭会话 / 返回 / 退出，
  // 而不是直接结束 Activity。
  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    notifyWebviewBack()
  }

  private fun requestBackgroundPermissions() {
    try {
      if (android.os.Build.VERSION.SDK_INT >= 33) {
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
      var web: android.webkit.WebView? = null
      fun scan(v: android.view.View) {
        if (web != null) return
        if (v is android.webkit.WebView) { web = v; return }
        if (v is android.view.ViewGroup) {
          for (i in 0 until v.childCount) scan(v.getChildAt(i))
        }
      }
      scan(window.decorView)
      web?.post {
        web!!.evaluateJavascript(
          "window.dispatchEvent(new CustomEvent('android:back'))", null)
      }
    } catch (_: Exception) {
      finish()
    }
  }
}
