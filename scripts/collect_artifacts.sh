#!/usr/bin/env bash
# Collect and rename build outputs into ./release for the GitHub Release.
# Usage: scripts/collect_artifacts.sh <linux|windows|android> <version>
set -euo pipefail

PLATFORM="${1:?platform}"
VERSION="${2:?version}"
mkdir -p release

# Return the first file matching a glob under a directory.
#
# Tolerates a MISSING directory and `head` closing the pipe early (SIGPIPE).
# Both would otherwise make `find` exit non-zero; combined with `set -o pipefail`
# and `set -e`, that aborts the whole script *silently* via the `VAR=$(...)`
# assignment. This was the actual reason the Android collection failed: the APK
# is emitted under apk/universal/ (single-target build), so the apk/arm64/ probe
# hit a missing directory and killed the script before it could log anything.
find_first() {
  [ -d "$1" ] || return 0
  find "$1" -name "$2" 2>/dev/null | head -1 || true
}

case "$PLATFORM" in
  linux)
    DEB=$(find_first "src-tauri/target/release/bundle/deb" "*.deb")
    RPM=$(find_first "src-tauri/target/release/bundle/rpm" "*.rpm")
    if [ -n "$DEB" ]; then cp "$DEB" "release/astrbot-plus-${VERSION}-linux-arm64.deb"; fi
    if [ -n "$RPM" ]; then cp "$RPM" "release/astrbot-plus-${VERSION}-linux-aarch64.rpm"; fi
    ;;
  windows)
    EXE=$(find_first "src-tauri/target/release/bundle/nsis" "*.exe")
    if [ -n "$EXE" ]; then cp "$EXE" "release/astrbot-plus-${VERSION}-windows-x64-setup.exe"; fi
    ;;
  android)
    BASE="src-tauri/gen/android/app/build/outputs/apk"
    # A `--split-per-abi` build names the dir after the ABI (`arm64`); a single
    # `--target aarch64` build emits one universal APK under `universal`. Both
    # contain only arm64-v8a here (the Android ABIs are restricted in
    # android_prepare.py), so prefer the explicit arm64 dir and fall back to any
    # release APK.
    APK=$(find_first "$BASE/arm64" "*-release.apk")
    if [ -z "$APK" ]; then APK=$(find_first "$BASE" "*-release.apk"); fi
    if [ -n "$APK" ]; then cp "$APK" "release/astrbot-plus-${VERSION}-android-arm64.apk"; fi
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
