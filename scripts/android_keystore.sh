#!/usr/bin/env bash
# Upload / verify a local keystore for Android release signing.
#
# Usage:
#   scripts/android_keystore.sh gen            # create android/release.keystore
#   scripts/android_keystore.sh base64         # print base64 for ANDROID_KEY_BASE64
#
# The generated keystore is committed-friendly (a stable key avoids the
# "package conflict" error when upgrading an installed APK).
set -euo pipefail

KEYSTORE="${KEYSTORE:-android/release.keystore}"
ALIAS="${ALIAS:-astrbot-plus}"
STOREPASS="${STOREPASS:-android}"

case "${1:-}" in
  gen)
    mkdir -p "$(dirname "$KEYSTORE")"
    keytool -genkeypair -v -keystore "$KEYSTORE" \
      -storepass "$STOREPASS" -keypass "$STOREPASS" \
      -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=AstrBot Plus, OU=Dev, O=AstrBotPlus, L=NA, ST=NA, C=CN"
    echo "Created $KEYSTORE (alias=$ALIAS)"
    ;;
  base64)
    base64 -w0 "$KEYSTORE"
    ;;
  *)
    echo "usage: $0 {gen|base64}" >&2
    exit 1
    ;;
esac
