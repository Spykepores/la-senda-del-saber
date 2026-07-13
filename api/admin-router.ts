import { z } from "zod";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, localUsers, questions, playerStats } from "@db/schema";
import { eq, sql } from "drizzle-orm";

export const adminRouter = createRouter({
  stats: adminQuery.query(async () => {
    const db = getDb();
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [localCount] = await db.select({ count: sql<number>`count(*)` }).from(localUsers);
    const [questionCount] = await db.select({ count: sql<number>`count(*)` }).from(questions);
    const [statsCount] = await db.select({ count: sql<number>`count(*)` }).from(playerStats);

    return {
      users: userCount?.count ?? 0,
      localUsers: localCount?.count ?? 0,
      questions: questionCount?.count ?? 0,
      playerStats: statsCount?.count ?? 0,
    };
  }),

  users: adminQuery
    .input(z.object({ page: z.number().optional(), limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;
      const offset = (page - 1) * limit;

      const oauthUsers = await db.select().from(users).limit(limit).offset(offset);
      const local = await db.select().from(localUsers).limit(limit).offset(offset);

      return { oauthUsers, localUsers: local };
    }),

  deleteUser: adminQuery
    .input(z.object({ id: z.number(), type: z.enum(["oauth", "local"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.type === "oauth") {
        await db.delete(users).where(eq(users.id, input.id));
      } else {
        await db.delete(localUsers).where(eq(localUsers.id, input.id));
      }
      return { success: true };
    }),
});
