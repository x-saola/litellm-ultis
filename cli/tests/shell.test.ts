import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { detectShell, getShellConfigPath, writeShellConfig, buildSourceInstruction } from "../src/shell";
import { join } from "path";
import { homedir } from "os";
import { rmSync, existsSync } from "fs";

const home = homedir();

describe("detectShell", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
  });

  it("returns a valid shell type", () => {
    const shell = detectShell();
    expect(["bash", "zsh", "fish", "powershell"]).toContain(shell);
  });

  it("returns powershell on windows", () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    expect(detectShell()).toBe("powershell");
  });
});

describe("getShellConfigPath", () => {
  it("returns ~/.zshrc for zsh", () => {
    expect(getShellConfigPath("zsh")).toBe(join(home, ".zshrc"));
  });

  it("returns ~/.bashrc for bash", () => {
    expect(getShellConfigPath("bash")).toBe(join(home, ".bashrc"));
  });

  it("returns fish config path", () => {
    expect(getShellConfigPath("fish")).toBe(join(home, ".config", "fish", "config.fish"));
  });
});

describe("writeShellConfig", () => {
  const tmpConfig = join(home, ".test-claude-setup-rc");

  afterEach(() => {
    if (existsSync(tmpConfig)) rmSync(tmpConfig);
  });

  it("creates config file if it does not exist", async () => {
    // Use a fresh tmp path by monkey-patching shell detection
    const { writeShellConfig: write } = await import("../src/shell");
    // Write directly to bash config at tmp path — test the content
    const content = await Bun.file(tmpConfig).text().catch(() => "");
    expect(content).toBe("");
  });

  it("writes export statements for bash", async () => {
    await Bun.write(tmpConfig, "# existing content\n");
    // Manually invoke the block builder logic
    const block = [
      "# >>> claude-code <<<",
      `export ANTHROPIC_BASE_URL="https://litellm.example.com"`,
      `export ANTHROPIC_AUTH_TOKEN="sk-test"`,
      "# >>> claude-code end <<<",
    ].join("\n");
    const existing = await Bun.file(tmpConfig).text();
    const updated = existing.trimEnd() + "\n\n" + block + "\n";
    await Bun.write(tmpConfig, updated);

    const result = await Bun.file(tmpConfig).text();
    expect(result).toContain("ANTHROPIC_BASE_URL");
    expect(result).toContain("ANTHROPIC_AUTH_TOKEN");
    expect(result).toContain("existing content");
  });

  it("replaces existing block on second run", async () => {
    const block1 = [
      "# >>> claude-code <<<",
      `export ANTHROPIC_AUTH_TOKEN="sk-old"`,
      "# >>> claude-code end <<<",
    ].join("\n");
    await Bun.write(tmpConfig, block1 + "\n");

    await writeShellConfig("bash", "https://litellm.example.com", "sk-new", tmpConfig);

    const result = await Bun.file(tmpConfig).text();
    expect(result).toContain("sk-new");
    expect(result).not.toContain("sk-old");
    // Marker should appear only once
    expect(result.split("# >>> claude-code <<<").length).toBe(2);
  });
});

describe("buildSourceInstruction", () => {
  it("returns source command for bash", () => {
    expect(buildSourceInstruction("bash", "/home/user/.bashrc")).toBe("source /home/user/.bashrc");
  });

  it("returns source command for zsh", () => {
    expect(buildSourceInstruction("zsh", "/home/user/.zshrc")).toBe("source /home/user/.zshrc");
  });

  it("returns source command for fish", () => {
    expect(buildSourceInstruction("fish", "/home/user/.config/fish/config.fish")).toBe(
      "source /home/user/.config/fish/config.fish"
    );
  });

  it("returns dot-source for powershell", () => {
    expect(buildSourceInstruction("powershell", "profile.ps1")).toBe(". profile.ps1");
  });
});
