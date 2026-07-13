import { serialize, parse } from "cookie";

export function setCookie(name: string, value: string, maxAge: number): string {
  return serialize(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  });
}

export function getCookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const cookies = parse(cookieHeader);
  return cookies[name];
}

export function deleteCookie(name: string): string {
  return serialize(name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
