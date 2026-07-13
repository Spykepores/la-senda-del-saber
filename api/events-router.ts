import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import {
  findAllEvents,
  findEventById,
  createEvent,
  updateEvent,
  deleteEvent,
} from "./queries/events";

export const eventsRouter = createRouter({
  list: publicQuery
    .input(z.object({ active: z.boolean().optional(), current: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      return findAllEvents(input ?? {});
    }),

  byId: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return findEventById(input.id);
    }),

  create: adminQuery
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        type: z.enum(["duel", "tournament", "special", "daily"]),
        startDate: z.date(),
        endDate: z.date(),
        reward: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createEvent(input);
      return { id, success: true };
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        type: z.enum(["duel", "tournament", "special", "daily"]).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        reward: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateEvent(id, data);
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteEvent(input.id);
      return { success: true };
    }),
});
