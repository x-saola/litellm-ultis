# LiteLLM Access

Claude Code installer with Google OAuth authentication.

## Install

Run this command on your Mac to get started:

```sh
curl -fsSL https://raw.githubusercontent.com/x-saola/litellm-ultis/main/cli-dist/install.sh | sh
```

This will:
1. Download the appropriate binary for your architecture (arm64 or x64)
2. Authenticate you with Google
3. Configure Claude Code to use the LiteLLM gateway

## Architecture

- `cloudrun/` — Python FastAPI gateway (verifies Google ID token, checks domain whitelist, creates LiteLLM key)
- `cli/` — Bun TypeScript CLI (auth via Google OAuth2, sets shell env vars)

## Security notes

- Access is restricted to approved Google Workspace domains
- LiteLLM master key is never exposed to end users
- Keys are scoped and can be rotated server-side
