import "dotenv/config";

if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
  throw new Error("Set BETTER_AUTH_SECRET to a private random value of at least 32 characters.");
}

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer.");
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  authURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  origin: process.env.APP_ORIGIN ?? "http://localhost:5173",
  secret: process.env.BETTER_AUTH_SECRET,
  trustProxyHops,
};

export const allowedOrigins = [...new Set([new URL(config.authURL).origin, new URL(config.origin).origin])];
