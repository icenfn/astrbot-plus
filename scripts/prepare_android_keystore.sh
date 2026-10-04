#!/usr/bin/env bash
# Produce a keystore at $RUNNER_TEMP/release.keystore for Android signing.
# Priority: repository secret (base64) > committed stable debug keystore.
# The committed keystore guarantees the same signing key across builds so
# upgrading an installed APK does not fail with a "package conflict".
set -euo pipefail

DEST="${RUNNER_TEMP:-/tmp}/release.keystore"

if [ -n "${ANDROID_KEY_BASE64:-}" ]; then
  base64 -d <<< "$ANDROID_KEY_BASE64" > "$DEST"
  echo "Signing: using secret ANDROID_KEY_BASE64"
else
  cp android/debug.keystore "$DEST"
  echo "Signing: using committed android/debug.keystore"
fi

ls -la "$DEST"
