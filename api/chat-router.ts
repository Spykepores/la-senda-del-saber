import { z } from "zod";
import { eq, and, desc, or } from "drizzle-orm";
import { chatRooms, chatMessages } from "../db/schema";
import { getDb } from "./queries/connection";
import { authedQuery, createRouter } from "./middleware";
import { TRPCError } from "@trpc/server";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

async function ensureUniqueSlug(db: ReturnType<typeof getDb>, name: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30);
  let slug = base;
  for (let i = 0; i < 10; i++) {
    const existing = await db.select().from(chatRooms).where(eq(chatRooms.slug, slug)).limit(1);
    if (existing.length === 0) return slug;
    slug = `${base}-${Math.floor(Math.random() * 1000)}`;
  }
  return `${base}-${Date.now()}`;
}

export const chatRouter = createRouter({
  // ---- LIST PUBLIC ROOMS ----
  listRooms: authedQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(chatRooms)
      .where(eq(chatRooms.isPrivate, false))
      .orderBy(desc(chatRooms.createdAt));
    return rows;
  }),

  // ---- GET ROOM BY SLUG ----
  getRoom: authedQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [room] = await db.select().from(chatRooms).where(eq(chatRooms.slug, input.slug)).limit(1);
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Sala no encontrada" });
      return room;
    }),

  // ---- JOIN ROOM BY INVITE CODE ----
  joinByCode: authedQuery
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [room] = await db
        .select()
        .from(chatRooms)
        .where(and(eq(chatRooms.isPrivate, true), eq(chatRooms.inviteCode, input.code.toUpperCase())))
        .limit(1);
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Codigo invalido" });
      return room;
    }),

  // ---- CREATE ROOM ----
  createRoom: authedQuery
    .input(z.object({ name: z.string().min(1).max(100), isPrivate: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const slug = await ensureUniqueSlug(db, input.name);
      const isPrivate = input.isPrivate || false;
      const values: any = {
        name: input.name,
        slug,
        isPrivate,
        createdBy: ctx.user.id,
      };
      if (isPrivate) {
        values.inviteCode = generateInviteCode();
      }
      const [room] = await db.insert(chatRooms).values(values).returning();
      return room;
    }),

  // ---- GET MESSAGES FROM ROOM ----
  getMessages: authedQuery
    .input(z.object({ roomSlug: z.string(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input.limit || 50;
      const rows = await db
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.roomSlug, input.roomSlug), eq(chatMessages.isPrivate, false)))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit);
      return rows.reverse();
    }),

  // ---- GET PRIVATE MESSAGES BETWEEN TWO USERS ----
  getPrivateMessages: authedQuery
    .input(z.object({ otherUserId: z.number(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const limit = input.limit || 50;
      const rows = await db
        .select()
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.isPrivate, true),
            or(
              and(eq(chatMessages.senderId, ctx.user.id), eq(chatMessages.recipientId, input.otherUserId)),
              and(eq(chatMessages.senderId, input.otherUserId), eq(chatMessages.recipientId, ctx.user.id))
            )
          )
        )
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit);
      return rows.reverse();
    }),

  // ---- SEND MESSAGE ----
  sendMessage: authedQuery
    .input(
      z.object({
        roomSlug: z.string(),
        content: z.string().min(1).max(2000),
        isPrivate: z.boolean().optional(),
        recipientId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [msg] = await db
        .insert(chatMessages)
        .values({
          roomSlug: input.roomSlug,
          senderId: ctx.user.id,
          senderName: ctx.user.name || "Anonimo",
          content: input.content,
          isPrivate: input.isPrivate || false,
          recipientId: input.recipientId || null,
        })
        .returning();
      return msg;
    }),

  // ---- GET RECENT PRIVATE CONVERSATIONS ----
  getConversations: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const allPrivate = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.isPrivate, true),
          or(
            eq(chatMessages.senderId, ctx.user.id),
            eq(chatMessages.recipientId, ctx.user.id)
          )
        )
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(200);

    const seen = new Set<number>();
    const conversations: { userId: number; userName: string; lastMessage: string; lastAt: Date }[] = [];

    for (const msg of allPrivate) {
      const otherId = msg.senderId === ctx.user.id ? (msg.recipientId || 0) : msg.senderId;
      if (otherId === 0 || seen.has(otherId)) continue;
      seen.add(otherId);
      conversations.push({
        userId: otherId,
        userName: msg.senderId === ctx.user.id ? (msg.recipientId ? `Usuario ${msg.recipientId}` : "") : msg.senderName,
        lastMessage: msg.content,
        lastAt: msg.createdAt,
      });
    }

    return conversations;
  }),
});
