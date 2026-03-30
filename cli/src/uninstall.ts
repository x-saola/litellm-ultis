#!/usr/bin/env bun
import * as p from "@clack/prompts";
import { join } from "path";
import { homedir } from "os";
import { MARKER_START, MARKER_END } from "./shell";
import { SETTINGS_PATH } from "./claude-settings";

const VARS = ["ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN"];

const SHELL_RC_FILES = [
  join(homedir(), ".zshrc"),
  join(homedir(), ".bashrc"),
  join(homedir(), ".bash_profile"),
  join(homedir(), ".config", "fish", "config.fish"),
  join(homedir(), "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1"),
];

// Patterns that match any way these vars could be set in shell rc files
const BARE_LINE_PATTERNS = VARS.flatMap((v) => [
  new RegExp(`^export ${v}=.*$`, "gm"),
  new RegExp(`^set -gx ${v} .*$`, "gm"),         // fish
  new RegExp(`^\\$env:${v} = .*$`, "gm"),         // powershell
  new RegExp(`^\\[Environment\\]::SetEnvironmentVariable\\('${v}'.*$`, "gm"), // powershell persistent
]);

async function removeFromShellRc(filePath: string): Promise<boolean> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return false;

  let content = await file.text();
  let changed = false;

  // Remove marker block
  const startIdx = content.indexOf(MARKER_START);
  const endIdx = content.indexOf(MARKER_END);
  if (startIdx !== -1 && endIdx !== -1) {
    content =
      content.slice(0, startIdx).trimEnd() +
      "\n" +
      content.slice(endIdx + MARKER_END.length).trimStart();
    changed = true;
  }

  // Remove any bare export/set lines outside markers
  for (const pattern of BARE_LINE_PATTERNS) {
    const next = content.replace(pattern, "");
    if (next !== content) {
      content = next;
      changed = true;
    }
  }

  if (!changed) return false;

  await Bun.write(filePath, content.trimEnd() + "\n");
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

  let changed = false;
  for (const v of VARS) {
    if (v in settings.env) {
      delete settings.env[v];
      changed = true;
    }
  }
  if (!changed) return false;

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

  // Remove from shell rc files (markers + bare lines)
  const rcResults = await Promise.all(
    SHELL_RC_FILES.map(async (rcFile) => ({ file: rcFile, cleaned: await removeFromShellRc(rcFile) }))
  );
  for (const { file, cleaned } of rcResults) {
    if (cleaned) removed.push(file);
  }

  // Remove from Claude Code settings.json
  const settingsCleaned = await removeFromClaudeSettings();
  if (settingsCleaned) removed.push(SETTINGS_PATH);

  if (removed.length === 0) {
    p.outro("Nothing to remove — no Claude Code env vars found.");
  } else {
    p.note(removed.join("\n"), "Cleaned up");
    p.outro("Done! Env vars removed from all config files.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
