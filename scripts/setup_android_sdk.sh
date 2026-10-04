#!/usr/bin/env bash
# Configure the Android SDK that is preinstalled on GitHub's ubuntu runners.
# Avoids android-actions/setup-android@v3, which fails trying to install the
# now-removed `tools` package ("Failed to find package 'tools'").
set -euo pipefail

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
echo "ANDROID_HOME=$SDK" >> "$GITHUB_ENV"
echo "ANDROID_SDK_ROOT=$SDK" >> "$GITHUB_ENV"
echo "$SDK/cmdline-tools/latest/bin" >> "$GITHUB_PATH"
echo "$SDK/platform-tools" >> "$GITHUB_PATH"

SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"
if [ ! -x "$SDKMANAGER" ]; then
  SDKMANAGER="$(find "$SDK/cmdline-tools" -name sdkmanager -type f 2>/dev/null | head -1)"
fi
echo "Using sdkmanager: $SDKMANAGER"

yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true
"$SDKMANAGER" "platform-tools" "platforms;android-34" "build-tools;34.0.0" >/dev/null 2>&1 || true
ls "$SDK/platforms" 2>/dev/null || true
