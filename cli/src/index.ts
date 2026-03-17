#!/usr/bin/env bun
import * as p from "@clack/prompts";
import { ensureClaudeInstalled } from "./claude-check";
import { getGoogleIdentityToken, isHeadless } from "./auth";
import { fetchLiteLLMKey } from "./gateway";
import { detectShell, writeShellConfig, buildSourceInstruction } from "./shell";

const LITELLM_URL = "https://litellm.athena.tools/";
const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY ?? "V9!z$6$@IE2qw4TODSuP";

async function main() {
  console.clear();
  p.intro("Claude Code Setup");

  // Step 1: Ensure Claude Code is installed
  const claudeSpinner = p.spinner();
  claudeSpinner.start("Checking Claude Code installation");
  try {
    await ensureClaudeInstalled(() => claudeSpinner.stop("Installing Claude Code…"));
    if (Bun.which("claude")) claudeSpinner.stop("Claude Code is installed");
  } catch (err: any) {
    claudeSpinner.stop("Failed");
    p.cancel(err.message);
    process.exit(1);
  }

  // Step 2: Google auth
  let identityToken: string;
  if (isHeadless()) {
    try {
      identityToken = await getGoogleIdentityToken();
    } catch (err: any) {
      p.cancel(err.message);
      process.exit(1);
    }
  } else {
    const authSpinner = p.spinner();
    authSpinner.start("Authenticating with Google");
    try {
      identityToken = await getGoogleIdentityToken();
      authSpinner.stop("Authenticated");
    } catch (err: any) {
      authSpinner.stop("Failed");
      p.cancel(err.message);
      process.exit(1);
    }
  }

  // Step 3: Fetch LiteLLM key from gateway
  const keySpinner = p.spinner();
  keySpinner.start("Fetching your LiteLLM key");
  let litellmKey: string;
  let email: string;
  try {
    const result = await fetchLiteLLMKey(identityToken, GATEWAY_API_KEY);
    litellmKey = result.key;
    email = result.email;
    keySpinner.stop(`Key issued for ${email}`);
  } catch (err: any) {
    keySpinner.stop("Failed");
    p.cancel(err.message);
    process.exit(1);
  }

  // Step 4: Write env vars to shell config
  const shell = detectShell();
  const configSpinner = p.spinner();
  configSpinner.start(`Writing env vars to ${shell} config`);
  let configPath: string;
  try {
    configPath = await writeShellConfig(shell, LITELLM_URL, litellmKey);
    configSpinner.stop(`Written to ${configPath}`);
  } catch (err: any) {
    configSpinner.stop("Failed to write shell config");
    p.cancel(err.message);
    process.exit(1);
  }

  // Step 5: Write temp exports file for install.sh to eval
  await Bun.write("/tmp/claude-code-exports", `export ANTHROPIC_BASE_URL="${LITELLM_URL}"\nexport ANTHROPIC_AUTH_TOKEN="${litellmKey}"\n`);

  // Step 6: Print summary
  p.note(
    [
      `ANTHROPIC_AUTH_TOKEN = ${litellmKey}`,
      "",
      `Env vars written to ${configPath}`,
      `and applied to your current session.`,
    ].join("\n"),
    "Your credentials"
  );

  p.outro("Done! Claude Code is ready to use.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
