import {
  pgTable, text, timestamp, boolean, uuid, index, uniqueIndex,
} from "drizzle-orm/pg-core";

const date = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  username: text("username").notNull().unique(),
  displayUsername: text("display_username"),
  createdAt: date("created_at").notNull().defaultNow(),
  updatedAt: date("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: date("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: date("created_at").notNull().defaultNow(),
  updatedAt: date("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (t) => [index("session_user_idx").on(t.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: date("access_token_expires_at"),
  refreshTokenExpiresAt: date("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: date("created_at").notNull().defaultNow(),
  updatedAt: date("updated_at").notNull().defaultNow(),
}, (t) => [index("account_user_idx").on(t.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: date("expires_at").notNull(),
  createdAt: date("created_at").notNull().defaultNow(),
  updatedAt: date("updated_at").notNull().defaultNow(),
}, (t) => [index("verification_identifier_idx").on(t.identifier)]);

export const message = pgTable("message", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: text("sender_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  clientId: uuid("client_id").notNull(),
  createdAt: date("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("message_sender_client_idx").on(t.senderId, t.clientId),
  index("message_time_idx").on(t.createdAt, t.id),
  index("message_sender_time_idx").on(t.senderId, t.createdAt, t.id),
]);
