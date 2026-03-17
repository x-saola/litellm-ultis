import { $ } from "bun";

export async function ensureClaudeInstalled(): Promise<void> {
  const existing = Bun.which("claude");
  if (existing) return;

  if (process.platform === "linux") {
    console.log("Installing Claude Code via install script…");
    try {
      await $`bash -c "curl -fsSL https://claude.ai/install.sh | bash"`;
    } catch (err: any) {
      throw new Error(
        `Failed to install Claude Code on Linux. Try manually:\n` +
          `  curl -fsSL https://claude.ai/install.sh | bash\n\n` +
          `Error: ${err.message}`
      );
    }
    return;
  }

  if (process.platform !== "darwin") {
    throw new Error(
      "Auto-install is only supported on macOS and Linux. Please install Claude Code manually:\n" +
        "  https://docs.anthropic.com/claude-code"
    );
  }

  if (!Bun.which("brew")) {
    throw new Error(
      "Homebrew not found. Install it first: https://brew.sh"
    );
  }

  console.log("Installing Claude Code via Homebrew…");
  try {
    await $`brew install claude-code`;
  } catch (err: any) {
    throw new Error(
      `Failed to install Claude Code via Homebrew. Try manually:\n` +
        `  brew install claude-code\n\n` +
        `Error: ${err.message}`
    );
  }

  // Clear macOS quarantine attribute so Gatekeeper doesn't block it
  const claudePath = Bun.which("claude");
  if (claudePath) {
    await $`xattr -cr ${claudePath}`.nothrow();
    // Also clear quarantine on the parent directory (covers symlinked bins)
    const brewPrefix = await $`brew --prefix claude-code`.text().catch(() => "");
    if (brewPrefix.trim()) {
      await $`xattr -cr ${brewPrefix.trim()}`.nothrow();
    }
  }
}
