const GATEWAY_URL = "https://litellm-access-gateway-929056649168.asia-southeast1.run.app";

export async function fetchLiteLLMKey(
  identityToken: string,
  apiKey: string,
  gatewayUrl: string = GATEWAY_URL
): Promise<{ key: string; email: string }> {
  const response = await fetch(`${gatewayUrl}/key`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${identityToken}`,
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gateway error ${response.status}: ${body}`);
  }

  return response.json() as Promise<{ key: string; email: string }>;
}
