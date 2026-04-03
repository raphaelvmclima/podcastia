import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";
import { processMedia } from "../services/media-processor.js";

// -- Rate limiter (in-memory, per IP) --
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW = 60000; // 60 seconds

function checkRateLimit(request: FastifyRequest, reply: FastifyReply): boolean {
  const ip = request.ip || request.headers["x-forwarded-for"]?.toString() || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false; // not limited
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    reply.status(429).send({ error: "Too many requests. Max 100 per minute." });
    return true; // limited
  }
  return false;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

export async function webhookRoutes(app: FastifyInstance) {
  // Increase body limit for media payloads (base64 can be large)
  app.post("/api/webhooks/whatsapp", { config: { rawBody: true }, bodyLimit: 50 * 1024 * 1024 }, async (request, reply) => {
    // Rate limit check
    if (checkRateLimit(request, reply)) return;

    const body = request.body as any;
    const message = body?.message;
    const chat = body?.chat;

    if (!message) {
      return reply.status(200).send({ ok: true, skipped: "no message" });
    }

    // Skip own messages
    if (message.fromMe) {
      return reply.status(200).send({ ok: true, skipped: "own message" });
    }

    const messageType = message.messageType || message.type || "";
    const text = message.text || message.conversation || message.caption || "";
    const groupId = chat?.wa_chatid || message.remoteJid || "";
    const senderName = message.senderName || message.pushName || "Desconhecido";
    const timestamp = message.messageTimestamp;

    // Find matching monitored connections
    const { data: connections } = await supabaseAdmin
      .from("source_connections")
      .select("id, user_id, config")
      .eq("type", "whatsapp")
      .eq("is_active", true);

    const matchingConns = connections?.filter((c) => {
      const cfg = c.config || {};
      const monitoredGroups: string[] = cfg.monitoredGroups || [];
      return monitoredGroups.includes(groupId);
    }) || [];

    if (matchingConns.length === 0) {
      return reply.status(200).send({ ok: true, skipped: "not monitored", groupId });
    }

    // Determine content: text message or media
    let content = text.trim();
    let mediaType = "text";

    // If no text content, try to process media (audio, image, video)
    if (!content) {
      const isMedia = messageType.includes("audio") || messageType.includes("ptt")
        || messageType.includes("image") || messageType.includes("video")
        || messageType.includes("document")
        || message.mimetype?.includes("audio") || message.mimetype?.includes("image")
        || message.mimetype?.includes("video") || message.mimetype?.includes("pdf");

      if (isMedia) {
        try {
          const mediaResult = await processMedia(
            messageType,
            message.base64,
            message.mediaUrl || message.fileUrl || message.url,
            message.mimetype,
            message.caption
          );

          if (mediaResult) {
            content = mediaResult.text;
            mediaType = mediaResult.mediaType;
            console.log(`[Webhook] Media processed (${mediaType}): ${content.slice(0, 100)}...`);
          }
        } catch (err: any) {
          console.error("[Webhook] Media processing error:", err.message);
        }
      }
    }

    // Skip if still no content
    if (!content) {
      return reply.status(200).send({ ok: true, skipped: "no content after processing" });
    }

    // Validate timestamp
    const capturedAt = (() => {
      if (!timestamp) return new Date().toISOString();
      const ts = parseInt(timestamp);
      const msValue = ts > 4102444800 ? ts : ts * 1000;
      const date = new Date(msValue);
      const year = date.getFullYear();
      if (year < 2020 || year > 2030) return new Date().toISOString();
      return date.toISOString();
    })();

    // Save for each matching user
    const inserts = matchingConns.map((conn) => ({
      user_id: conn.user_id,
      source_connection_id: conn.id,
      source_type: "whatsapp" as const,
      group_name: chat?.name || groupId,
      sender_name: senderName,
      content,
      media_type: mediaType as any,
      captured_at: capturedAt,
      processed: false,
    }));

    const { error } = await supabaseAdmin.from("captured_messages").insert(inserts);
    if (error) {
      console.error("[Webhook] Insert error:", error.message);
      return reply.status(500).send({ error: "Failed to save message" });
    }

    console.log(`[Webhook] Saved ${inserts.length} ${mediaType} message(s) from ${senderName} in ${chat?.name || groupId}`);
    return { ok: true, saved: inserts.length, type: mediaType };
  });

  // ============================================================
  // Custom Webhook — receives data from external systems
  // POST /api/webhooks/source/:token
  // ============================================================
  app.post("/api/webhooks/source/:token", { bodyLimit: 5 * 1024 * 1024 }, async (request, reply) => {
    // Rate limit check
    if (checkRateLimit(request, reply)) return;

    const { token } = request.params as { token: string };

    if (!token || token.length < 10) {
      return reply.status(400).send({ error: "Invalid webhook token" });
    }

    // Find source connection by webhook_token in config
    const { data: sources, error: findErr } = await supabaseAdmin
      .from("source_connections")
      .select("id, user_id, name, config, is_active")
      .eq("type", "webhook")
      .eq("is_active", true);

    if (findErr) {
      console.error("[Webhook/Custom] DB error:", findErr.message);
      return reply.status(500).send({ error: "Internal error" });
    }

    // Match by webhook_token in config
    const source = sources?.find((s: any) => s.config?.webhook_token === token);

    if (!source) {
      return reply.status(404).send({ error: "Webhook not found or inactive" });
    }

    const body = request.body as any;

    // Extract content from the request body
    let content = "";
    let senderName = "Webhook";

    if (typeof body === "string") {
      content = body;
    } else if (body && typeof body === "object") {
      // Try common content fields
      content = body.content || body.text || body.message || body.body || body.data || "";

      // If content is an object, stringify it
      if (typeof content === "object") {
        content = JSON.stringify(content, null, 2);
      }

      // If no known field, stringify the whole body
      if (!content) {
        content = JSON.stringify(body, null, 2);
      }

      // Extract sender name if provided
      senderName = body.sender || body.from || body.source || body.author || "Webhook";
      if (typeof senderName === "object") senderName = "Webhook";
    }

    if (!content.trim()) {
      return reply.status(200).send({ ok: true, skipped: "empty content" });
    }

    // Truncate if too long
    if (content.length > 20000) {
      content = content.slice(0, 20000) + "\n\n[... truncado]";
    }

    // Save as captured message
    const { error: insertErr } = await supabaseAdmin.from("captured_messages").insert({
      user_id: source.user_id,
      source_connection_id: source.id,
      source_type: "webhook",
      group_name: source.name || "Webhook",
      sender_name: senderName,
      content,
      media_type: "text",
      captured_at: new Date().toISOString(),
      processed: false,
    });

    if (insertErr) {
      console.error("[Webhook/Custom] Insert error:", insertErr.message);
      return reply.status(500).send({ error: "Failed to save message" });
    }

    console.log(`[Webhook/Custom] Saved message for source "${source.name}" (${source.id}), user ${source.user_id}, ${content.length} chars`);
    return { ok: true, saved: 1, source: source.name };
  });

  app.post("/api/webhooks/telegram", async (_req, reply) => reply.status(200).send({ ok: true }));
  app.post("/api/webhooks/stripe", async (_req, reply) => reply.status(200).send({ ok: true }));
}
