import { relations } from "drizzle-orm";
import { users, localUsers, questions, seasons, challenges, challengeMessages, playerStats, events } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  challengesSent: many(challenges, { relationName: "challenger" }),
  challengesReceived: many(challenges, { relationName: "opponent" }),
  messages: many(challengeMessages),
  stats: many(playerStats),
  events: many(events),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  season: one(seasons, {
    fields: [questions.seasonId],
    references: [seasons.id],
  }),
}));

export const seasonsRelations = relations(seasons, ({ many }) => ({
  questions: many(questions),
}));

export const challengesRelations = relations(challenges, ({ one, many }) => ({
  challenger: one(users, {
    fields: [challenges.challengerId],
    references: [users.id],
    relationName: "challenger",
  }),
  opponent: one(users, {
    fields: [challenges.opponentId],
    references: [users.id],
    relationName: "opponent",
  }),
  winner: one(users, {
    fields: [challenges.winnerId],
    references: [users.id],
    relationName: "winner",
  }),
  messages: many(challengeMessages),
}));

export const challengeMessagesRelations = relations(challengeMessages, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challengeMessages.challengeId],
    references: [challenges.id],
  }),
  sender: one(users, {
    fields: [challengeMessages.senderId],
    references: [users.id],
  }),
}));

export const playerStatsRelations = relations(playerStats, ({ one }) => ({
  user: one(users, {
    fields: [playerStats.userId],
    references: [users.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  creator: one(users, {
    fields: [events.createdBy],
    references: [users.id],
  }),
}));

export const localUsersRelations = relations(localUsers, () => ({}));
