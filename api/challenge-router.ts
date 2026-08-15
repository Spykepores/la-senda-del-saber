import { z } from "zod";
import { eq, desc, inArray } from "drizzle-orm";
import { challenges, users, localUsers, questions, userProgress } from "../db/schema";
import { getDb } from "./queries/connection";
import { authedQuery, createRouter } from "./middleware";
import { TRPCError } from "@trpc/server";
import { processGameAction, type GameAction, type GameStateDTO, emptyState } from "./lib/duel-engine";

const db = getDb();

// Generate a 6-char room code
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

// Get a user name from users or localUsers table
export async function getUserName(userId: number): Promise<string> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (u) return u.name || `Usuario #${userId}`;
  const [lu] = await db.select().from(localUsers).where(eq(localUsers.id, userId)).limit(1);
  if (lu) return lu.name || `Usuario #${userId}`;
  return `Usuario #${userId}`;
}

export const duelRouter = createRouter({
  create: authedQuery
    .input(z.object({ opponentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [challenge] = await db
        .insert(challenges)
        .values({
          challengerId: ctx.user.id,
          opponentId: input.opponentId,
          status: "pending",
          gameState: emptyState(ctx.user.id, input.opponentId),
          roomCode: generateRoomCode(),
        })
        .returning();
      return challenge;
    }),

  list: authedQuery.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(challenges)
      .where(
        eq(challenges.challengerId, ctx.user.id),
      )
      .orderBy(desc(challenges.createdAt));

    // Also get challenges where user is opponent
    const opponentRows = await db
      .select()
      .from(challenges)
      .where(eq(challenges.opponentId, ctx.user.id))
      .orderBy(desc(challenges.createdAt));

    const all = [...rows, ...opponentRows].filter(
      (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i
    );

    // Enrich with names
    const result = await Promise.all(
      all.map(async (c) => ({
        ...c,
        challengerName: await getUserName(c.challengerId),
        opponentName: await getUserName(c.opponentId),
      }))
    );

    return result;
  }),

  get: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const [challenge] = await db.select().from(challenges).where(eq(challenges.id, input.id)).limit(1);
      if (!challenge) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        ...challenge,
        challengerName: await getUserName(challenge.challengerId),
        opponentName: await getUserName(challenge.opponentId),
      };
    }),

  getByRoomCode: authedQuery
    .input(z.object({ roomCode: z.string() }))
    .query(async ({ input }) => {
      const [challenge] = await db.select().from(challenges).where(eq(challenges.roomCode, input.roomCode.toUpperCase())).limit(1);
      if (!challenge) throw new TRPCError({ code: "NOT_FOUND", message: "Codigo invalido" });
      return challenge;
    }),

  accept: authedQuery
    .input(z.object({ challengeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(challenges)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(challenges.id, input.challengeId));
      return { success: true };
    }),

  reject: authedQuery
    .input(z.object({ challengeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(challenges)
        .set({ status: "rejected" })
        .where(eq(challenges.id, input.challengeId));
      return { success: true };
    }),

  forfeit: authedQuery
    .input(z.object({ challengeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [c] = await db.select().from(challenges).where(eq(challenges.id, input.challengeId)).limit(1);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      const isChallenger = c.challengerId === ctx.user.id;
      await db
        .update(challenges)
        .set({
          status: "forfeited",
          winnerId: isChallenger ? c.opponentId : c.challengerId,
          forfeitBy: ctx.user.id,
        })
        .where(eq(challenges.id, input.challengeId));
      return { success: true };
    }),

  // ===== SERVER-AUTHORITATIVE GAME ACTIONS =====
  action: authedQuery
    .input(
      z.object({
        challengeId: z.number(),
        action: z.object({
          kind: z.enum(["roll_dice", "start_turn", "roulette_result", "submit_answer", "forfeit", "set_turn", "game_over"]),
          playerId: z.number().optional(),
          diceValue: z.number().optional(),
          category: z.string().optional(),
          questionId: z.number().optional(),
          selectedOption: z.number().optional(),
          correct: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [challenge] = await db.select().from(challenges).where(eq(challenges.id, input.challengeId)).limit(1);
      if (!challenge) throw new TRPCError({ code: "NOT_FOUND" });

      // Parse current state
      let state: GameStateDTO = challenge.gameState as GameStateDTO;
      if (!state || !state.challengerSeals) {
        state = emptyState(challenge.challengerId, challenge.opponentId);
      }

      // Process action through pure engine
      const result = processGameAction(state, input.action as GameAction, ctx.user.id);

      // Save new state
      await db
        .update(challenges)
        .set({ gameState: result.state, status: result.state.winner ? "completed" : challenge.status })
        .where(eq(challenges.id, input.challengeId));

      // Update winner if game over
      if (result.state.winner) {
        await db
          .update(challenges)
          .set({ winnerId: result.state.winner, status: "completed" })
          .where(eq(challenges.id, input.challengeId));
      }

      return { state: result.state, won: result.won || false };
    }),

  // ===== GET CURRENT QUESTION FOR A CATEGORY =====
  getCurrentQuestion: authedQuery
    .input(z.object({ category: z.string(), excludeIds: z.array(z.number()).optional() }))
    .query(async ({ input }) => {
      const cond = eq(questions.category, input.category);
      const all = await db.select().from(questions).where(cond);
      const available = input.excludeIds?.length
        ? all.filter((q) => !input.excludeIds!.includes(q.id))
        : all;
      if (available.length === 0) {
        // fallback: return any question from this category
        if (all.length > 0) return all[Math.floor(Math.random() * all.length)];
        throw new TRPCError({ code: "NOT_FOUND", message: "No hay preguntas" });
      }
      return available[Math.floor(Math.random() * available.length)];
    }),

  // ===== SUBMIT ANSWER (server-validated) =====
  submitAnswer: authedQuery
    .input(
      z.object({
        challengeId: z.number(),
        questionId: z.number(),
        selectedOption: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [question] = await db.select().from(questions).where(eq(questions.id, input.questionId)).limit(1);
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Pregunta no encontrada" });

      const correct = question.correctAnswer === input.selectedOption;

      // Update challenge state
      const [challenge] = await db.select().from(challenges).where(eq(challenges.id, input.challengeId)).limit(1);
      if (challenge) {
        let state: GameStateDTO = challenge.gameState as GameStateDTO;
        if (!state || !state.challengerSeals) {
          state = emptyState(challenge.challengerId, challenge.opponentId);
        }

        const action: GameAction = {
          kind: "submit_answer",
          playerId: ctx.user.id,
          questionId: input.questionId,
          selectedOption: input.selectedOption,
          correct,
        };

        const result = processGameAction(state, action, ctx.user.id);
        await db
          .update(challenges)
          .set({ gameState: result.state })
          .where(eq(challenges.id, input.challengeId));
      }

      return { correct, correctAnswer: question.correctAnswer };
    }),
});
