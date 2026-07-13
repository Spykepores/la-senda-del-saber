import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import {
  findAllQuestions,
  findQuestionById,
  findRandomQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  countQuestions,
} from "./queries/questions";

export const questionsRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        active: z.boolean().optional(),
        category: z.string().optional(),
        seasonId: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return findAllQuestions(input ?? {});
    }),

  byId: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return findQuestionById(input.id);
    }),

  random: publicQuery
    .input(
      z.object({
        category: z.string().optional(),
        difficulty: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return findRandomQuestion(input?.category, input?.difficulty);
    }),

  count: publicQuery.query(async () => {
    return countQuestions();
  }),

  create: adminQuery
    .input(
      z.object({
        category: z.enum(["genealogy", "parables", "stories", "prophecy", "doctrine", "characters", "books"]),
        difficulty: z.enum(["easy", "medium", "hard"]),
        question: z.string().min(1),
        option1: z.string().min(1),
        option2: z.string().min(1),
        option3: z.string().min(1),
        option4: z.string().min(1),
        correctAnswer: z.number().min(0).max(3),
        explanation: z.string().optional(),
        seasonId: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createQuestion(input);
      return { id, success: true };
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        category: z.enum(["genealogy", "parables", "stories", "prophecy", "doctrine", "characters", "books"]).optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        question: z.string().optional(),
        option1: z.string().optional(),
        option2: z.string().optional(),
        option3: z.string().optional(),
        option4: z.string().optional(),
        correctAnswer: z.number().min(0).max(3).optional(),
        explanation: z.string().optional(),
        seasonId: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateQuestion(id, data);
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteQuestion(input.id);
      return { success: true };
    }),
});
