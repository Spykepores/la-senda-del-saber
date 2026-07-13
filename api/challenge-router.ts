import { z } from "zod";
import { eq, or, desc, and } from "drizzle-orm";
import { challenges, challengeMessages, users, localUsers } from "../db/schema";
import { getDb } from "./queries/connection";
import { authedQuery } from "./middleware";
import { createRouter } from "./middleware";
import { TRPCError } from "@trpc/server";

const SEALS_TO_BREAK = 2;

function initSeals() {
  const cats = ["genealogy", "parables", "stories", "prophecy", "doctrine", "characters", "books"];
  const seals: Record<string, number> = {};
  cats.forEach(c => (seals[c] = 0));
  return JSON.stringify(seals);
}

async function getUserName(userId: number) {
  const db = getDb();
  const [oauth] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (oauth) return oauth.name || `Jugador #${userId}`;
  const [local] = await db.select().from(localUsers).where(eq(localUsers.id, userId)).limit(1);
  if (local) return local.name || `Jugador #${userId}`;
  return `Jugador #${userId}`;
}

export const duelRouter = createRouter({
  // List all active/open challenges for current user
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db.select().from(challenges)
      .where(or(eq(challenges.status, "pending"), eq(challenges.status, "active")))
      .orderBy(desc(challenges.createdAt));
    const result = [];
    for (const row of rows) {
      const challengerName = await getUserName(row.challengerId);
      const opponentName = row.opponentId ? await getUserName(row.opponentId) : null;
      result.push({
        id: row.id,
        challengerId: row.challengerId,
        challengerName,
        opponentId: row.opponentId,
        opponentName,
        status: row.status,
        winnerId: row.winnerId,
        createdAt: row.createdAt,
        isMine: row.challengerId === ctx.user.id || row.opponentId === ctx.user.id,
        currentCategory: row.currentCategory,
      });
    }
    return result;
  }),

  // List public challenges (open rooms without opponent)
  listPublic: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db.select().from(challenges)
      .where(and(eq(challenges.status, "active"), eq(challenges.opponentId, 0)))
      .orderBy(desc(challenges.createdAt));
    const result = [];
    for (const row of rows) {
      if (row.challengerId === ctx.user.id) continue; // Skip my own
      const challengerName = await getUserName(row.challengerId);
      result.push({
        id: row.id,
        challengerId: row.challengerId,
        challengerName,
        status: row.status,
        createdAt: row.createdAt,
      });
    }
    return result;
  }),

  // List my challenges (both as challenger and opponent)
  listMine: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db.select().from(challenges)
      .where(
        or(
          eq(challenges.challengerId, ctx.user.id),
          eq(challenges.opponentId, ctx.user.id)
        )
      )
      .orderBy(desc(challenges.createdAt));
    const result = [];
    for (const row of rows) {
      const challengerName = await getUserName(row.challengerId);
      const opponentName = row.opponentId ? await getUserName(row.opponentId) : null;
      result.push({
        id: row.id,
        challengerId: row.challengerId,
        challengerName,
        opponentId: row.opponentId,
        opponentName,
        status: row.status,
        winnerId: row.winnerId,
        createdAt: row.createdAt,
      });
    }
    return result;
  }),

  // Create a challenge
  create: authedQuery
    .input(z.object({ opponentId: z.number().optional(), name: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const inserted = await db.insert(challenges).values({
        challengerId: ctx.user.id,
        opponentId: input.opponentId || 0,
        status: input.opponentId ? "pending" : "active",
        challengerSeals: initSeals(),
        opponentSeals: initSeals(),
        currentRound: 1,
        challengerStreak: 0,
        opponentStreak: 0,
        challengerScore: 0,
        opponentScore: 0,
        currentCategory: input.name || undefined,
        startedAt: input.opponentId ? null : new Date(),
      }).returning({ id: challenges.id });
      return { id: inserted[0]?.id ?? 0, status: input.opponentId ? "pending" as const : "active" as const };
    }),

  // Join an open challenge
  join: authedQuery
    .input(z.object({ challengeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(challenges).where(eq(challenges.id, input.challengeId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Desafio no encontrado" });
      if (row.challengerId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes unirte a tu propio desafio" });
      if (row.opponentId && row.opponentId !== 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Este desafio ya tiene oponente" });
      await db.update(challenges).set({ opponentId: ctx.user.id, status: "active", startedAt: new Date() }).where(eq(challenges.id, input.challengeId));
      return { success: true };
    }),

  // Accept a pending challenge (where I am the opponent)
  accept: authedQuery
    .input(z.object({ challengeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(challenges).where(eq(challenges.id, input.challengeId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Desafio no encontrado" });
      if (row.opponentId !== ctx.user.id && row.opponentId !== 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes aceptar este desafio" });
      await db.update(challenges).set({ opponentId: ctx.user.id, status: "active", startedAt: new Date() }).where(eq(challenges.id, input.challengeId));
      return { success: true };
    }),

  // Get challenge state (for polling)
  get: authedQuery
    .input(z.object({ challengeId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db.select().from(challenges).where(eq(challenges.id, input.challengeId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Desafio no encontrado" });
      return {
        ...row,
        challengerName: await getUserName(row.challengerId),
        opponentName: row.opponentId ? await getUserName(row.opponentId) : null,
      };
    }),

  // Submit answer
  submitAnswer: authedQuery
    .input(z.object({ challengeId: z.number(), correct: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(challenges).where(eq(challenges.id, input.challengeId)).limit(1);
      if (!row || row.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Desafio no activo" });

      const isChallenger = row.challengerId === ctx.user.id;
      if (!isChallenger && row.opponentId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "No participas en este desafio" });

      const mySealsKey = isChallenger ? "challengerSeals" : "opponentSeals";
      const myStreakKey = isChallenger ? "challengerStreak" : "opponentStreak";
      const myScoreKey = isChallenger ? "challengerScore" : "opponentScore";
      const seals = JSON.parse(row[mySealsKey as keyof typeof row] as string || "{}");

      if (input.correct) {
        const cat = row.currentCategory || "doctrine";
        seals[cat] = (seals[cat] || 0) + 1;
        const streak = (row[myStreakKey as keyof typeof row] as number || 0) + 1;
        const score = (row[myScoreKey as keyof typeof row] as number || 0) + 1;
        const allBroken = Object.values(seals).every((v) => (v as number) >= SEALS_TO_BREAK);

        if (allBroken) {
          await db.update(challenges).set({ [mySealsKey]: JSON.stringify(seals), [myStreakKey]: streak, [myScoreKey]: score, status: "completed", winnerId: ctx.user.id, endedAt: new Date() }).where(eq(challenges.id, input.challengeId));
          return { result: "win" as const };
        } else {
          await db.update(challenges).set({ [mySealsKey]: JSON.stringify(seals), [myStreakKey]: streak, [myScoreKey]: score }).where(eq(challenges.id, input.challengeId));
          return { result: "correct" as const };
        }
      } else {
        await db.update(challenges).set({ [myStreakKey]: 0 }).where(eq(challenges.id, input.challengeId));
        return { result: "wrong" as const };
      }
    }),

  // Forfeit
  forfeit: authedQuery
    .input(z.object({ challengeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(challenges).where(eq(challenges.id, input.challengeId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      const winnerId = row.challengerId === ctx.user.id ? row.opponentId : row.challengerId;
      await db.update(challenges).set({ status: "completed", winnerId, endedAt: new Date() }).where(eq(challenges.id, input.challengeId));
      return { winnerId };
    }),

  // Chat
  sendMessage: authedQuery
    .input(z.object({ challengeId: z.number(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.insert(challengeMessages).values({ challengeId: input.challengeId, senderId: ctx.user.id, senderName: ctx.user.name || "Jugador", content: input.content });
      return { success: true };
    }),

  getMessages: authedQuery
    .input(z.object({ challengeId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(challengeMessages).where(eq(challengeMessages.challengeId, input.challengeId)).orderBy(desc(challengeMessages.createdAt)).limit(50);
      return rows.reverse();
    }),
});
