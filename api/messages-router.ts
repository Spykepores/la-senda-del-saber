import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import {
  findMessagesByChallenge,
  createMessage,
} from "./queries/challengeMessages";

export const messagesRouter = createRouter({
  list: authedQuery
    .input(z.object({ challengeId: z.number() }))
    .query(async ({ input }) => {
      return findMessagesByChallenge(input.challengeId);
    }),

  create: authedQuery
    .input(
      z.object({
        challengeId: z.number(),
        content: z.string().min(1),
        senderName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createMessage({
        challengeId: input.challengeId,
        senderId: ctx.user.id,
        senderName: input.senderName,
        content: input.content,
      });
      return { id, success: true };
    }),
});
