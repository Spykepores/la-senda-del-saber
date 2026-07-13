import { eq, and, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import type { InsertQuestion } from "@db/schema";

export async function findAllQuestions(opts?: { active?: boolean; category?: string; seasonId?: number }) {
  const db = getDb();
  const conditions = [];
  if (opts?.active !== undefined) {
    conditions.push(eq(schema.questions.isActive, opts.active));
  }
  if (opts?.category) {
    conditions.push(eq(schema.questions.category, opts.category as any));
  }
  if (opts?.seasonId) {
    conditions.push(eq(schema.questions.seasonId, opts.seasonId));
  }
  if (conditions.length > 0) {
    return db.select().from(schema.questions).where(and(...conditions));
  }
  return db.select().from(schema.questions);
}

export async function findQuestionById(id: number) {
  const db = getDb();
  const rows = await db.select().from(schema.questions).where(eq(schema.questions.id, id)).limit(1);
  return rows.at(0);
}

export async function findRandomQuestion(category?: string, difficulty?: string) {
  const db = getDb();
  const conditions = [eq(schema.questions.isActive, true)];
  if (category) {
    conditions.push(eq(schema.questions.category, category as any));
  }
  if (difficulty) {
    conditions.push(eq(schema.questions.difficulty, difficulty as any));
  }
  const rows = await db
    .select()
    .from(schema.questions)
    .where(and(...conditions))
    .orderBy(sql`RANDOM()`)
    .limit(1);
  return rows.at(0);
}

export async function createQuestion(data: InsertQuestion) {
  const db = getDb();
  const result = await db.insert(schema.questions).values(data).returning({ id: schema.questions.id });
  return result[0]?.id;
}

export async function updateQuestion(id: number, data: Partial<InsertQuestion>) {
  const db = getDb();
  await db.update(schema.questions).set(data).where(eq(schema.questions.id, id));
}

export async function deleteQuestion(id: number) {
  const db = getDb();
  await db.delete(schema.questions).where(eq(schema.questions.id, id));
}

export async function countQuestions() {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.questions);
  return rows[0]?.count ?? 0;
}
