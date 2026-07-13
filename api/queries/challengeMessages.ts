import { eq, desc } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import type { InsertChallengeMessage } from "@db/schema";

export async function findMessagesByChallenge(challengeId: number) {
  const db = getDb();
  return db
    .select()
    .from(schema.challengeMessages)
    .where(eq(schema.challengeMessages.challengeId, challengeId))
    .orderBy(desc(schema.challengeMessages.createdAt));
}

export async function createMessage(data: InsertChallengeMessage) {
  const db = getDb();
  const result = await db.insert(schema.challengeMessages).values(data).returning({ id: schema.challengeMessages.id });
  return result[0]?.id;
}

export async function deleteMessagesForChallenge(challengeId: number) {
  const db = getDb();
  await db.delete(schema.challengeMessages).where(eq(schema.challengeMessages.challengeId, challengeId));
}
