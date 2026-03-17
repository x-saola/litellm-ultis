#!/bin/sh
set -e

ARCH=$(uname -m)
DIR=$(cd "$(dirname "$0")" && pwd)

if [ "$ARCH" = "arm64" ]; then
  BIN="$DIR/setup-claude-macos-arm64"
else
  BIN="$DIR/setup-claude-macos-x64"
fi

if [ ! -f "$BIN" ]; then
  echo "Binary not found: $BIN"
  exit 1
fi

xattr -cr "$BIN" 2>/dev/null || xattr -c "$BIN" 2>/dev/null || true
chmod +x "$BIN"
"$BIN"
