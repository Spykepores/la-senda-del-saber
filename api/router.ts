import { authRouter } from "./auth-router";
import { questionsRouter } from "./questions-router";
import { seasonsRouter } from "./seasons-router";
import { messagesRouter } from "./messages-router";
import { playerStatsRouter } from "./player-stats-router";
import { eventsRouter } from "./events-router";
import { adminRouter } from "./admin-router";
import { localAuthRouter } from "./local-auth-router";
import { duelRouter } from "./challenge-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  questions: questionsRouter,
  seasons: seasonsRouter,
  messages: messagesRouter,
  playerStats: playerStatsRouter,
  events: eventsRouter,
  admin: adminRouter,
  localAuth: localAuthRouter,
  duel: duelRouter,
});

export type AppRouter = typeof appRouter;
