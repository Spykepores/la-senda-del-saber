import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import {
  findAllSeasons,
  findSeasonById,
  createSeason,
  updateSeason,
  deleteSeason,
} from "./queries/seasons";

export const seasonsRouter = createRouter({
  list: publicQuery
    .input(z.object({ active: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      return findAllSeasons(input ?? {});
    }),

  byId: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return findSeasonById(input.id);
    }),

  create: adminQuery
    .input(
      z.object({
        bookName: z.string().min(1),
        bookDisplay: z.string().min(1),
        weeks: z.number().min(1),
        description: z.string().optional(),
        color: z.string().optional(),
        isActive: z.boolean().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createSeason(input);
      return { id, success: true };
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        bookName: z.string().optional(),
        bookDisplay: z.string().optional(),
        weeks: z.number().optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        isActive: z.boolean().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateSeason(id, data);
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteSeason(input.id);
      return { success: true };
    }),
});
