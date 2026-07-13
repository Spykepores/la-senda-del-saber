import type { CreateContextFn } from "@trpc/server/adapters/fetch";
import { verifyToken } from "./kimi/session";

export interface Context {
  user: {
    id: number;
    unionId: string;
    name: string;
    email?: string | null;
    avatar?: string | null;
    role: string;
  } | null;
}

export const createContext: CreateContextFn = async ({ req }) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { user: null };

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token);
    return {
      user: {
        id: payload.id,
        unionId: payload.unionId,
        name: payload.name,
        email: payload.email,
        avatar: payload.avatar,
        role: payload.role,
      },
    };
  } catch {
    return { user: null };
  }
};
