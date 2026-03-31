#!/bin/sh
set -e

OS=$(uname -s)
ARCH=$(uname -m)
BASE_URL="https://raw.githubusercontent.com/x-saola/litellm-ultis/main/cli-dist"

if [ "$OS" = "Darwin" ]; then
  if [ "$ARCH" = "arm64" ]; then
    BIN_NAME="claude-uninstall-macos-arm64"
  else
    BIN_NAME="claude-uninstall-macos-x64"
  fi
elif [ "$OS" = "Linux" ]; then
  if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    BIN_NAME="claude-uninstall-linux-arm64"
  else
    BIN_NAME="claude-uninstall-linux-x64"
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

# On macOS, remove from launchd environment so all new processes are clean
if [ "$OS" = "Darwin" ]; then
  launchctl unsetenv ANTHROPIC_BASE_URL 2>/dev/null || true
  launchctl unsetenv ANTHROPIC_AUTH_TOKEN 2>/dev/null || true
fi

# On Linux, remove from /etc/environment if present (system-wide)
if [ "$OS" = "Linux" ] && [ -f /etc/environment ]; then
  sed -i '/^ANTHROPIC_BASE_URL=/d' /etc/environment 2>/dev/null || true
  sed -i '/^ANTHROPIC_AUTH_TOKEN=/d' /etc/environment 2>/dev/null || true
fi
