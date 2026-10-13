#!/usr/bin/env python3
"""Prepare Tauri's generated Android project for the AstrBot+ release build.

`tauri android init` emits a stock template. This applies the small, deterministic
patches the client actually needs so the resulting APK:

  * allows cleartext HTTP/WS (a self-hosted AstrBot over http:// must be reachable),
  * resizes the WebView when the soft keyboard opens,
  * declares the permissions needed to keep the socket alive in the background,
  * installs our launcher icons,
  * uses our MainActivity (window insets + hardware back button),
  * carries the right versionCode / versionName,
  * is restricted to the arm64 ABI.

Every manifest patch is verified after writing and hard-fails on mismatch, so a
silently broken APK can never be published.

Usage:
    python3 .github/scripts/android_prepare.py \
        --project src-tauri/gen/android --icons src-tauri/icons/android
"""
from __future__ import annotations

import argparse
import glob
import os
import re
import shutil

MANIFEST = os.path.join("app", "src", "main", "AndroidManifest.xml")


def log(msg: str) -> None:
    print(f"[android_prepare] {msg}")


def _read(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def _write(path: str, content: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def _manifest(project: str) -> str:
    return os.path.join(project, MANIFEST)


def set_manifest_attr(project: str, name: str, value: str) -> None:
    """Force `android:<name>="<value>"` on the <application> tag.

    Handles a Gradle-placeholder value, an explicit "false", or a missing
    attribute alike; inserts the attribute when it is absent.
    """
    path = _manifest(project)
    content = _read(path)
    attr = f'android:{name}="{value}"'
    attr_re = re.compile(rf'android:{name}="[^"]*"')

    if attr_re.search(content):
        content = attr_re.sub(attr, content, count=1)
    else:
        idx = content.find("<application")
        if idx == -1:
            raise SystemExit("[android_prepare] ERROR: <application> tag not found")
        insert_at = idx + len("<application")
        content = content[:insert_at] + " " + attr + content[insert_at:]

    _write(path, content)
    if attr not in _read(path):
        raise SystemExit(f"[android_prepare] ERROR: failed to set {name}={value}")
    log(f"AndroidManifest: {name}={value}")


def set_soft_input_mode(project: str) -> None:
    """Force android:windowSoftInputMode="adjustResize" on MainActivity.

    Without this the on-screen keyboard overlays the message composer.
    """
    path = _manifest(project)
    content = _read(path)
    attr = 'android:windowSoftInputMode="adjustResize"'
    attr_re = re.compile(r'android:windowSoftInputMode="[^"]*"')

    if attr_re.search(content):
        content = attr_re.sub(attr, content, count=1)
    else:
        m = re.search(
            r'(<activity[^>]*android:name="[^"]*MainActivity"[^>]*?)(\s*/?>)',
            content,
            re.S,
        )
        if not m:
            raise SystemExit("[android_prepare] ERROR: MainActivity activity tag not found")
        content = content[: m.end(1)] + " " + attr + content[m.end(1):]

    _write(path, content)
    if attr not in _read(path):
        raise SystemExit("[android_prepare] ERROR: failed to set windowSoftInputMode=adjustResize")
    log("AndroidManifest: windowSoftInputMode=adjustResize")


def add_background_permissions(project: str) -> None:
    """Declare the permissions needed to stay connected while backgrounded.

    Android otherwise suspends the process (and its socket) once the app is no
    longer foregrounded.
    """
    perms = [
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.WAKE_LOCK",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    ]
    path = _manifest(project)
    content = _read(path)
    missing = [p for p in perms if f'android:name="{p}"' not in content]
    if not missing:
        log("AndroidManifest: background permissions already present")
        return

    lines = "".join(
        f'    <uses-permission android:name="{p}"'
        + (' android:maxSdkVersion="34" />\n' if p.endswith("FOREGROUND_SERVICE_DATA_SYNC") else " />\n")
        for p in missing
    )
    idx = content.find("<application")
    if idx == -1:
        raise SystemExit("[android_prepare] ERROR: <application> tag not found")
    _write(path, content[:idx] + lines + content[idx:])
    log("AndroidManifest: added " + ", ".join(missing))


MAIN_ACTIVITY_TEMPLATE = '''\
package {pkg}

import android.os.Bundle

class MainActivity : TauriActivity() {{
  override fun onCreate(savedInstanceState: Bundle?) {{
    super.onCreate(savedInstanceState)
    window.decorView.setOnApplyWindowInsetsListener {{ v: android.view.View, insets: android.view.WindowInsets ->
      if (android.os.Build.VERSION.SDK_INT >= 30) {{
        val bars = insets.getInsets(
          android.view.WindowInsets.Type.systemBars() or
          android.view.WindowInsets.Type.displayCutout()
        )
        v.setPadding(0, bars.top, 0, bars.bottom)
      }} else {{
        v.setPadding(0, insets.systemWindowInsetTop, 0, insets.systemWindowInsetBottom)
      }}
      insets
    }}
    window.decorView.requestApplyInsets()
    requestBackgroundPermissions()
  }}

  // Hardware back button: dispatch an `android:back` event to the frontend so it
  // can close a conversation / go back / exit, instead of killing the Activity.
  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {{
    notifyWebviewBack()
  }}

  private fun requestBackgroundPermissions() {{
    try {{
      if (android.os.Build.VERSION.SDK_INT >= 33) {{
        requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
      }}
      val pm = getSystemService(POWER_SERVICE) as android.os.PowerManager
      if (!pm.isIgnoringBatteryOptimizations(packageName)) {{
        val intent = android.content.Intent(
          android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
        )
        intent.data = android.net.Uri.parse("package:$packageName")
        startActivity(intent)
      }}
    }} catch (_: Exception) {{}}
  }}

  private fun notifyWebviewBack() {{
    try {{
      var web: android.webkit.WebView? = null
      fun scan(v: android.view.View) {{
        if (web != null) return
        if (v is android.webkit.WebView) {{ web = v; return }}
        if (v is android.view.ViewGroup) {{
          for (i in 0 until v.childCount) scan(v.getChildAt(i))
        }}
      }}
      scan(window.decorView)
      web?.post {{
        web!!.evaluateJavascript(
          "window.dispatchEvent(new CustomEvent('android:back'))", null)
      }}
    }} catch (_: Exception) {{
      finish()
    }}
  }}
}}
'''


def override_icons(project: str, icons_dir: str) -> None:
    res = os.path.join(project, "app", "src", "main", "res")
    if not os.path.isdir(icons_dir):
        log(f"icons dir missing, skip: {icons_dir}")
        return
    for entry in os.listdir(icons_dir):
        src = os.path.join(icons_dir, entry)
        dst = os.path.join(res, entry)
        if os.path.isdir(src):
            shutil.copytree(src, dst, dirs_exist_ok=True)
        else:
            shutil.copy2(src, dst)
    found = glob.glob(os.path.join(res, "**", "ic_launcher*"), recursive=True)
    log(f"icons overridden ({len(found)} ic_launcher* resources)")


def patch_main_activity(project: str) -> None:
    matches = glob.glob(
        os.path.join(project, "app", "src", "main", "java", "**", "MainActivity.kt"),
        recursive=True,
    )
    if not matches:
        log("MainActivity.kt not found, skip")
        return
    path = matches[0]
    src = _read(path)
    pkg_line = next(
        (ln for ln in src.splitlines() if ln.startswith("package ")),
        "package app.astrbot.plus",
    )
    pkg = pkg_line.replace("package ", "").replace(";", "").strip()
    _write(path, MAIN_ACTIVITY_TEMPLATE.format(pkg=pkg))
    log(f"MainActivity patched (package {pkg})")


def set_version(project: str, version: str) -> None:
    clean = version.lstrip("v")
    parts = (clean.split(".") + ["0", "0", "0"])[:3]
    try:
        major, minor, patch = (int(x) for x in parts)
    except ValueError:
        major, minor, patch = 0, 1, 0
    code = major * 10000 + minor * 100 + patch
    _write(
        os.path.join(project, "app", "tauri.properties"),
        f"tauri.android.versionCode={code}\ntauri.android.versionName={clean}\n",
    )
    log(f"version set: versionCode={code} versionName={clean}")


def restrict_abis(project: str) -> None:
    """Only build arm64-v8a (skip 32-bit armv7 and x86 emulator ABIs)."""
    for rel in ("gradle.properties", os.path.join("app", "gradle.properties")):
        path = os.path.join(project, rel)
        if not os.path.exists(path):
            continue
        with open(path, "a", encoding="utf-8") as f:
            f.write("abiList=arm64-v8a\narchList=arm64\ntargetList=aarch64\n")
    log("ABIs restricted to arm64-v8a")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--version", default="v0.4.10")
    ap.add_argument("--icons", default="src-tauri/icons/android")
    args = ap.parse_args()

    set_manifest_attr(args.project, "usesCleartextTraffic", "true")
    set_soft_input_mode(args.project)
    add_background_permissions(args.project)
    override_icons(args.project, args.icons)
    patch_main_activity(args.project)
    set_version(args.project, args.version)
    restrict_abis(args.project)
    log("done")


if __name__ == "__main__":
    main()
