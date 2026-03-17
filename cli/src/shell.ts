import { join } from "path";
import { homedir } from "os";

export type Shell = "bash" | "zsh" | "fish" | "powershell";

const MARKER_START = "# >>> claude-code <<<";
const MARKER_END = "# >>> claude-code end <<<";

export function detectShell(): Shell {
  if (process.platform === "win32") return "powershell";

  // Walk the full process tree and collect all shells found.
  // fish > zsh > bash — fish wins if it appears anywhere in the ancestry,
  // since it's never used as an internal wrapper (unlike zsh which Claude Code
  // and other tools spawn internally).
  const found = new Set<Shell>();
  try {
    let pid = process.ppid;
    for (let i = 0; i < 10; i++) {
      const r = Bun.spawnSync(["ps", "-p", String(pid), "-o", "ppid=,comm="]);
      const line = r.stdout.toString().trim();
      const parts = line.trim().split(/\s+/);
      const ppidStr = parts[0];
      const comm = parts.slice(1).join(" ").replace(/^-/, "");

      if (comm.includes("fish")) found.add("fish");
      else if (comm.includes("zsh")) found.add("zsh");
      else if (comm.includes("bash")) found.add("bash");
      else if (comm.includes("pwsh") || comm.includes("powershell")) found.add("powershell");

      if (!ppidStr || ppidStr === "1") break;
      pid = parseInt(ppidStr);
    }
  } catch {}

  if (found.has("fish")) return "fish";
  if (found.has("zsh")) return "zsh";
  if (found.has("bash")) return "bash";
  if (found.has("powershell")) return "powershell";

  // Last resort: $SHELL login shell
  const shell = process.env.SHELL ?? "";
  if (shell.endsWith("fish")) return "fish";
  if (shell.endsWith("zsh")) return "zsh";
  return "bash";
}

export function getShellConfigPath(shell: Shell): string {
  const home = homedir();
  switch (shell) {
    case "zsh":
      return join(home, ".zshrc");
    case "fish":
      return join(home, ".config", "fish", "config.fish");
    case "powershell":
      return join(
        home,
        "Documents",
        "PowerShell",
        "Microsoft.PowerShell_profile.ps1"
      );
    default:
      return join(home, ".bashrc");
  }
}

function buildEnvBlock(shell: Shell, baseUrl: string, authToken: string): string {
  const lines: string[] = [MARKER_START];

  if (shell === "fish") {
    lines.push(`set -Ux ANTHROPIC_BASE_URL "${baseUrl}"`);
    lines.push(`set -Ux ANTHROPIC_AUTH_TOKEN "${authToken}"`);
  } else if (shell === "powershell") {
    lines.push(`$env:ANTHROPIC_BASE_URL = "${baseUrl}"`);
    lines.push(`$env:ANTHROPIC_AUTH_TOKEN = "${authToken}"`);
    lines.push(`[Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', '${baseUrl}', 'User')`);
    lines.push(`[Environment]::SetEnvironmentVariable('ANTHROPIC_AUTH_TOKEN', '${authToken}', 'User')`);
  } else {
    lines.push(`export ANTHROPIC_BASE_URL="${baseUrl}"`);
    lines.push(`export ANTHROPIC_AUTH_TOKEN="${authToken}"`);
  }

  lines.push(MARKER_END);
  return lines.join("\n");
}

export async function writeShellConfig(
  shell: Shell,
  baseUrl: string,
  authToken: string,
  configPath?: string
): Promise<string> {
  configPath ??= getShellConfigPath(shell);
  const newBlock = buildEnvBlock(shell, baseUrl, authToken);

  let content = "";
  const file = Bun.file(configPath);
  if (await file.exists()) {
    content = await file.text();
    // Replace existing block if present
    const startIdx = content.indexOf(MARKER_START);
    const endIdx = content.indexOf(MARKER_END);
    if (startIdx !== -1 && endIdx !== -1) {
      content =
        content.slice(0, startIdx).trimEnd() +
        "\n" +
        content.slice(endIdx + MARKER_END.length).trimStart();
    }
    content = content.trimEnd() + "\n\n" + newBlock + "\n";
  } else {
    content = newBlock + "\n";
  }

  // Ensure parent directory exists
  const dir = configPath.split("/").slice(0, -1).join("/");
  if (dir) await Bun.$`mkdir -p ${dir}`.quiet().nothrow();

  await Bun.write(configPath, content);
  return configPath;
}

export function buildSourceInstruction(shell: Shell, configPath: string): string {
  switch (shell) {
    case "fish":
      return `source ${configPath}`;
    case "powershell":
      return `. ${configPath}`;
    default:
      return `source ${configPath}`;
  }
}
