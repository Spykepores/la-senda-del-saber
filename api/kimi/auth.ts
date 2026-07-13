import { Hono } from "hono";
import { exchangeCodeForToken, getKimiUser } from "./platform";
import { createToken } from "./session";
import { findUserByUnionId, upsertUser } from "../queries/users";

export const oauthApp = new Hono();

oauthApp.get("/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.text("Missing code", 400);

  try {
    const { access_token } = await exchangeCodeForToken(code);
    const kimiUser = await getKimiUser(access_token);

    await upsertUser({
      unionId: kimiUser.union_id,
      name: kimiUser.name,
      email: kimiUser.email,
      avatar: kimiUser.avatar,
    });

    const dbUser = await findUserByUnionId(kimiUser.union_id);
    if (!dbUser) return c.text("User creation failed", 500);

    const token = await createToken({
      id: dbUser.id,
      unionId: dbUser.unionId,
      name: dbUser.name || "User",
      email: dbUser.email,
      avatar: dbUser.avatar,
      role: dbUser.role,
    });

    return c.redirect(`/?token=${token}`);
  } catch (error) {
    console.error("OAuth error:", error);
    return c.text("Authentication failed", 500);
  }
});
