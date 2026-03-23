import { join } from "path";
import { homedir } from "os";

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

export async function writeClaudeSettings(baseUrl: string, authToken: string): Promise<string> {
  let settings: Record<string, any> = {};

  const file = Bun.file(SETTINGS_PATH);
  if (await file.exists()) {
    try {
      settings = JSON.parse(await file.text());
    } catch {
      // Ignore parse errors — overwrite with fresh settings
    }
  }

  settings.env = {
    ...(settings.env ?? {}),
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_AUTH_TOKEN: authToken,
  };

  // Ensure ~/.claude directory exists
  await Bun.$`mkdir -p ${join(homedir(), ".claude")}`.quiet().nothrow();
  await Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");

  return SETTINGS_PATH;
}
