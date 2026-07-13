import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import {
  findAllChallenges,
  findChallengeById,
  createChallenge,
  updateChallenge,
  findPendingChallengesForUser,
  findActiveChallengesForUser,
} from "./queries/challenges";

export const challengesRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        userId: z.number().optional(),
        status: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = input?.userId ?? ctx.user.id;
      return findAllChallenges({ userId, status: input?.status });
    }),

  byId: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return findChallengeById(input.id);
    }),

  pending: authedQuery.query(async ({ ctx }) => {
    return findPendingChallengesForUser(ctx.user.id);
  }),

  active: authedQuery.query(async ({ ctx }) => {
    return findActiveChallengesForUser(ctx.user.id);
  }),

  create: authedQuery
    .input(
      z.object({
        opponentId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const challenge = await createChallenge({
        challengerId: ctx.user.id,
        opponentId: input.opponentId,
        status: "pending",
        challengerScore: 0,
        opponentScore: 0,
        currentRound: 1,
        challengerStreak: 0,
        opponentStreak: 0,
        challengerSeals: JSON.stringify({}),
        opponentSeals: JSON.stringify({}),
      });
      return challenge;
    }),

  accept: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const challenge = await findChallengeById(input.id);
      if (!challenge) throw new Error("Challenge not found");
      if (challenge.opponentId !== ctx.user.id) throw new Error("Not authorized");
      if (challenge.status !== "pending") throw new Error("Challenge not pending");

      return updateChallenge(input.id, {
        status: "active",
        startedAt: new Date(),
      });
    }),

  decline: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const challenge = await findChallengeById(input.id);
      if (!challenge) throw new Error("Challenge not found");
      if (challenge.opponentId !== ctx.user.id) throw new Error("Not authorized");

      return updateChallenge(input.id, { status: "cancelled" });
    }),

  submitAnswer: authedQuery
    .input(
      z.object({
        id: z.number(),
        isCorrect: z.boolean(),
        category: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const challenge = await findChallengeById(input.id);
      if (!challenge) throw new Error("Challenge not found");
      if (challenge.status !== "active") throw new Error("Challenge not active");

      const isChallenger = challenge.challengerId === ctx.user.id;
      const isOpponent = challenge.opponentId === ctx.user.id;
      if (!isChallenger && !isOpponent) throw new Error("Not a participant");

      const sealsKey = isChallenger ? "challengerSeals" : "opponentSeals";
      const streakKey = isChallenger ? "challengerStreak" : "opponentStreak";
      const scoreKey = isChallenger ? "challengerScore" : "opponentScore";

      const seals = JSON.parse(challenge[sealsKey] || "{}");
      const currentCorrect = (seals[input.category] || 0) as number;

      const updateData: Record<string, unknown> = {};

      if (input.isCorrect) {
        const newCorrect = currentCorrect + 1;
        seals[input.category] = newCorrect;
        updateData[sealsKey] = JSON.stringify(seals);
        updateData[streakKey] = (challenge[streakKey] || 0) + 1;
        updateData[scoreKey] = (challenge[scoreKey] || 0) + 100;
      } else {
        updateData[streakKey] = 0;
      }

      // Check if all seals are broken (7 categories, 2 correct each)
      const allCategories = ["genealogy", "parables", "stories", "prophecy", "doctrine", "characters", "books"];
      const updatedSeals = JSON.parse((updateData[sealsKey] as string) ?? challenge[sealsKey] ?? "{}") as Record<string, number>;
      const allBroken = allCategories.every((cat) => (updatedSeals[cat] || 0) >= 2);

      if (allBroken) {
        updateData.status = "completed";
        updateData.winnerId = ctx.user.id;
        updateData.endedAt = new Date();
      }

      return updateChallenge(input.id, updateData);
    }),
});
