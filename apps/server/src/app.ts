import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { createServer } from "node:http";
import cors from "cors";
import helmet from "helmet";
import { and, gt, inArray } from "drizzle-orm";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { Server } from "socket.io";
import { z } from "zod";
import { auth, type AuthSession } from "./auth.js";
import { config, allowedOrigins } from "./config.js";
import { db } from "./db/index.js";
import { session } from "./db/schema.js";
import { ChatError, getMessages, getPeople, sendMessage } from "./chat.js";
import type { ChatMessage, ClientEvents, ServerEvents } from "../../../packages/shared/chat.js";

export function createApp() {
  const app = express();
  const http = createServer(app);
  const io = new Server<ClientEvents, ServerEvents, Record<string, never>, { auth: AuthSession }> (http, {
    cors: { origin: allowedOrigins, credentials: true },
    maxHttpBufferSize: 32_768,
    allowRequest: (req, callback) => callback(null, !req.headers.origin || allowedOrigins.includes(req.headers.origin)),
  });

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxyHops);
  // Better Auth's Node adapter only sees headers. Overwrite its private IP
  // header with Express's address after applying the configured proxy trust.
  app.use((req, _res, next) => {
    req.headers["x-chatter-client-ip"] = req.ip ?? req.socket.remoteAddress ?? "unknown";
    next();
  });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use((req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin && !allowedOrigins.includes(req.headers.origin)) {
      res.status(403).json({ error: "Untrusted request origin." });
      return;
    }
    next();
  });
  // Better Auth must receive the request stream before any JSON body parser.
  app.all("/api/auth/*splat", toNodeHandler(auth));
  app.use(express.json({ limit: "16kb" }));

  const requireAuth: RequestHandler = async (req, res, next) => {
    const current = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!current) { res.status(401).json({ error: "Sign in to continue." }); return; }
    res.locals.auth = current;
    res.setHeader("Cache-Control", "no-store");
    next();
  };
  app.use("/api", requireAuth);
  app.get("/api/users", async (_req, res) => { res.json({ users: await getPeople() }); });
  app.get("/api/messages", async (req, res) => {
    const query = z.strictObject({ before: z.uuid().optional() }).safeParse(req.query);
    if (!query.success) throw new ChatError("Invalid message query.");
    res.json(await getMessages(query.data.before));
  });

  app.use("/api", (_req, res) => { res.status(404).json({ error: "Endpoint not found." }); });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ChatError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof SyntaxError) { res.status(400).json({ error: "Invalid request body." }); return; }
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  };
  app.use(errorHandler);

  io.use(async (socket, next) => {
    try {
      const current = await auth.api.getSession({ headers: fromNodeHeaders(socket.request.headers) });
      if (!current) { next(new Error("Sign in to connect.")); return; }
      socket.data.auth = current;
      next();
    } catch { next(new Error("Unable to authenticate connection.")); }
  });

  // Check persisted sessions before delivery as well as before sending. Signing out
  // or expiring a cookie must stop a still-open socket from receiving messages.
  async function activeSockets() {
    const sockets = [...io.sockets.sockets.values()];
    if (!sockets.length) return [];
    const rows = await db.select({ id: session.id }).from(session).where(and(
      inArray(session.id, sockets.map((s) => s.data.auth.session.id)), gt(session.expiresAt, new Date()),
    ));
    const valid = new Set(rows.map((row) => row.id));
    return sockets.filter((socket) => {
      if (valid.has(socket.data.auth.session.id)) return true;
      socket.disconnect(true);
      return false;
    });
  }

  async function presence() {
    const sockets = await activeSockets();
    const ids = [...new Set(sockets.map((s) => s.data.auth.user.id))];
    for (const socket of sockets) socket.emit("presence:update", ids);
  }

  async function deliver(saved: ChatMessage) {
    const sockets = await activeSockets();
    for (const socket of sockets) socket.emit("message:new", saved);
  }

  io.on("connection", (socket) => {
    void presence().catch(console.error);
    socket.on("message:send", async (payload, callback) => {
      if (typeof callback !== "function") return;
      try {
        const current = await auth.api.getSession({ headers: fromNodeHeaders(socket.request.headers) });
        if (!current) { callback({ ok: false, error: "Your session expired. Please sign in again." }); socket.disconnect(true); return; }
        const saved = await sendMessage(current.user.id, payload);
        await deliver(saved);
        callback({ ok: true, message: saved });
      } catch (error) {
        if (!(error instanceof ChatError)) console.error(error);
        callback({ ok: false, error: error instanceof ChatError ? error.message : "Message could not be sent. Please retry." });
      }
    });
    socket.on("disconnect", () => { void presence().catch(console.error); });
  });
  const sweep = setInterval(() => { void presence().catch(console.error); }, 30_000);
  sweep.unref();
  http.on("close", () => clearInterval(sweep));

  return { app, http, io };
}
