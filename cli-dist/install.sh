#!/bin/sh
set -e

OS=$(uname -s)
ARCH=$(uname -m)
BASE_URL="https://github.com/x-saola/litellm-ultis/releases/download/0.1.0"

if [ "$OS" = "Darwin" ]; then
  if [ "$ARCH" = "arm64" ]; then
    BIN_NAME="claude-setup-macos-arm64"
  else
    BIN_NAME="claude-setup-macos-x64"
  fi
elif [ "$OS" = "Linux" ]; then
  if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    BIN_NAME="claude-setup-linux-arm64"
  else
    BIN_NAME="claude-setup-linux-x64"
  fi
else
  echo "Unsupported OS: $OS"
  exit 1
fi

TMP_BIN=$(mktemp)
echo "Downloading $BIN_NAME..."
curl -f --retry 3 --retry-delay 2 --progress-bar "$BASE_URL/$BIN_NAME" -o "$TMP_BIN" 2>/dev/tty

if [ "$OS" = "Darwin" ]; then
  xattr -cr "$TMP_BIN" 2>/dev/null || xattr -c "$TMP_BIN" 2>/dev/null || true
fi
chmod +x "$TMP_BIN"
"$TMP_BIN"
rm -f "$TMP_BIN"

# Apply env vars to the current shell session instantly
if [ -f /tmp/claude-code-exports ]; then
  . /tmp/claude-code-exports
  rm -f /tmp/claude-code-exports
fi
