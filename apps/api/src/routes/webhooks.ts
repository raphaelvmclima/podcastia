import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";
import { processMedia } from "../services/media-processor.js";
import { isActivationPhrase, isDeactivationPhrase, activateSession, deactivateSession, isSessionActive, getUserByPhone, processMessage, getGreeting, getFarewell, markSentMessage, isSentByMaia, scheduleSessionTimeout, cancelSessionTimeout, refreshTTL } from "../services/isa.js";
import { sendWhatsAppText, sendWhatsAppAudio } from "../services/uazapi.js";

const THEMES_TEXT = `🎙️ *Escolha o estilo do seu podcast:*

1️⃣ *conversa* — Dois amigos conversando no bar sobre o assunto, com piadas e histórias pessoais. Clima leve e descontraído.

2️⃣ *aula* — Estilo professor e aluno. A Maia ensina e o Raphael tenta responder. Didático e interativo.

3️⃣ *jornalístico* — Formato telejornal profissional com reportagens e dados. Sério e informativo.

4️⃣ *resumo* — Briefing executivo rápido. Só os pontos essenciais, direto ao ponto.

5️⃣ *comentários* — Os dois discordam sobre cada tema. Opiniões opostas que geram reflexão.

6️⃣ *storytelling* — Contação de histórias. Transforma o conteúdo em narrativas com suspense e emoção.

7️⃣ *estudo* — Aula universitária técnica. Conteúdo acadêmico com terminologia científica.

8️⃣ *debate* — Debate acalorado. Cada um defende uma posição oposta. Intenso e apaixonado.

9️⃣ *entrevista* — Jornalista entrevistando especialista. Perguntas provocativas com respostas baseadas em dados.

🔟 *motivacional* — Conteúdo inspirador com energia alta. Superação e call-to-action.

_Responda com o número ou o nome do estilo que preferir!_`;

// -- Rate limiter (in-memory, per IP) --
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// -- Message deduplication (UAZAPI sends 2 webhooks per message) --
const processedMessages = new Map<string, number>();
const DEDUP_TTL = 30000; // 30 seconds

// Cleanup stale dedup entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of processedMessages) {
    if (now - ts > DEDUP_TTL) processedMessages.delete(id);
  }
}, 120000);
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

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";

async function generateMaiaAudio(text: string, phone: string, token: string): Promise<void> {
  const t0 = Date.now();
  const { writeFileSync, unlinkSync, existsSync, mkdirSync } = await import("fs");
  const { execSync } = await import("child_process");
  const { readFileSync } = await import("fs");

  if (!existsSync("/tmp/podcastia")) mkdirSync("/tmp/podcastia", { recursive: true });
  const ts = Date.now();
  const pcmFile = `/tmp/podcastia/maia_${ts}.pcm`;
  const oggFile = `/tmp/podcastia/maia_${ts}.ogg`;

  const payload = {
    contents: [{ parts: [{ text: "Fale com voz feminina amigável e natural, em português brasileiro. Tom de assistente prestativa. " + text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      temperature: 1.0,
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Leda" } },
      },
    },
  };

  // TTS with retry (max 2 attempts)
  let audioB64: string | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GOOGLE_API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) }
      );

      if (!res.ok) {
        console.error(`[Maia] TTS error (attempt ${attempt}):`, res.status);
        if (attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
        break;
      }

      const data = (await res.json()) as any;
      audioB64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      if (audioB64) break;
      console.error(`[Maia] No audio data (attempt ${attempt})`);
    } catch (err: any) {
      console.error(`[Maia] TTS fetch error (attempt ${attempt}):`, err.message);
      if (attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
    }
  }

  // Fallback: if TTS failed, send as text so user is never left without response
  if (!audioB64) {
    console.error("[Maia] TTS failed after retries, falling back to text");
    await sendWhatsAppText(phone, text, token);
    return;
  }

  writeFileSync(pcmFile, Buffer.from(audioB64, "base64"));
  // fsync to prevent race condition with ffmpeg
  const { openSync, fsyncSync, closeSync } = await import("fs");
  const fd = openSync(pcmFile, "r");
  fsyncSync(fd);
  closeSync(fd);
  execSync(`ffmpeg -y -f s16le -ar 24000 -ac 1 -i ${pcmFile} -codec:a libopus -b:a 48k ${oggFile} 2>/dev/null`);

  const audioBase64 = readFileSync(oggFile).toString("base64");
  await sendWhatsAppAudio(phone, audioBase64, token);

  try { unlinkSync(pcmFile); } catch {}
  try { unlinkSync(oggFile); } catch {}
  console.log("[Maia] Audio sent (" + (Date.now() - t0) + "ms)");
}

/**
 * Process media from a fromMe message for Maia context
 */
async function downloadMediaFromUazapi(fullId: string, token: string): Promise<{ fileURL: string; mimetype: string } | null> {
  try {
    const baseUrl = process.env.UAZAPI_URL || "https://loumarturismo.uazapi.com";
    // UAZAPI expects field "id" with format "owner:messageid"
    const res = await fetch(`${baseUrl}/message/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({ id: fullId }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[Maia] UAZAPI download error:", res.status, errText.slice(0, 200));
      return null;
    }
    const data = (await res.json()) as any;
    // UAZAPI returns { fileURL: "https://...", mimetype: "audio/mpeg" }
    if (data?.fileURL) {
      console.log("[Maia] UAZAPI download OK:", data.mimetype, data.fileURL.slice(0, 80));
      return { fileURL: data.fileURL, mimetype: data.mimetype || "" };
    }
    console.error("[Maia] UAZAPI download: no fileURL in response");
    return null;
  } catch (err: any) {
    console.error("[Maia] UAZAPI download error:", err.message);
    return null;
  }
}

async function processMediaForMaia(message: any, userToken?: string): Promise<string | null> {
  const messageType = message.messageType || message.type || "";
  const isMedia =
    messageType.includes("Audio") || messageType.includes("audio") || messageType.includes("ptt") ||
    messageType.includes("Image") || messageType.includes("image") ||
    messageType.includes("Video") || messageType.includes("video") ||
    messageType.includes("Document") || messageType.includes("document") ||
    message.mimetype?.includes("audio") || message.mimetype?.includes("image") ||
    message.mimetype?.includes("video") || message.mimetype?.includes("pdf");

  if (!isMedia) return null;

  // Extract media data from UAZAPI payload
  const contentObj = (typeof message.content === "object" && message.content) ? message.content : null;
  let base64Data = message.base64 || null;
  let mimetype = message.mimetype || null;

  // Get mimetype from content object
  if (contentObj && !mimetype && contentObj.mimetype) {
    mimetype = contentObj.mimetype;
  }

  // ALWAYS download via UAZAPI /message/download (WhatsApp media URLs are encrypted)
  // UAZAPI needs full id format: "owner:messageid" (available in message.id)
  let mediaUrl: string | null = null;
  const fullId = message.id || (message.owner ? message.owner + ":" + message.messageid : null);
  if (!base64Data && fullId && userToken) {
    console.log("[Maia] Downloading media from UAZAPI, id:", fullId);
    const downloadResult = await downloadMediaFromUazapi(fullId, userToken);
    if (downloadResult) {
      mediaUrl = downloadResult.fileURL;
      if (!mimetype && downloadResult.mimetype) mimetype = downloadResult.mimetype;
    }
    // Infer mimetype from messageType if not available
    if (!mimetype) {
      if (messageType.includes("Audio") || messageType.includes("audio") || messageType.includes("ptt")) mimetype = "audio/ogg";
      else if (messageType.includes("Image") || messageType.includes("image")) mimetype = "image/jpeg";
      else if (messageType.includes("Video") || messageType.includes("video")) mimetype = "video/mp4";
      else if (messageType.includes("Document") || messageType.includes("document")) mimetype = "application/pdf";
    }
  }

  if (!base64Data && !mediaUrl) {
    console.log("[Maia] No media source available for id:", fullId);
    return null;
  }

  try {
    const mediaResult = await processMedia(
      messageType,
      base64Data || undefined,
      mediaUrl || undefined,
      mimetype || undefined,
      message.caption || (typeof message.text === "string" ? message.text : undefined)
    );

    if (!mediaResult) return null;

    // Wrap in context tags só Maia knows the source
    const tagMap: Record<string, string> = {
      audio_transcription: "AUDIO",
      image_description: "IMAGEM",
      pdf_extraction: "DOCUMENTO",
      video_transcription: "VIDEO",
    };
    const tag = tagMap[mediaResult.mediaType] || "MIDIA";
    console.log(`[Maia] Media processed for direct chat (${mediaResult.mediaType}): ${mediaResult.text.slice(0, 80)}...`);
    return `[${tag}]${mediaResult.text}[/${tag}]`;
  } catch (err: any) {
    console.error("[Maia] Media processing error in direct chat:", err.message);
    return null;
  }
}

async function handleIsaMessage(phone: string, text: string, mediaContext?: string): Promise<void> {
  const user = await getUserByPhone(phone);
  if (!user) {
    console.log("[Maia] Unknown phone:", phone);
    return;
  }

  const { userId, token, name } = user;

  // Extract transcribed text from audio media context for activation/deactivation checks
  // This allows "Ola Maia" sent as voice note to activate the session
  let effectiveText = text;
  if (!effectiveText && mediaContext) {
    const audioMatch = mediaContext.match(/\[Audio transcrito\]:\s*(.+?)(?:\[|$)/i);
    if (audioMatch) {
      effectiveText = audioMatch[1].trim();
      console.log("[Maia] Extracted text from audio:", effectiveText.slice(0, 80));
    }
  }

  // Check activation (text OR audio transcription)
  if (effectiveText && isActivationPhrase(effectiveText)) {
    await activateSession(userId);
    scheduleSessionTimeout(userId, phone, token, name);
    const greeting = await getGreeting(name, userId);
    generateMaiaAudio(greeting, phone, token).catch((err) =>
      console.error("[Maia] Greeting audio error:", err.message)
    );
    console.log("[Maia] Session activated for", name);
    return;
  }

  // Check if session is active
  const active = await isSessionActive(userId);
  if (!active) {
    console.log("[Maia] Session not active for", name, "- ignoring. Text:", (effectiveText || "[no text]").slice(0, 50));
    return;
  }

  // Check deactivation (text OR audio transcription)
  if (effectiveText && isDeactivationPhrase(effectiveText)) {
    await deactivateSession(userId);
    cancelSessionTimeout(userId);
    const farewell = getFarewell(name);
    generateMaiaAudio(farewell, phone, token).catch((err) =>
      console.error("[Maia] Farewell audio error:", err.message)
    );
    console.log("[Maia] Session deactivated for", name);
    return;
  }

  // Need at least text or media context
  if (!text && !mediaContext) return;

  // Process message with AI
  const preview = text ? text.slice(0, 80) : (mediaContext ? "[media]" : "");
  console.log("[Maia] Processing:", preview);

  // Reschedule timeout on every interaction
  scheduleSessionTimeout(userId, phone, token, name);

  const t0 = Date.now();
  const response = await processMessage(userId, name, text, mediaContext);
  console.log("[Maia] GPT response (" + (Date.now() - t0) + "ms):", response.slice(0, 80));

  // Auto-detect when Maia is asking about audio theme/style
  const responseLower = response.toLowerCase();
  // Detect ONLY when Maia is ASKING about themes, NOT when confirming a choice
  const isConfirmingAction = responseLower.includes("vou criar") || responseLower.includes("criei") || responseLower.includes("criada") || responseLower.includes("pronta") || responseLower.includes("criando") || responseLower.includes("fonte criada") || responseLower.includes("pronto");
  const isAskingTheme = !isConfirmingAction && (
    response.includes("__SHOW_THEMES__") ||
    (responseLower.includes("qual estilo") || responseLower.includes("qual tema de áudio") || responseLower.includes("qual tema do áudio")) ||
    (responseLower.includes("escolha") && responseLower.includes("estilo"))
  );

  if (isAskingTheme) {
    // Send formatted text list ONLY (no audio with theme names)
    sendWhatsAppText(phone, THEMES_TEXT, token).catch(() => {});
    generateMaiaAudio("Te mandei a lista com todos os estilos de podcast disponíveis. Da uma olhada e me diz qual combina mais com o que voce quer!", phone, token).catch((err) =>
      console.error("[Maia] Audio error:", err.message)
    );
    console.log("[Maia] Themes list sent to", name);
  } else {
    // Smart response: data-heavy responses (flights, products, lists, dashboard) → text
    // Conversational responses → audio
    const isDataResponse = response.includes("PASSAGENS ") || response.includes("MILHAS ") ||
      response.includes("MELHORES PRECOS") || response.includes("Dashboard PodcastIA") ||
      response.includes("Fontes ativas:") || response.includes("Ultimos podcasts:") ||
      response.includes("R$ ") && response.includes("Reservar:") ||
      response.length > 1500;

    if (isDataResponse) {
      // Data responses: send as text (more readable + links are clickable)
      sendWhatsAppText(phone, response, token).catch(() => {});
      console.log("[Maia] Text response to", name, "(data, " + response.length + " chars)");
    } else {
      // Conversational: send as audio
      generateMaiaAudio(response, phone, token).catch((err) =>
        console.error("[Maia] Audio error:", err.message)
      );
      console.log("[Maia] Audio response to", name, ":", response.slice(0, 80));
    }
  }
}

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


    // Route own messages to Maia AI assistant
    if (message.fromMe) {
      const selfText = (message.text || message.conversation || message.caption || "").trim();
      // Skip messages sent by Maia (anti-loop)
      // 1. Text messages from Maia start with *PodcastIA
      // 2. Audio/media sent via API have wasSentByApi=true
      if (selfText.startsWith("*PodcastIA") || message.wasSentByApi === true) {
        return reply.status(200).send({ ok: true, skipped: "maia_sent" });
      }

      // Deduplicate: UAZAPI sends 2 webhooks per message
      const msgId = message.messageid || message.id || "";
      if (msgId && processedMessages.has(msgId)) {
        return reply.status(200).send({ ok: true, skipped: "duplicate" });
      }
      if (msgId) processedMessages.set(msgId, Date.now());

      const senderPhone = (message.key?.remoteJid || chat?.wa_chatid || "").replace("@s.whatsapp.net", "");

      // Resolve user early só we have the UAZAPI token for media download
      const maiaUser = await getUserByPhone(senderPhone);
      const userToken = maiaUser?.token;

      // Process media if present (audio, image, docs)
      let mediaContext: string | null = null;
      const msgType = (message.messageType || message.type || "").toLowerCase();
      const hasMediaType = msgType.includes("audio") || msgType.includes("image") ||
        msgType.includes("ptt") || msgType.includes("document") || msgType.includes("video");

      if (!selfText && hasMediaType) {
        // No text — try media (e.g. voice note "Ola Maia")
        mediaContext = await processMediaForMaia(message, userToken || undefined);
        if (!mediaContext) {
          return reply.status(200).send({ ok: true, skipped: "own_no_content" });
        }
      } else if (!selfText) {
        return reply.status(200).send({ ok: true, skipped: "own_no_text" });
      } else if (hasMediaType) {
        // Has text AND media (e.g. image with caption)
        mediaContext = await processMediaForMaia(message, userToken || undefined);
      }

      handleIsaMessage(senderPhone, selfText, mediaContext || undefined).catch((err) =>
        console.error("[Maia] Handler error:", err.message)
      );
      return reply.status(200).send({ ok: true, handled: "maia" });
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
