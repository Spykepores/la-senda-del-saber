import { env } from "../lib/env";
import { httpRequest } from "../lib/http";
import type { KimiUser } from "./types";

export async function getKimiUser(accessToken: string): Promise<KimiUser> {
  return httpRequest<KimiUser>(`${env.kimiOpenUrl}/api/v1/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string }> {
  const response = await fetch(`${env.kimiAuthUrl}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      client_id: env.appId,
      client_secret: env.appSecret,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}
