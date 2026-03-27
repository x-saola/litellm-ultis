#!/usr/bin/env bun
import * as p from "@clack/prompts";
import { join } from "path";
import { homedir } from "os";

const MARKER_START = "# >>> claude-code <<<";
const MARKER_END = "# >>> claude-code end <<<";
const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

const SHELL_RC_FILES = [
  join(homedir(), ".zshrc"),
  join(homedir(), ".bashrc"),
  join(homedir(), ".bash_profile"),
  join(homedir(), ".config", "fish", "config.fish"),
  join(homedir(), "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1"),
];

async function removeFromShellRc(filePath: string): Promise<boolean> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return false;

  const content = await file.text();
  const startIdx = content.indexOf(MARKER_START);
  const endIdx = content.indexOf(MARKER_END);
  if (startIdx === -1 || endIdx === -1) return false;

  const cleaned =
    content.slice(0, startIdx).trimEnd() +
    "\n" +
    content.slice(endIdx + MARKER_END.length).trimStart();

  await Bun.write(filePath, cleaned.trimEnd() + "\n");
  return true;
}

async function removeFromClaudeSettings(): Promise<boolean> {
  const file = Bun.file(SETTINGS_PATH);
  if (!(await file.exists())) return false;

  let settings: Record<string, any>;
  try {
    settings = JSON.parse(await file.text());
  } catch {
    return false;
  }

  if (!settings.env) return false;

  delete settings.env.ANTHROPIC_BASE_URL;
  delete settings.env.ANTHROPIC_AUTH_TOKEN;

  if (Object.keys(settings.env).length === 0) {
    delete settings.env;
  }

  await Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
  return true;
}

async function main() {
  console.clear();
  p.intro("Claude Code Uninstall");

  const removed: string[] = [];

  // Remove from shell rc files
  for (const rcFile of SHELL_RC_FILES) {
    const cleaned = await removeFromShellRc(rcFile);
    if (cleaned) removed.push(rcFile);
  }

  // Remove from Claude Code settings.json
  const settingsCleaned = await removeFromClaudeSettings();
  if (settingsCleaned) removed.push(SETTINGS_PATH);

  if (removed.length === 0) {
    p.outro("Nothing to remove — no Claude Code env vars found.");
  } else {
    p.note(removed.join("\n"), "Cleaned up");
    p.outro("Done! ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN have been removed.\nRestart your shell or run: unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
