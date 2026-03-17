import { describe, it, expect, afterEach, spyOn } from "bun:test";
import { fetchLiteLLMKey } from "../src/gateway";

const TEST_URL = "https://gateway.example.com";
const TOKEN = "fake-identity-token";
const API_KEY = "test-api-key";

describe("fetchLiteLLMKey", () => {
  afterEach(() => {
    globalThis.fetch = fetch; // restore original
  });

  it("returns key and email on success", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ key: "sk-litellm-abc", email: "user@corp.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await fetchLiteLLMKey(TOKEN, API_KEY, TEST_URL);
    expect(result.key).toBe("sk-litellm-abc");
    expect(result.email).toBe("user@corp.com");
  });

  it("sends Authorization and X-API-Key headers", async () => {
    let capturedHeaders: Record<string, string> = {};
    globalThis.fetch = async (_url: any, init: any) => {
      capturedHeaders = Object.fromEntries(new Headers(init.headers).entries());
      return new Response(JSON.stringify({ key: "sk-x", email: "a@b.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    await fetchLiteLLMKey(TOKEN, API_KEY, TEST_URL);
    expect(capturedHeaders["authorization"]).toBe(`Bearer ${TOKEN}`);
    expect(capturedHeaders["x-api-key"]).toBe(API_KEY);
  });

  it("throws on non-200 response", async () => {
    globalThis.fetch = async () =>
      new Response("Unauthorized", { status: 401 });

    await expect(fetchLiteLLMKey(TOKEN, API_KEY, TEST_URL)).rejects.toThrow("401");
  });

  it("throws on 403 forbidden", async () => {
    globalThis.fetch = async () =>
      new Response("Forbidden", { status: 403 });

    await expect(fetchLiteLLMKey(TOKEN, API_KEY, TEST_URL)).rejects.toThrow("403");
  });
});
