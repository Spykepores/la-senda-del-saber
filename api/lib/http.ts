import { env } from "./env";

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export async function httpRequest<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", headers = {}, body } = options;

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

export async function kimiApiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${env.kimiOpenUrl}${endpoint}`;
  return httpRequest<T>(url, {
    ...options,
    headers: {
      ...options.headers,
      "X-App-ID": env.appId,
      "X-App-Secret": env.appSecret,
    },
  });
}
