import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import {
  findPlayerStatsByUserId,
  createOrUpdatePlayerStats,
  incrementPlayerStats,
} from "./queries/playerStats";

export const playerStatsRouter = createRouter({
  mine: authedQuery.query(async ({ ctx }) => {
    return findPlayerStatsByUserId(ctx.user.id);
  }),

  update: authedQuery
    .input(
      z.object({
        totalXP: z.number().optional(),
        seasonXP: z.number().optional(),
        wins: z.number().optional(),
        losses: z.number().optional(),
        correctAnswers: z.number().optional(),
        wrongAnswers: z.number().optional(),
        maxStreak: z.number().optional(),
        sealsBroken: z.number().optional(),
        challengesWon: z.number().optional(),
        challengesLost: z.number().optional(),
        rankName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createOrUpdatePlayerStats(ctx.user.id, input);
    }),

  increment: authedQuery
    .input(
      z.object({
        totalXP: z.number().optional(),
        wins: z.number().optional(),
        losses: z.number().optional(),
        correctAnswers: z.number().optional(),
        wrongAnswers: z.number().optional(),
        sealsBroken: z.number().optional(),
        challengesWon: z.number().optional(),
        challengesLost: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return incrementPlayerStats(ctx.user.id, input);
    }),
});
