import { SignJWT, jwtVerify } from "jose";
import { env } from "../lib/env";
import type { KimiTokenPayload } from "./types";

const secret = new TextEncoder().encode(env.appSecret);

export async function createToken(payload: KimiTokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<KimiTokenPayload> {
  const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 });
  return payload as unknown as KimiTokenPayload;
}
