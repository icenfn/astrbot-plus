#!/usr/bin/env python3
"""Prepare the generated Tauri Android project for a release build.

Tauri's `tauri android init` emits a template project. This script applies the
small, deterministic patches we need so the resulting APK:
  * allows cleartext HTTP (so a self-hosted AstrBot over http:// is reachable),
  * uses our custom launcher icons (Tauri ships template defaults),
  * pads for system bars and forwards the hardware back button to the WebView,
  * carries the correct versionCode / versionName,
  * is signed (release signingConfig wired from keystore.properties).

Usage:
  python3 scripts/android_prepare.py --project src-tauri/gen/android \
      --version v0.1.0 --icons src-tauri/icons/android
"""
from __future__ import annotations

import argparse
import glob
import os
import re
import shutil
import subprocess
import sys


def log(msg: str) -> None:
    print(f"[android_prepare] {msg}")


def patch_manifest_cleartext(project: str) -> None:
    """Allow cleartext HTTP so a self-hosted AstrBot over http:// is reachable.

    The earlier implementation patched the manifest with a naive
    ``content.replace("<application ", ...)`` — which silently does nothing when
    the generated template writes ``<application`` followed by a newline instead
    of a space. The script then still logged "cleartext HTTP enabled", so the
    broken APK shipped and the Android WebView kept blocking cleartext http/ws
    requests (the client's opaque "xhr poll error"). This version:

      * inserts the attribute *positionally* (right after the ``<application``
        tag name), independent of surrounding whitespace/newlines,
      * also installs an explicit ``network_security_config.xml`` allowing
        cleartext (belt and braces),
      * hard-fails the build when the patch cannot be verified, so a broken
        APK can never be published silently again.
    """
    app_dir = os.path.join(project, "app", "src", "main")
    manifest = os.path.join(app_dir, "AndroidManifest.xml")
    with open(manifest, encoding="utf-8") as f:
        content = f.read()

    # 1) Manifest: usesCleartextTraffic + networkSecurityConfig reference.
    idx = content.find("<application")
    if idx == -1:
        raise SystemExit("[android_prepare] ERROR: <application> tag not found in manifest")
    insert_at = idx + len("<application")
    if "usesCleartextTraffic" not in content:
        content = (
            content[:insert_at]
            + '\n        android:usesCleartextTraffic="true"'
            + content[insert_at:]
        )
    if "networkSecurityConfig" not in content:
        content = (
            content[:insert_at]
            + '\n        android:networkSecurityConfig="@xml/network_security_config"'
            + content[insert_at:]
        )
    with open(manifest, "w", encoding="utf-8") as f:
        f.write(content)

    # 2) network_security_config.xml: explicitly allow cleartext.
    xml_dir = os.path.join(app_dir, "res", "xml")
    os.makedirs(xml_dir, exist_ok=True)
    with open(os.path.join(xml_dir, "network_security_config.xml"), "w", encoding="utf-8") as f:
        f.write(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            "<network-security-config>\n"
            '    <base-config cleartextTrafficPermitted="true" />\n'
            "</network-security-config>\n"
        )

    # 3) Hard verification: fail loudly if the patch did not take.
    with open(manifest, encoding="utf-8") as f:
        final = f.read()
    if 'usesCleartextTraffic="true"' not in final:
        raise SystemExit(
            "[android_prepare] ERROR: failed to enable cleartext traffic in manifest"
        )
    log("AndroidManifest: cleartext HTTP enabled (manifest + network_security_config)")


def patch_manifest_softinput(project: str) -> None:
    """Resize the WebView when the soft keyboard opens.

    Without this the on-screen keyboard overlays the message composer on
    Android. `adjustResize` lets the system shrink the WebView so the composer
    stays visible above the keyboard.
    """
    path = os.path.join(project, "app", "src", "main", "AndroidManifest.xml")
    with open(path, encoding="utf-8") as f:
        content = f.read()
    if "windowSoftInputMode" in content:
        log("AndroidManifest: windowSoftInputMode already set")
        return
    for marker in (
        'android:name=".MainActivity"',
        'android:name="app.astrbot.plus.MainActivity"',
    ):
        if marker in content:
            content = content.replace(
                marker, marker + ' android:windowSoftInputMode="adjustResize"', 1
            )
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            log("AndroidManifest: windowSoftInputMode=adjustResize")
            return
    log("AndroidManifest: MainActivity activity tag not found, skip softinput")


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
  }}

  // Hardware back button: dispatch an `android:back` event to the frontend so it
  // can close a conversation / go back / exit, instead of killing the Activity.
  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {{
    notifyWebviewBack()
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


def patch_main_activity(project: str) -> None:
    matches = glob.glob(
        os.path.join(project, "app", "src", "main", "java", "**", "MainActivity.kt"),
        recursive=True,
    )
    if not matches:
        log("MainActivity.kt not found, skip")
        return
    path = matches[0]
    with open(path, encoding="utf-8") as f:
        src = f.read()
    pkg_line = next(
        (ln for ln in src.splitlines() if ln.startswith("package ")), "package app.astrbot.plus"
    )
    pkg = pkg_line.replace("package ", "").replace(";", "").strip()
    with open(path, "w", encoding="utf-8") as f:
        f.write(MAIN_ACTIVITY_TEMPLATE.format(pkg=pkg))
    log(f"MainActivity patched (package {pkg}): insets + android:back")


def set_version(project: str, version: str) -> None:
    clean = version.lstrip("v")
    parts = (clean.split(".") + ["0", "0", "0"])[:3]
    try:
        major, minor, patch = (int(x) for x in parts)
    except ValueError:
        major, minor, patch = 0, 1, 0
    code = major * 10000 + minor * 100 + patch
    prop = os.path.join(project, "app", "tauri.properties")
    with open(prop, "w", encoding="utf-8") as f:
        f.write(f"tauri.android.versionCode={code}\n")
        f.write(f"tauri.android.versionName={clean}\n")
    log(f"version set: versionCode={code} versionName={clean}")


def restrict_abis(project: str) -> None:
    """Only build arm64-v8a (skip 32-bit armv7 and x86 emulator ABIs)."""
    for rel in ("gradle.properties", os.path.join("app", "gradle.properties")):
        path = os.path.join(project, rel)
        with open(path, "a", encoding="utf-8") as f:
            f.write("abiList=arm64-v8a\n")
            f.write("archList=arm64\n")
            f.write("targetList=aarch64\n")
    log("ABIs restricted to arm64-v8a")


def wire_signing(project: str) -> None:
    path = os.path.join(project, "app", "build.gradle.kts")
    with open(path, encoding="utf-8") as f:
        s = f.read()
    if "import java.util.Properties" not in s:
        s = "import java.util.Properties\n" + s
    if "signingConfigs" not in s:
        block = (
            "    signingConfigs {\n"
            '        if (rootProject.file("keystore.properties").exists()) {\n'
            "            val keystoreProperties = Properties().apply {\n"
            '                load(rootProject.file("keystore.properties").inputStream())\n'
            "            }\n"
            '            create("release") {\n'
            '                storeFile = file(keystoreProperties.getProperty("storeFile"))\n'
            '                storePassword = keystoreProperties.getProperty("storePassword")\n'
            '                keyAlias = keystoreProperties.getProperty("keyAlias")\n'
            '                keyPassword = keystoreProperties.getProperty("keyPassword")\n'
            "            }\n"
            "        }\n"
            "    }\n"
        )
        marker = "    buildTypes {"
        if marker not in s:
            sys.exit("build.gradle.kts: `buildTypes {` marker not found")
        s = s.replace(marker, block + marker, 1)
    rel = 'getByName("release") {'
    if rel in s and 'signingConfig = signingConfigs.findByName("release")' not in s:
        s = s.replace(
            rel, rel + '\n            signingConfig = signingConfigs.findByName("release")', 1
        )
    with open(path, "w", encoding="utf-8") as f:
        f.write(s)
    log("Gradle: release signingConfig wired")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--version", default="v0.1.3")
    ap.add_argument("--icons", default="src-tauri/icons/android")
    ap.add_argument("--keystore", help="path to keystore file (written to keystore.properties)")
    ap.add_argument("--alias", default="astrbotplus")
    ap.add_argument("--password", default="android")
    args = ap.parse_args()

    patch_manifest_cleartext(args.project)
    patch_manifest_softinput(args.project)
    override_icons(args.project, args.icons)
    patch_main_activity(args.project)
    set_version(args.project, args.version)
    restrict_abis(args.project)

    if args.keystore:
        props = os.path.join(args.project, "keystore.properties")
        with open(props, "w", encoding="utf-8") as f:
            f.write(f"keyAlias={args.alias}\n")
            f.write(f"keyPassword={args.password}\n")
            f.write(f"storeFile={os.path.abspath(args.keystore)}\n")
            f.write(f"storePassword={args.password}\n")
        log(f"keystore.properties written (storeFile={args.keystore})")
    wire_signing(args.project)
    log("done")


if __name__ == "__main__":
    main()
