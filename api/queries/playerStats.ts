import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import type { InsertPlayerStat } from "@db/schema";

export async function findPlayerStatsByUserId(userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.playerStats)
    .where(eq(schema.playerStats.userId, userId))
    .limit(1);
  return rows.at(0);
}

export async function findAllPlayerStats() {
  const db = getDb();
  return db.select().from(schema.playerStats).orderBy(schema.playerStats.totalXP);
}

export async function createOrUpdatePlayerStats(userId: number, data: Partial<InsertPlayerStat>) {
  const db = getDb();
  const existing = await findPlayerStatsByUserId(userId);
  if (existing) {
    await db
      .update(schema.playerStats)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.playerStats.userId, userId));
    return findPlayerStatsByUserId(userId);
  }
  await db.insert(schema.playerStats).values({
    userId,
    ...data,
  } as InsertPlayerStat);
  return findPlayerStatsByUserId(userId);
}

export async function incrementPlayerStats(
  userId: number,
  updates: {
    totalXP?: number;
    wins?: number;
    losses?: number;
    correctAnswers?: number;
    wrongAnswers?: number;
    sealsBroken?: number;
    challengesWon?: number;
    challengesLost?: number;
  }
) {
  const db = getDb();
  const existing = await findPlayerStatsByUserId(userId);
  if (!existing) {
    await db.insert(schema.playerStats).values({
      userId,
      totalXP: updates.totalXP ?? 0,
      wins: updates.wins ?? 0,
      losses: updates.losses ?? 0,
      correctAnswers: updates.correctAnswers ?? 0,
      wrongAnswers: updates.wrongAnswers ?? 0,
      sealsBroken: updates.sealsBroken ?? 0,
      challengesWon: updates.challengesWon ?? 0,
      challengesLost: updates.challengesLost ?? 0,
    });
    return findPlayerStatsByUserId(userId);
  }

  const setData: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) {
      const currentVal = (existing as unknown as Record<string, number | null>)[key] ?? 0;
      setData[key] = (currentVal as number) + val;
    }
  }

  await db
    .update(schema.playerStats)
    .set(setData)
    .where(eq(schema.playerStats.userId, userId));
  return findPlayerStatsByUserId(userId);
}
