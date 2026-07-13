import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import type { InsertSeason } from "@db/schema";

export async function findAllSeasons(opts?: { active?: boolean }) {
  const db = getDb();
  if (opts?.active !== undefined) {
    return db.select().from(schema.seasons).where(eq(schema.seasons.isActive, opts.active));
  }
  return db.select().from(schema.seasons);
}

export async function findSeasonById(id: number) {
  const db = getDb();
  const rows = await db.select().from(schema.seasons).where(eq(schema.seasons.id, id)).limit(1);
  return rows.at(0);
}

export async function createSeason(data: InsertSeason) {
  const db = getDb();
  const result = await db.insert(schema.seasons).values(data).returning({ id: schema.seasons.id });
  return result[0]?.id;
}

export async function updateSeason(id: number, data: Partial<InsertSeason>) {
  const db = getDb();
  await db.update(schema.seasons).set(data).where(eq(schema.seasons.id, id));
}

export async function deleteSeason(id: number) {
  const db = getDb();
  await db.delete(schema.seasons).where(eq(schema.seasons.id, id));
}
