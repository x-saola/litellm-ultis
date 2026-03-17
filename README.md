# LiteLLM Access (Google-Only, Bash)

This repo provisions LiteLLM keys using **Google OAuth Device Flow** in Bash.

- ✅ Linux/macOS first
- ✅ No LiteLLM SSO required
- ✅ Google domain-gated access (`ALLOWED_GOOGLE_HD`)

## What this does

1. User authenticates directly with Google (device flow).
2. Script verifies email + Workspace domain.
3. Script calls LiteLLM `/key/generate` with admin key.
4. Script prints Claude Code env exports.

## Requirements

- `bash`, `curl`, `jq`
- A Google OAuth client ID that supports device flow
- LiteLLM proxy with key management enabled (`/key/generate`)

## Safely sharing this script (recommended)

Yes — safest pattern is:

- Keep `LITELLM_MASTER_KEY` only on a server you control
- Expose a small **key broker endpoint** (Cloud Run / Lambda / internal API)
- Script sends Google bearer token to broker
- Broker validates token + domain, then calls LiteLLM `/key/generate` server-side

In this repo, set:

- `KEY_BROKER_URL=https://your-broker.example.com/issue-key`
- Leave `LITELLM_MASTER_KEY` empty on user machines

Direct mode (`LITELLM_MASTER_KEY` in `.env`) is for admins only and should not be broadly distributed.

## Setup

1. Fill in `.env` in project root.
2. Make script executable:
   - `chmod +x scripts/provision_litellm_key.sh`
3. Run:
   - `./scripts/provision_litellm_key.sh`

Optional: write generated key to env file:

- `OUTPUT_ENV_FILE=.claude/anthropic.env ./scripts/provision_litellm_key.sh`

## Claude Code usage

After script succeeds, export:

- `ANTHROPIC_BASE_URL=<your_litellm_base_url>`
- `ANTHROPIC_API_KEY=<generated_key>`

You can paste the printed `export` lines directly in your terminal.

## Terraform: create GCP project + enable Google Chat API

This repo now includes Terraform in `terraform/` to:

- create a GCP project under:
   - org: `353024852738`
   - folder: `662022351443`
- enable `chat.googleapis.com`
- create a service account for Google Chat app auth

### Prerequisites

- Terraform 1.5+
- Google credentials with permission to:
   - create projects in the target folder/org
   - attach billing account (if used)
   - enable project APIs

### Quick start

1. Copy vars template:
    - `cp terraform/terraform.tfvars.example terraform/terraform.tfvars`
2. Edit `terraform/terraform.tfvars` with your `project_id`, `project_name`, and optional `billing_account`.
3. Run Terraform from `terraform/`:
    - `terraform init`
    - `terraform plan`
    - `terraform apply`

### Programmatic setup with service account

After apply, get the created service account email from Terraform output:

- `chat_service_account_email`

Then in Google Cloud Console:

1. Open **Google Chat API** in the created project.
2. In **Configuration**, choose **App authentication: Service account**.
3. Select the service account returned by Terraform output.
4. Save configuration and add test users/groups.

For programmatic API calls, authenticate as that service account (prefer ADC / impersonation over static keys), request scope:

- `https://www.googleapis.com/auth/chat.bot`

Then call Chat API endpoints (for example, create a message) using the OAuth access token.

Important: `roles/chat.bot` is **not** a project IAM role, so do not grant it with project IAM bindings. Use the OAuth scope above when minting tokens.

> Note: Terraform can provision project, API enablement, service account, and IAM. Some Chat app UI configuration fields are still set in Google Cloud Console.

## Security notes

- Treat `LITELLM_MASTER_KEY` as highly sensitive.
- Prefer short key durations and model restrictions.
- Store only placeholders in committed files.
- If a key was committed by mistake, rotate it immediately.
