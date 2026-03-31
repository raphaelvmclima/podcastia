import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./lib/env.js";
import { authRoutes } from "./routes/auth.js";
import { sourcesRoutes } from "./routes/sources.js";
import { digestsRoutes } from "./routes/digests.js";
import { settingsRoutes } from "./routes/settings.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { newsRoutes } from "./routes/news.js";
import { startWorker } from "./workers/digest.js";
import { startScheduler } from "./services/scheduler.js";

const app = Fastify({ logger: true });

// CORS
await app.register(cors, {
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  origin: true,
  credentials: true,
});

// Routes
await app.register(authRoutes);
await app.register(sourcesRoutes);
await app.register(digestsRoutes);
await app.register(settingsRoutes);
await app.register(webhookRoutes);
await app.register(newsRoutes);

// Health check
app.get("/api/health", async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
}));

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
