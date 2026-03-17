import { describe, it, expect, spyOn, beforeEach, afterEach, mock } from "bun:test";
import { ensureClaudeInstalled } from "../src/claude-check";

describe("ensureClaudeInstalled", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    mock.restore();
  });

  it("does nothing when claude is already installed", async () => {
    spyOn(Bun, "which").mockImplementation((cmd) => (cmd === "claude" ? "/usr/local/bin/claude" : null));
    await expect(ensureClaudeInstalled()).resolves.toBeUndefined();
  });

  it("throws on non-macOS when claude is missing", async () => {
    spyOn(Bun, "which").mockImplementation(() => null);
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    await expect(ensureClaudeInstalled()).rejects.toThrow("macOS");
  });

  it("throws when brew is not found on macOS", async () => {
    spyOn(Bun, "which").mockImplementation((cmd) =>
      cmd === "claude" ? null : cmd === "brew" ? null : null
    );
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    await expect(ensureClaudeInstalled()).rejects.toThrow("Homebrew");
  });
});
