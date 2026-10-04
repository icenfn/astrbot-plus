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
    [ -n "$DEB" ] && cp "$DEB" "release/astrbot-plus-${VERSION}-linux-amd64.deb"
    [ -n "$RPM" ] && cp "$RPM" "release/astrbot-plus-${VERSION}-linux-x86_64.rpm"
    ;;
  windows)
    EXE=$(find_first "src-tauri/target/release/bundle/nsis" "*.exe")
    [ -n "$EXE" ] && cp "$EXE" "release/astrbot-plus-${VERSION}-windows-x64-setup.exe"
    ;;
  android)
    BASE="src-tauri/gen/android/app/build/outputs/apk"
    A64=$(find_first "$BASE/arm64" "*-release.apk")
    A32=$(find_first "$BASE/arm" "*-release.apk")
    [ -n "$A64" ] && cp "$A64" "release/astrbot-plus-${VERSION}-android-arm64.apk"
    [ -n "$A32" ] && cp "$A32" "release/astrbot-plus-${VERSION}-android-arm.apk"
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
