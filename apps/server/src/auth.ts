import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins/username";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { config, allowedOrigins } from "./config.js";

export const auth = betterAuth({
  appName: "Chatter",
  baseURL: config.authURL,
  secret: config.secret,
  trustedOrigins: allowedOrigins,
  advanced: { ipAddress: { ipAddressHeaders: ["x-chatter-client-ip"] } },
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: { cookieCache: { enabled: false } },
  databaseHooks: {
    user: {
      create: {
        before: async (data) => {
          if (!("username" in data) || typeof data.username !== "string" || !/^[a-zA-Z0-9_]{3,24}$/.test(data.username)) {
            throw new APIError("BAD_REQUEST", { message: "Choose a username with 3–24 letters, numbers, or underscores." });
          }
          return { data };
        },
      },
    },
  },
  plugins: [username({
    minUsernameLength: 3,
    maxUsernameLength: 24,
    usernameValidator: (value) => /^[a-zA-Z0-9_]+$/.test(value),
  })],
});

export type AuthSession = typeof auth.$Infer.Session;
