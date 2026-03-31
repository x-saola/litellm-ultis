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

## Enable Telemetry

To enable Claude Code telemetry (OpenTelemetry metrics and logs), run:

```sh
curl -fsSL https://raw.githubusercontent.com/x-saola/litellm-ultis/main/cli-dist/setup-telemetry.sh | bash
```

This adds telemetry environment variables to `~/.claude/settings.json`, pointing to the monitoring endpoint at `http://claude-monitoring.athena.tools`.

## Uninstall

To remove Claude Code env vars from your machine:

**bash / zsh:**
```sh
curl -fsSL https://raw.githubusercontent.com/x-saola/litellm-ultis/main/cli-dist/uninstall.sh | sh && unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN && claude /logout && claude /login
```

**fish:**
```fish
curl -fsSL https://raw.githubusercontent.com/x-saola/litellm-ultis/main/cli-dist/uninstall.sh | sh; and set -e ANTHROPIC_BASE_URL; and set -e ANTHROPIC_AUTH_TOKEN; and claude /logout; and claude /login
```

This removes `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` from `~/.claude/settings.json` and all shell rc files (`.zshrc`, `.bashrc`, fish config, etc.), clears them from your current session, logs out, then logs back in with your Anthropic account.

## Architecture

- `cloudrun/` — Python FastAPI gateway (verifies Google ID token, checks domain whitelist, creates LiteLLM key)
- `cli/` — Bun TypeScript CLI (auth via Google OAuth2, writes env vars to `~/.claude/settings.json`)

## Security notes

- Access is restricted to approved Google Workspace domains
- LiteLLM master key is never exposed to end users
- Keys are scoped and can be rotated server-side
