#!/bin/sh
set -e

cd "$(dirname "$0")/cli"

echo "Building setup binaries..."
bun build src/index.ts --compile --target=bun-darwin-arm64  --outfile ../cli-dist/claude-setup-macos-arm64 &
bun build src/index.ts --compile --target=bun-darwin-x64    --outfile ../cli-dist/claude-setup-macos-x64 &
bun build src/index.ts --compile --target=bun-linux-x64     --outfile ../cli-dist/claude-setup-linux-x64 &
bun build src/index.ts --compile --target=bun-linux-arm64   --outfile ../cli-dist/claude-setup-linux-arm64 &
wait

echo "Building uninstall binaries..."
bun build src/uninstall.ts --compile --target=bun-darwin-arm64  --outfile ../cli-dist/claude-uninstall-macos-arm64 &
bun build src/uninstall.ts --compile --target=bun-darwin-x64    --outfile ../cli-dist/claude-uninstall-macos-x64 &
bun build src/uninstall.ts --compile --target=bun-linux-x64     --outfile ../cli-dist/claude-uninstall-linux-x64 &
bun build src/uninstall.ts --compile --target=bun-linux-arm64   --outfile ../cli-dist/claude-uninstall-linux-arm64 &
wait

echo "Done. Binaries written to cli-dist/"
