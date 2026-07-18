import { z } from "zod";
import { eq, or, desc, and, ne } from "drizzle-orm";
import { challenges, challengeMessages, users, localUsers, questions } from "../db/schema";
import { getDb } from "./queries/connection";
import { authedQuery } from "./middleware";
import { createRouter } from "./middleware";
import { TRPCError } from "@trpc/server";

const SEALS_TO_BREAK = 2;
const CATEGORIES = ["genealogy", "parables", "stories", "prophecy", "doctrine", "characters", "books"];

function initSeals() {
  const seals: Record<string, number> = {};
  CATEGORIES.forEach((c) => (seals[c] = 0));
  return JSON.stringify(seals);
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export async function getUserName(userId: number) {
  const db = getDb();
  const [oauth] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (oauth) return oauth.name || `Jugador #${userId}`;
  const [local] = await db.select().from(localUsers).where(eq(localUsers.id, userId)).limit(1);
  if (local) return local.name || `Jugador #${userId}`;
  return `Jugador #${userId}`;
}

async function ensureUniqueRoomCode(db: ReturnType<typeof getDb>): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts++) {
    const code = generateRoomCode();
    const existing = await db.select().from(challenges).where(eq(challenges.roomCode, code)).limit(1);
    if (existing.length === 0) return code;
  }
  return generateRoomCode() + Math.floor(Math.random() * 10);
}

export const duelRouter = createRouter({
  // List all active/open challenges
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(challenges)
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
        roomCode: row.roomCode,
        currentTurnUserId: row.currentTurnUserId,
      });
    }
    return result;
  }),

  // List public challenges (open rooms without opponent)
  listPublic: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(challenges)
      .where(and(eq(challenges.status, "active"), eq(challenges.opponentId, 0)))
      .orderBy(desc(challenges.createdAt));
    const result = [];
    for (const row of rows) {
      if (row.challengerId === ctx.user.id) continue;
      const challengerName = await getUserName(row.challengerId);
      result.push({
        id: row.id,
        challengerId: row.challengerId,
        challengerName,
        status: row.status,
        createdAt: row.createdAt,
        roomCode: row.roomCode,
      });
    }
    return result;
  }),

  // List my challenges
  listMine: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(challenges)
      .where(or(eq(challenges.challengerId, ctx.user.id), eq(challenges.opponentId, ctx.user.id)))
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
        roomCode: row.roomCode,
      });
    }
    return result;
  }),

  // Create a challenge
  create: authedQuery
    .input(z.object({ opponentId: z.number().optional(), name: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const roomCode = await ensureUniqueRoomCode(db);
      const inserted = await db
        .insert(challenges)
        .values({
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
          roomCode,
          currentCategory: input.name || undefined,
          startedAt: input.opponentId ? null : new Date(),
        })
        .returning({ id: challenges.id, roomCode: challenges.roomCode });
      return {
        id: inserted[0]?.id ?? 0,
        status: input.opponentId ? ("pending" as const) : ("active" as const),
        roomCode: inserted[0]?.roomCode ?? "",
      };
    }),

  // Join an open challenge
  join: authedQuery
    .input(z.object({ challengeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(challenges).where(eq(challenges.id, input.challengeId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Desafio no encontrado" });
      if (row.challengerId === ctx.user.id)
        throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes unirte a tu propio desafio" });
      if (row.opponentId && row.opponentId !== 0)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este desafio ya tiene oponente" });
      await db
        .update(challenges)
        .set({ opponentId: ctx.user.id, status: "active", startedAt: new Date() })
        .where(eq(challenges.id, input.challengeId));
      return { success: true };
    }),

  // Join by room code
  getByRoomCode: authedQuery
    .input(z.object({ roomCode: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(challenges)
        .where(eq(challenges.roomCode, input.roomCode.toUpperCase()))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Sala no encontrada" });
      if (row.status !== "active" && row.status !== "pending")
        throw new TRPCError({ code: "BAD_REQUEST", message: "La sala ya no esta activa" });
      if (row.opponentId && row.opponentId !== 0 && row.opponentId !== ctx.user.id)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Sala llena" });
      const challengerName = await getUserName(row.challengerId);
      const opponentName = row.opponentId ? await getUserName(row.opponentId) : null;
      return { ...row, challengerName, opponentName };
    }),

  // Accept a pending challenge
  accept: authedQuery
    .input(z.object({ challengeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(challenges).where(eq(challenges.id, input.challengeId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Desafio no encontrado" });
      if (row.opponentId !== ctx.user.id && row.opponentId !== 0)
        throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes aceptar este desafio" });
      await db
        .update(challenges)
        .set({ opponentId: ctx.user.id, status: "active", startedAt: new Date() })
        .where(eq(challenges.id, input.challengeId));
      return { success: true };
    }),

  // Get challenge state
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

  // Get current question for a challenge's category
  getCurrentQuestion: authedQuery
    .input(z.object({ challengeId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db.select().from(challenges).where(eq(challenges.id, input.challengeId)).limit(1);
      if (!row || row.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Desafio no activo" });

      const category = row.currentCategory;
      if (!category) throw new TRPCError({ code: "BAD_REQUEST", message: "No hay categoria activa" });

      // Get a random active question from this category, excluding the last used one
      const pool = await db
        .select()
        .from(questions)
        .where(and(eq(questions.category, category as any), eq(questions.isActive, true), ne(questions.id, row.currentQuestionId || 0)));

      if (pool.length === 0) {
        // Fallback: include the last used question if no others available
        const fallback = await db
          .select()
          .from(questions)
          .where(and(eq(questions.category, category as any), eq(questions.isActive, true)));
        if (fallback.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No hay preguntas para esta categoria" });
        const q = fallback[Math.floor(Math.random() * fallback.length)];
        return { id: q.id, question: q.question, options: [q.option1, q.option2, q.option3, q.option4], correctAnswer: q.correctAnswer, explanation: q.explanation, category: q.category, difficulty: q.difficulty };
      }

      const q = pool[Math.floor(Math.random() * pool.length)];
      return { id: q.id, question: q.question, options: [q.option1, q.option2, q.option3, q.option4], correctAnswer: q.correctAnswer, explanation: q.explanation, category: q.category, difficulty: q.difficulty };
    }),

  // Submit answer - SERVER VALIDATED (questionId + selectedOption, NOT correct boolean)
  submitAnswer: authedQuery
    .input(z.object({ challengeId: z.number(), questionId: z.number(), selectedOption: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(challenges).where(eq(challenges.id, input.challengeId)).limit(1);
      if (!row || row.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Desafio no activo" });

      const isChallenger = row.challengerId === ctx.user.id;
      if (!isChallenger && row.opponentId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "No participas en este desafio" });

      // Validate the answer against the actual question in DB
      const [question] = await db.select().from(questions).where(eq(questions.id, input.questionId)).limit(1);
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Pregunta no encontrada" });

      const correct = question.correctAnswer === input.selectedOption;

      const mySealsKey = isChallenger ? "challengerSeals" : "opponentSeals";
      const myStreakKey = isChallenger ? "challengerStreak" : "opponentStreak";
      const myScoreKey = isChallenger ? "challengerScore" : "opponentScore";
      const seals = JSON.parse((row[mySealsKey as keyof typeof row] as string) || "{}");

      // Track current question as used
      await db
        .update(challenges)
        .set({ currentQuestionId: input.questionId })
        .where(eq(challenges.id, input.challengeId));

      if (correct) {
        const cat = row.currentCategory || "doctrine";
        seals[cat] = (seals[cat] || 0) + 1;
        const streak = ((row[myStreakKey as keyof typeof row] as number) || 0) + 1;
        const score = ((row[myScoreKey as keyof typeof row] as number) || 0) + 1;
        const allBroken = Object.values(seals).every((v) => (v as number) >= SEALS_TO_BREAK);

        if (allBroken) {
          await db
            .update(challenges)
            .set({
              [mySealsKey]: JSON.stringify(seals),
              [myStreakKey]: streak,
              [myScoreKey]: score,
              status: "completed",
              winnerId: ctx.user.id,
              endedAt: new Date(),
            })
            .where(eq(challenges.id, input.challengeId));
          return { result: "win" as const, correct: true };
        } else {
          await db
            .update(challenges)
            .set({ [mySealsKey]: JSON.stringify(seals), [myStreakKey]: streak, [myScoreKey]: score })
            .where(eq(challenges.id, input.challengeId));
          return { result: "correct" as const, correct: true };
        }
      } else {
        await db
          .update(challenges)
          .set({ [myStreakKey]: 0 })
          .where(eq(challenges.id, input.challengeId));
        return { result: "wrong" as const, correct: false };
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
      await db
        .update(challenges)
        .set({ status: "completed", winnerId, endedAt: new Date() })
        .where(eq(challenges.id, input.challengeId));
      return { winnerId };
    }),

  // Chat
  sendMessage: authedQuery
    .input(z.object({ challengeId: z.number(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.insert(challengeMessages).values({
        challengeId: input.challengeId,
        senderId: ctx.user.id,
        senderName: ctx.user.name || "Jugador",
        content: input.content,
      });
      return { success: true };
    }),

  getMessages: authedQuery
    .input(z.object({ challengeId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(challengeMessages)
        .where(eq(challengeMessages.challengeId, input.challengeId))
        .orderBy(desc(challengeMessages.createdAt))
        .limit(50);
      return rows.reverse();
    }),
});
