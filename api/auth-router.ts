import { createRouter, publicQuery } from "./middleware";

export const authRouter = createRouter({
  me: publicQuery.query(async ({ ctx }) => {
    return ctx.user;
  }),
});
