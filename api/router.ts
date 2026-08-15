import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { 
  users, localUsers, questions, gameSessions, leaderboard,
  achievements, userAchievements, bibleBooks, dailyReadings
} from "../db/schema";
import { getDb } from "./queries/connection";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { TRPCError } from "@trpc/server";

export const appRouter = createRouter({
  ping: publicQuery.query(() => "pong"),

  auth: createRouter({
    me: publicQuery.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      return ctx.user;
    }),
  }),

  leaderboard: createRouter({
    get: publicQuery.query(async () => {
      const db = getDb();
      const rows = await db.select().from(leaderboard).orderBy(desc(leaderboard.totalScore)).limit(50);
      return rows;
    }),

    submit: publicQuery
      .input(z.object({ playerName: z.string().min(1).max(50), score: z.number().min(0), mode: z.string() }))
      .mutation(async ({ input }) => {
        const db = getDb();
        const [entry] = await db
          .insert(leaderboard)
          .values({ playerName: input.playerName, score: input.score, totalScore: input.score, mode: input.mode, date: new Date() })
          .returning();
        return entry;
      }),
  }),

  progress: createRouter({
    get: authedQuery.query(async ({ ctx }) => {
      const db = getDb();
      const rows = await db.select().from(gameSessions).where(eq(gameSessions.userId, ctx.user.id)).orderBy(desc(gameSessions.createdAt)).limit(10);
      return rows;
    }),

    save: authedQuery
      .input(z.object({ score: z.number(), mode: z.string(), seals: z.number().optional(), completed: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = getDb();
        const [session] = await db
          .insert(gameSessions)
          .values({ userId: ctx.user.id, score: input.score, mode: input.mode, seals: input.seals || 0, completed: input.completed || false })
          .returning();

        // Update leaderboard total
        const existing = await db.select().from(leaderboard).where(eq(leaderboard.playerName, ctx.user.name || `User ${ctx.user.id}`)).limit(1);
        if (existing.length > 0) {
          await db.update(leaderboard).set({ totalScore: sql`${leaderboard.totalScore} + ${input.score}` }).where(eq(leaderboard.playerName, ctx.user.name || `User ${ctx.user.id}`));
        } else {
          await db.insert(leaderboard).values({ playerName: ctx.user.name || `User ${ctx.user.id}`, score: input.score, totalScore: input.score, mode: input.mode });
        }

        return session;
      }),
  }),

  questions: createRouter({
    getByCategory: publicQuery
      .input(z.object({ category: z.string(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        const db = getDb();
        const all = await db.select().from(questions).where(eq(questions.category, input.category));
        const shuffled = all.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, input.limit || 10);
      }),

    getRandom: publicQuery
      .input(z.object({ category: z.string().optional(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        const db = getDb();
        if (input.category) {
          const all = await db.select().from(questions).where(eq(questions.category, input.category));
          const shuffled = all.sort(() => Math.random() - 0.5);
          return shuffled.slice(0, input.limit || 1);
        }
        const all = await db.select().from(questions);
        const shuffled = all.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, input.limit || 1);
      }),

    checkAnswer: publicQuery
      .input(z.object({ questionId: z.number(), selectedOption: z.number() }))
      .query(async ({ input }) => {
        const db = getDb();
        const [q] = await db.select().from(questions).where(eq(questions.id, input.questionId)).limit(1);
        if (!q) throw new TRPCError({ code: "NOT_FOUND" });
        return { correct: q.correctAnswer === input.selectedOption, correctAnswer: q.correctAnswer };
      }),
  }),

  achievements: createRouter({
    list: publicQuery.query(async () => {
      const db = getDb();
      return db.select().from(achievements);
    }),

    getUserAchievements: authedQuery.query(async ({ ctx }) => {
      const db = getDb();
      const userAch = await db.select().from(userAchievements).where(eq(userAchievements.userId, ctx.user.id));
      const allAch = await db.select().from(achievements);
      return allAch.map((ach) => ({
        ...ach,
        unlocked: userAch.some((ua) => ua.achievementId === ach.id),
        unlockedAt: userAch.find((ua) => ua.achievementId === ach.id)?.unlockedAt,
      }));
    }),

    unlock: authedQuery
      .input(z.object({ achievementId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = getDb();
        const existing = await db
          .select()
          .from(userAchievements)
          .where(and(eq(userAchievements.userId, ctx.user.id), eq(userAchievements.achievementId, input.achievementId)))
          .limit(1);
        if (existing.length > 0) return existing[0];
        const [ua] = await db
          .insert(userAchievements)
          .values({ userId: ctx.user.id, achievementId: input.achievementId })
          .returning();
        return ua;
      }),
  }),

  bible: createRouter({
    books: publicQuery.query(async () => {
      const db = getDb();
      return db.select().from(bibleBooks).orderBy(bibleBooks.order);
    }),

    dailyReading: publicQuery.query(async () => {
      const db = getDb();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [reading] = await db.select().from(dailyReadings).where(eq(dailyReadings.date, today)).limit(1);
      if (!reading) {
        // Generate a random reading
        const books = await db.select().from(bibleBooks);
        const book = books[Math.floor(Math.random() * books.length)];
        const chapter = Math.floor(Math.random() * (book.chapters || 1)) + 1;
        return { book: book.name, chapter, verses: "1-10", theme: "Lectura del dia" };
      }
      return reading;
    }),
  }),

  // Challenge router
  duel: createRouter(await import("./challenge-router").then(m => m.duelRouter)),

  // Chat router
  chat: createRouter(await import("./chat-router").then(m => m.chatRouter)),

  // Users router
  users: createRouter(await import("./users-router").then(m => m.usersRouter)),
});

export type AppRouter = typeof appRouter;
