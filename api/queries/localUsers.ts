import { eq, or } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertLocalUser } from "@db/schema";
import { getDb } from "./connection";

export async function findLocalUserById(id: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.localUsers)
    .where(eq(schema.localUsers.id, id))
    .limit(1);
  return rows.at(0);
}

export async function findLocalUserByEmail(email: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.localUsers)
    .where(eq(schema.localUsers.email, email))
    .limit(1);
  return rows.at(0);
}

export async function findLocalUserByPhone(phone: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.localUsers)
    .where(eq(schema.localUsers.phone, phone))
    .limit(1);
  return rows.at(0);
}

export async function findLocalUserByEmailOrPhone(email?: string, phone?: string) {
  const db = getDb();
  const conditions = [];
  if (email) conditions.push(eq(schema.localUsers.email, email));
  if (phone) conditions.push(eq(schema.localUsers.phone, phone));
  if (conditions.length === 0) return undefined;

  const rows = await db
    .select()
    .from(schema.localUsers)
    .where(or(...conditions))
    .limit(1);
  return rows.at(0);
}

export async function createLocalUser(data: InsertLocalUser) {
  const db = getDb();
  const result = await db.insert(schema.localUsers).values(data).returning({ id: schema.localUsers.id });
  if (result[0]?.id) return findLocalUserById(result[0].id);
  return undefined;
}

export async function updateLocalUserLastSignIn(id: number) {
  const db = getDb();
  await db
    .update(schema.localUsers)
    .set({ lastSignInAt: new Date() })
    .where(eq(schema.localUsers.id, id));
}
