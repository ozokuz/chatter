import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db/index.js";
import { message, user } from "./db/schema.js";
import type { ChatMessage, MessagePage } from "../../../packages/shared/chat.js";

export class ChatError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const publicPerson = { id: user.id, name: user.name, username: user.username };
const selection = {
  id: message.id,
  clientId: message.clientId,
  sender: publicPerson,
  content: message.content,
  createdAt: message.createdAt,
};

type Row = {
  id: string; clientId: string; sender: { id: string; name: string; username: string };
  content: string; createdAt: Date;
};

const serialize = (row: Row): ChatMessage => ({
  id: row.id, clientId: row.clientId, sender: row.sender,
  content: row.content, createdAt: row.createdAt.toISOString(),
});

export async function getMessages(before?: string): Promise<MessagePage> {
  let cursor;
  if (before) {
    if (!z.uuid().safeParse(before).success) throw new ChatError("Invalid message cursor.");
    [cursor] = await db.select({ id: message.id, createdAt: message.createdAt }).from(message)
      .where(eq(message.id, before)).limit(1);
    if (!cursor) throw new ChatError("Message cursor not found.", 404);
  }
  const rows = await db.select(selection).from(message).innerJoin(user, eq(user.id, message.senderId))
    .where(cursor ? or(
      lt(message.createdAt, cursor.createdAt),
      and(eq(message.createdAt, cursor.createdAt), lt(message.id, cursor.id)),
    ) : undefined)
    .orderBy(desc(message.createdAt), desc(message.id)).limit(51);
  const page = rows.slice(0, 50);
  const nextCursor = rows.length > 50 ? page.at(-1)!.id : null;
  return { messages: page.reverse().map(serialize), nextCursor };
}

const sendSchema = z.strictObject({
  clientId: z.uuid(),
  content: z.string().trim().min(1, "Write a message.").max(4000),
});

export async function sendMessage(senderId: string, input: unknown): Promise<ChatMessage> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) throw new ChatError(parsed.error.issues[0]?.message ?? "Invalid message.");
  const data = parsed.data;
  // Retrying an unacknowledged send reuses clientId and cannot create duplicates.
  const [inserted] = await db.insert(message).values({ ...data, senderId })
    .onConflictDoNothing({ target: [message.senderId, message.clientId] }).returning({ id: message.id });
  const [row] = await db.select(selection).from(message).innerJoin(user, eq(user.id, message.senderId))
    .where(inserted ? eq(message.id, inserted.id) : and(eq(message.senderId, senderId), eq(message.clientId, data.clientId)))
    .limit(1);
  if (!row) throw new Error("Message could not be loaded after saving.");
  return serialize(row);
}

export async function getPeople() {
  return db.select(publicPerson).from(user).orderBy(sql`lower(${user.username})`);
}
