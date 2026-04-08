import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./lib/env.js";
import { authRoutes } from "./routes/auth.js";
import { sourcesRoutes } from "./routes/sources.js";
import { digestsRoutes } from "./routes/digests.js";
import { settingsRoutes } from "./routes/settings.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { newsRoutes } from "./routes/news.js";
import { adminRoutes } from "./routes/admin.js";
import { startWorker } from "./workers/digest.js";
import { startScheduler } from "./services/scheduler.js";

const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });

// CORS — allow production frontend + localhost for dev
await app.register(cors, {
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  origin: [
    "https://podcastia.solutionprime.com.br",
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  credentials: true,
});

// Multipart (file uploads)
await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

// Request timing log
app.addHook("onResponse", (request, reply, done) => {
  const duration = reply.elapsedTime;
  request.log.info(
    { method: request.method, url: request.url, statusCode: reply.statusCode, durationMs: Math.round(duration) },
    `${request.method} ${request.url} -> ${reply.statusCode} (${Math.round(duration)}ms)`
  );
  done();
});

// Routes
await app.register(authRoutes);
await app.register(sourcesRoutes);
await app.register(digestsRoutes);
await app.register(settingsRoutes);
await app.register(webhookRoutes);
await app.register(newsRoutes);
await app.register(adminRoutes);

// Public endpoint for podcast themes (no auth required, used by LP)
app.get("/api/podcast-themes", async () => {
  const { PODCAST_THEMES } = await import("./services/ai.js");
  return { themes: PODCAST_THEMES };
});

// Health check — enhanced with memory + version
app.get("/api/health", async () => {
  const mem = process.memoryUsage();
  const now = new Date();
  const brtHours = (now.getUTCHours() - 3 + 24) % 24;
  const brtTime = String(brtHours).padStart(2, "0") + ":" + String(now.getUTCMinutes()).padStart(2, "0");

  // Count pending digest jobs
  const { supabaseAdmin } = await import("./lib/supabase.js");
  const { count: pendingJobs } = await supabaseAdmin
    .from("digest_jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: totalUsers } = await supabaseAdmin
    .from("users")
    .select("*", { count: "exact", head: true });

  const { count: activeSources } = await supabaseAdmin
    .from("source_connections")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  return {
    status: "ok",
    version: "1.2.0",
    uptime: Math.round(process.uptime()),
    uptimeHuman: Math.floor(process.uptime() / 3600) + "h " + Math.floor((process.uptime() % 3600) / 60) + "m",
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + "MB",
      heap: Math.round(mem.heapUsed / 1024 / 1024) + "/" + Math.round(mem.heapTotal / 1024 / 1024) + "MB",
    },
    brt: brtTime,
    stats: {
      users: totalUsers || 0,
      activeSources: activeSources || 0,
      pendingJobs: pendingJobs || 0,
    },
    timestamp: now.toISOString(),
  };
});

// Start server
try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  console.log(`API running on port ${env.PORT}`);

  // Start background services
  startWorker();
  startScheduler();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`[Server] ${signal} received, shutting down gracefully...`);
  await app.close();
  process.exit(0);
};
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
