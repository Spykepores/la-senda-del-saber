import { createRouter } from "./middleware";
import { duelRouter } from "./challenge-router";
import { challengesRouter } from "./challenges-router";
import { questionsRouter } from "./questions-router";
import { seasonsRouter } from "./seasons-router";
import { eventsRouter } from "./events-router";
import { playerStatsRouter } from "./player-stats-router";
import { messagesRouter } from "./messages-router";
import { localAuthRouter } from "./local-auth-router";
import { adminRouter } from "./admin-router";

export const appRouter = createRouter({
  duel: duelRouter,
  challenges: challengesRouter,
  questions: questionsRouter,
  seasons: seasonsRouter,
  events: eventsRouter,
  playerStats: playerStatsRouter,
  messages: messagesRouter,
  localAuth: localAuthRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
