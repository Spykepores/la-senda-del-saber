import { users, localUsers } from "../db/schema";
import { getDb } from "./queries/connection";
import { authedQuery, createRouter } from "./middleware";

export const usersRouter = createRouter({
  // List all registered users (both OAuth and local)
  list: authedQuery.query(async () => {
    const db = getDb();
    const oauthUsers = await db.select().from(users).orderBy(users.createdAt);
    const localUsersList = await db.select().from(localUsers).orderBy(localUsers.createdAt);
    const result = [
      ...oauthUsers.map((u) => ({
        id: u.id,
        name: u.name || `Usuario #${u.id}`,
        email: u.email,
        source: "oauth" as const,
        createdAt: u.createdAt,
      })),
      ...localUsersList.map((u) => ({
        id: u.id,
        name: u.name || `Usuario #${u.id}`,
        email: u.email,
        source: "local" as const,
        createdAt: u.createdAt,
      })),
    ];
    return result;
  }),
});
