import { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";

export async function webhookRoutes(app: FastifyInstance) {
  // UAZAPI webhook — receives messages from WhatsApp
  // UAZAPI sends: { message: { id, senderName, text, messageType, messageTimestamp, ... }, chat: { wa_chatid, name, ... } }
  app.post("/api/webhooks/whatsapp", async (request, reply) => {
    const body = request.body as any;

    // UAZAPI format: body.message + body.chat
    const message = body?.message;
    const chat = body?.chat;

    if (!message) {
      return reply.status(200).send({ ok: true, skipped: "no message" });
    }

    // Skip non-text messages for now (audio transcription can be added later)
    const messageType = message.messageType || "";
    const text = message.text || message.conversation || "";

    if (!text.trim()) {
      return reply.status(200).send({ ok: true, skipped: "empty or non-text message" });
    }

    // Skip own messages
    if (message.fromMe) {
      return reply.status(200).send({ ok: true, skipped: "own message" });
    }

    const groupId = chat?.wa_chatid || message.remoteJid || "";
    const senderName = message.senderName || message.pushName || "Desconhecido";
    const timestamp = message.messageTimestamp;

    // Determine if group or individual chat
    const isGroup = groupId.endsWith("@g.us");

    // Find all users who monitor this group/contact
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

    // Save message for each matching user
    const inserts = matchingConns.map((conn) => ({
      user_id: conn.user_id,
      source_connection_id: conn.id,
      source_type: "whatsapp" as const,
      group_name: chat?.name || groupId,
      sender_name: senderName,
      content: text,
      media_type: "text" as const,
      captured_at: timestamp
        ? new Date(parseInt(timestamp) * 1000).toISOString()
        : new Date().toISOString(),
      processed: false,
    }));

    const { error } = await supabaseAdmin.from("captured_messages").insert(inserts);
    if (error) {
      console.error("[Webhook] Insert error:", error.message);
    }

    console.log(`[Webhook] Saved ${inserts.length} message(s) from ${senderName} in ${chat?.name || groupId}`);
    return { ok: true, saved: inserts.length };
  });

  app.post("/api/webhooks/telegram", async (_req, reply) => reply.status(200).send({ ok: true }));
  app.post("/api/webhooks/stripe", async (_req, reply) => reply.status(200).send({ ok: true }));
}
