import { eq, and, or, desc } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import type { InsertChallenge } from "@db/schema";

export async function findAllChallenges(opts?: { userId?: number; status?: string }) {
  const db = getDb();
  const conditions = [];
  if (opts?.userId) {
    conditions.push(
      or(
        eq(schema.challenges.challengerId, opts.userId),
        eq(schema.challenges.opponentId, opts.userId)
      )
    );
  }
  if (opts?.status) {
    conditions.push(eq(schema.challenges.status, opts.status as any));
  }
  if (conditions.length > 0) {
    return db.select().from(schema.challenges).where(and(...conditions)).orderBy(desc(schema.challenges.createdAt));
  }
  return db.select().from(schema.challenges).orderBy(desc(schema.challenges.createdAt));
}

export async function findChallengeById(id: number) {
  const db = getDb();
  const rows = await db.select().from(schema.challenges).where(eq(schema.challenges.id, id)).limit(1);
  return rows.at(0);
}

export async function createChallenge(data: InsertChallenge) {
  const db = getDb();
  const result = await db.insert(schema.challenges).values(data).returning({ id: schema.challenges.id });
  if (result[0]?.id) return findChallengeById(result[0].id);
  return null;
}

export async function updateChallenge(id: number, data: Partial<InsertChallenge>) {
  const db = getDb();
  await db.update(schema.challenges).set(data).where(eq(schema.challenges.id, id));
  return findChallengeById(id);
}

export async function deleteChallenge(id: number) {
  const db = getDb();
  await db.delete(schema.challenges).where(eq(schema.challenges.id, id));
}

export async function findPendingChallengesForUser(userId: number) {
  const db = getDb();
  return db
    .select()
    .from(schema.challenges)
    .where(
      and(
        eq(schema.challenges.opponentId, userId),
        eq(schema.challenges.status, "pending")
      )
    )
    .orderBy(desc(schema.challenges.createdAt));
}

export async function findActiveChallengesForUser(userId: number) {
  const db = getDb();
  return db
    .select()
    .from(schema.challenges)
    .where(
      and(
        or(
          eq(schema.challenges.challengerId, userId),
          eq(schema.challenges.opponentId, userId)
        ),
        eq(schema.challenges.status, "active")
      )
    )
    .orderBy(desc(schema.challenges.createdAt));
}
