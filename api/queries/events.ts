import { eq, and, gte, lte } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import type { InsertEvent } from "@db/schema";

export async function findAllEvents(opts?: { active?: boolean; current?: boolean }) {
  const db = getDb();
  const conditions = [];
  if (opts?.active !== undefined) {
    conditions.push(eq(schema.events.isActive, opts.active));
  }
  if (opts?.current) {
    const now = new Date();
    conditions.push(
      and(
        lte(schema.events.startDate, now),
        gte(schema.events.endDate, now)
      )
    );
  }
  if (conditions.length > 0) {
    return db.select().from(schema.events).where(and(...conditions));
  }
  return db.select().from(schema.events);
}

export async function findEventById(id: number) {
  const db = getDb();
  const rows = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1);
  return rows.at(0);
}

export async function createEvent(data: InsertEvent) {
  const db = getDb();
  const result = await db.insert(schema.events).values(data).returning({ id: schema.events.id });
  return result[0]?.id;
}

export async function updateEvent(id: number, data: Partial<InsertEvent>) {
  const db = getDb();
  await db.update(schema.events).set(data).where(eq(schema.events.id, id));
}

export async function deleteEvent(id: number) {
  const db = getDb();
  await db.delete(schema.events).where(eq(schema.events.id, id));
}
