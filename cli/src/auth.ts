import { $ } from "bun";
import { createServer } from "http";
import { randomBytes, createHash } from "crypto";

// Embedded OAuth2 Desktop app credentials (not secret for installed apps per Google's guidelines)
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "929056649168-nkg4e7sveti51m9ghtmevsu9e87og8s1.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "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";
const REDIRECT_PORT = 9_876;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;
const AUTH_TIMEOUT_MS = 120_000;

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generatePKCE() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// ── Browser OAuth2 flow ───────────────────────────────────────────────────────

async function openBrowser(url: string): Promise<void> {
  const cmd =
    process.platform === "win32" ? "start" :
    process.platform === "darwin" ? "open" :
    "xdg-open";
  await $`${cmd} ${url}`.quiet().nothrow();
}

async function waitForAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${REDIRECT_PORT}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:2rem">
          <h2>Authentication successful!</h2>
          <p>You can close this tab and return to the terminal.</p>
        </body></html>`
      );
      server.close();

      if (error) reject(new Error(`Google OAuth error: ${error}`));
      else if (code) resolve(code);
      else reject(new Error("No auth code received from Google"));
    });

    server.listen(REDIRECT_PORT, () => {});

    setTimeout(() => {
      server.close();
      reject(new Error("Authentication timed out. Please try again."));
    }, AUTH_TIMEOUT_MS);
  });
}

export async function exchangeCodeForIdToken(code: string, verifier: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${await response.text()}`);
  }

  const tokens = (await response.json()) as { id_token?: string };
  if (!tokens.id_token) {
    throw new Error("Google did not return an id_token. Check OAuth scopes.");
  }
  return tokens.id_token;
}

function isHeadless(): boolean {
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) return true;
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return true;
  return false;
}

async function headlessOAuthFlow(): Promise<string> {
  const { verifier, challenge } = generatePKCE();
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      code_challenge: challenge,
      code_challenge_method: "S256",
      access_type: "offline",
    });

  console.log("\n─────────────────────────────────────────────────────────────");
  console.log("Headless environment detected. Manual sign-in required.");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("\n1. Open this URL in your browser:\n");
  console.log(`   ${authUrl}\n`);
  console.log("2. Sign in with your Google account.");
  console.log("3. You'll be redirected to localhost and see a connection error.");
  console.log("4. Copy the full URL from the address bar and paste it below.\n");

  process.stdout.write("Paste the redirect URL here: ");
  const pastedUrl = await new Promise<string>((resolve) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    process.stdin.once("data", (chunk) => {
      input = chunk.toString().trim();
      process.stdin.pause();
      resolve(input);
    });
  });

  let code: string | null = null;
  try {
    const parsed = new URL(pastedUrl);
    code = parsed.searchParams.get("code");
  } catch {
    throw new Error("Invalid URL pasted. Please paste the full redirect URL.");
  }

  if (!code) throw new Error("No auth code found in the pasted URL.");
  return exchangeCodeForIdToken(code, verifier);
}

async function browserOAuthFlow(): Promise<string> {
  const { verifier, challenge } = generatePKCE();
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      code_challenge: challenge,
      code_challenge_method: "S256",
      access_type: "offline",
    });

  console.log(`\nOpening browser for Google sign-in…\nIf it doesn't open, visit:\n  ${authUrl}\n`);
  await openBrowser(authUrl);

  const code = await waitForAuthCode();
  return exchangeCodeForIdToken(code, verifier);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getGoogleIdentityToken(): Promise<string> {
  if (isHeadless()) return headlessOAuthFlow();
  return browserOAuthFlow();
}
