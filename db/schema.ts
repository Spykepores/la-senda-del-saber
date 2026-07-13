import {
  pgTable,
  pgEnum,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  uniqueIndex,
  serial,
} from "drizzle-orm/pg-core";

// ==========================================
// ENUMS
// ==========================================
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const categoryEnum = pgEnum("category", ["genealogy", "parables", "stories", "prophecy", "doctrine", "characters", "books"]);
export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);
export const challengeStatusEnum = pgEnum("challenge_status", ["pending", "active", "completed", "cancelled"]);
export const eventTypeEnum = pgEnum("event_type", ["duel", "tournament", "special", "daily"]);

// ==========================================
// USERS (provided by auth system)
// ==========================================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==========================================
// QUESTIONS - Preguntas biblicas gestionadas por admin
// ==========================================
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  category: categoryEnum("category").notNull(),
  difficulty: difficultyEnum("difficulty").notNull(),
  question: text("question").notNull(),
  option1: varchar("option1", { length: 255 }).notNull(),
  option2: varchar("option2", { length: 255 }).notNull(),
  option3: varchar("option3", { length: 255 }).notNull(),
  option4: varchar("option4", { length: 255 }).notNull(),
  correctAnswer: integer("correctAnswer").notNull(), // 0-3
  explanation: text("explanation"),
  seasonId: integer("seasonId"), // which season/book this belongs to
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

// ==========================================
// SEASONS - Temporadas por libros biblicos
// ==========================================
export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  bookName: varchar("bookName", { length: 100 }).notNull(),
  bookDisplay: varchar("bookDisplay", { length: 100 }).notNull(),
  weeks: integer("weeks").notNull(),
  description: text("description"),
  color: varchar("color", { length: 20 }).default("#4F46E5"),
  isActive: boolean("isActive").default(false).notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Season = typeof seasons.$inferSelect;
export type InsertSeason = typeof seasons.$inferInsert;

// ==========================================
// CHALLENGES - Desafios entre jugadores
// ==========================================
export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  challengerId: bigint("challengerId", { mode: "number" }).notNull(),
  opponentId: bigint("opponentId", { mode: "number" }).notNull(),
  status: challengeStatusEnum("status").default("pending").notNull(),
  winnerId: bigint("winnerId", { mode: "number" }),
  challengerScore: integer("challengerScore").default(0).notNull(),
  opponentScore: integer("opponentScore").default(0).notNull(),
  currentRound: integer("currentRound").default(1).notNull(),
  challengerStreak: integer("challengerStreak").default(0).notNull(),
  opponentStreak: integer("opponentStreak").default(0).notNull(),
  challengerSeals: text("challengerSeals"), // JSON: {categoryId: correctCount}
  opponentSeals: text("opponentSeals"),
  currentCategory: varchar("currentCategory", { length: 50 }),
  currentQuestionId: bigint("currentQuestionId", { mode: "number" }),
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Challenge = typeof challenges.$inferSelect;
export type InsertChallenge = typeof challenges.$inferInsert;

// ==========================================
// CHALLENGE_MESSAGES - Chat interno en desafios
// ==========================================
export const challengeMessages = pgTable("challenge_messages", {
  id: serial("id").primaryKey(),
  challengeId: bigint("challengeId", { mode: "number" }).notNull(),
  senderId: bigint("senderId", { mode: "number" }).notNull(),
  senderName: varchar("senderName", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChallengeMessage = typeof challengeMessages.$inferSelect;
export type InsertChallengeMessage = typeof challengeMessages.$inferInsert;

// ==========================================
// PLAYER_STATS - Estadisticas de jugadores
// ==========================================
export const playerStats = pgTable("player_stats", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number" }).notNull().unique(),
  totalXP: integer("totalXP").default(0).notNull(),
  seasonXP: integer("seasonXP").default(0).notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  correctAnswers: integer("correctAnswers").default(0).notNull(),
  wrongAnswers: integer("wrongAnswers").default(0).notNull(),
  maxStreak: integer("maxStreak").default(0).notNull(),
  sealsBroken: integer("sealsBroken").default(0).notNull(),
  challengesWon: integer("challengesWon").default(0).notNull(),
  challengesLost: integer("challengesLost").default(0).notNull(),
  seasonsCompleted: text("seasonsCompleted"), // JSON array of season IDs
  galleryUnlocked: text("galleryUnlocked"), // JSON array of item IDs
  rankName: varchar("rankName", { length: 50 }).default("Siervo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type PlayerStat = typeof playerStats.$inferSelect;
export type InsertPlayerStat = typeof playerStats.$inferInsert;

// ==========================================
// EVENTS - Eventos programados por admin
// ==========================================
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: eventTypeEnum("type").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  reward: text("reward"), // JSON: {xp, item, title}
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: bigint("createdBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

// ==========================================
// LOCAL USERS - Registro con email o telefono
// ==========================================
export const localUsers = pgTable("local_users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  avatar: text("avatar"),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("email_idx").on(table.email),
  uniqueIndex("phone_idx").on(table.phone),
]);

export type LocalUser = typeof localUsers.$inferSelect;
export type InsertLocalUser = typeof localUsers.$inferInsert;
