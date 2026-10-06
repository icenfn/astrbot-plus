#!/usr/bin/env bash
# Collect and rename build outputs into ./release for the GitHub Release.
# Usage: scripts/collect_artifacts.sh <linux|windows|android> <version>
set -euo pipefail

PLATFORM="${1:?platform}"
VERSION="${2:?version}"
mkdir -p release

find_first() { find "$1" -name "$2" 2>/dev/null | head -1; }

case "$PLATFORM" in
  linux)
    DEB=$(find_first "src-tauri/target/release/bundle/deb" "*.deb")
    RPM=$(find_first "src-tauri/target/release/bundle/rpm" "*.rpm")
    [ -n "$DEB" ] && cp "$DEB" "release/astrbot-plus-${VERSION}-linux-arm64.deb"
    [ -n "$RPM" ] && cp "$RPM" "release/astrbot-plus-${VERSION}-linux-aarch64.rpm"
    ;;
  windows)
    EXE=$(find_first "src-tauri/target/release/bundle/nsis" "*.exe")
    [ -n "$EXE" ] && cp "$EXE" "release/astrbot-plus-${VERSION}-windows-x64-setup.exe"
    ;;
  android)
    BASE="src-tauri/gen/android/app/build/outputs/apk"
    # A `--split-per-abi` build names the dir after the ABI (`arm64`); a single
    # `--target aarch64` build emits one universal APK under `universal`. Both
    # contain only arm64-v8a here (the Android ABIs are restricted in
    # android_prepare.py), so prefer the explicit arm64 dir and fall back to any
    # release APK.
    APK=$(find_first "$BASE/arm64" "*-release.apk")
    [ -z "$APK" ] && APK=$(find "$BASE" -name "*-release.apk" 2>/dev/null | head -1)
    [ -n "$APK" ] && cp "$APK" "release/astrbot-plus-${VERSION}-android-arm64.apk"
    ;;
  *)
    echo "unknown platform: $PLATFORM" >&2
    exit 1
    ;;
esac

echo "=== release/ ==="
ls -la release
if [ -z "$(ls -A release)" ]; then
  echo "No artifacts collected for $PLATFORM" >&2
  exit 1
fi
