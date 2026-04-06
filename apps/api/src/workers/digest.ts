import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { generatePodcastScript } from "../services/ai.js";
import { generateAudio, audioToBase64 } from "../services/tts.js";
import { sendWhatsAppText, sendWhatsAppAudio } from "../services/uazapi.js";
import { fetchSourceContent } from "../services/source-fetcher.js";
import { unlinkSync } from "fs";

interface DigestJobData {
  jobId: string;
  userId: string;
  sourceIds?: string[];
}

/** Helper: retry an async fn with delay between attempts */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = 2,
  delayMs: number = 3000
): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (attempt <= maxRetries) {
        console.warn(`[Worker] ${label} attempt ${attempt} failed: ${err.message} — retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr!;
}

/** Helper: generate a 2-line content summary from the script */
function generateContentSummary(script: string, groups: { groupName: string; messages: any[] }[]): string {
  const topicNames = groups.map((g) => g.groupName).slice(0, 5);
  // Extract first substantive line from each host
  const lines = script.split("\n").filter((l) => l.trim().length > 20);
  const maiaLine = lines.find((l) => l.startsWith("Maia:"));
  const raphaelLine = lines.find((l) => l.startsWith("Raphael:"));
  const snippet = (maiaLine || raphaelLine || lines[0] || "").replace(/^(Maia|Raphael):\s*/, "").slice(0, 120);
  return `Fontes: ${topicNames.join(", ")}. ${snippet}...`;
}

async function processDigest(job: Job<DigestJobData>) {
  const { jobId, userId } = job.data;
  const t0 = Date.now();
  console.log(`[Worker] Processing digest job ${jobId} for user ${userId}`);

  const { error: updateErr } = await supabaseAdmin
    .from("digest_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", jobId);
  if (updateErr) console.error("[Worker] Failed to update job status:", updateErr.message);

  try {
    // 1. Get user settings + instance token
    const { data: settings } = await supabaseAdmin
      .from("user_settings")
      .select("*, wa_instance_token, wa_instance_name")
      .eq("user_id", userId)
      .single();

    const { data: userProfile } = await supabaseAdmin
      .from("users")
      .select("name")
      .eq("id", userId)
      .single();

    const instanceToken = settings?.wa_instance_token;

    // 2. Resolve delivery target
    let deliveryNumber = settings?.delivery_target || "";
    if (deliveryNumber === "self" || !deliveryNumber) {
      if (instanceToken) {
        try {
          const statusRes = await fetch((process.env.UAZAPI_URL || "https://loumarturismo.uazapi.com") + "/instance/status", {
            headers: { token: instanceToken },
          });
          const statusData = (await statusRes.json()) as any;
          deliveryNumber = statusData?.instance?.owner || "";
        } catch (err: any) { console.error(`[Worker] Failed to resolve delivery number via UAZAPI:`, err.message); }
      }
    }

    // 3. Fetch content from non-WhatsApp sources (RSS, YouTube, News, etc.)
    const tFetch = Date.now();
    // If specific sourceIds provided (per-source schedule), only process those
    const sourceIds = job.data.sourceIds as string[] | undefined;
    let sourceQuery = supabaseAdmin
      .from("source_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (sourceIds?.length) {
      sourceQuery = sourceQuery.in("id", sourceIds);
    }

    const { data: allSources } = await sourceQuery;

    const nonWaSources = (allSources || []).filter((s: any) => s.type !== "whatsapp");

    if (nonWaSources.length > 0) {
      console.log(`[Worker] Fetching content from ${nonWaSources.length} non-WA sources...`);

      for (const source of nonWaSources) {
        try {
          const items = await fetchSourceContent(source);
          if (items.length > 0) {
            // Deduplication: check existing content for this source
            const existingContents = new Set<string>();
            const { data: existing } = await supabaseAdmin
              .from("captured_messages")
              .select("content")
              .eq("source_connection_id", source.id)
              .order("captured_at", { ascending: false })
              .limit(50);
            existing?.forEach((m: any) => existingContents.add(m.content?.slice(0, 100)));

            const newItems = items.filter((item: any) => !existingContents.has(item.content?.slice(0, 100)));
            if (newItems.length === 0) {
              console.log(`[Worker] All ${items.length} items from ${source.type}: ${source.name} already exist, skipping`);
              continue;
            }

            const inserts = newItems.map((item) => ({
              user_id: userId,
              source_connection_id: source.id,
              source_type: source.type,
              group_name: item.group_name,
              sender_name: item.sender,
              content: item.content,
              media_type: "text" as const,
              captured_at: new Date().toISOString(),
              processed: false,
            }));

            const { error: insertErr } = await supabaseAdmin.from("captured_messages").insert(inserts);
            if (insertErr) {
              console.error(`[Worker] FAILED to insert ${items.length} items from ${source.type}: ${source.name}:`, insertErr.message);
            } else {
              console.log(`[Worker] Fetched and saved ${newItems.length} new items from ${source.type}: ${source.name} (${items.length - newItems.length} duplicates skipped)`);
            }
          }
        } catch (err: any) {
          console.error(`[Worker] Error fetching source ${source.name}:`, err.message);
        }
      }
    }
    console.log(`[Worker][TIMING] Source fetch: ${Date.now() - tFetch}ms`);

    // 4. Get ALL unprocessed messages (WhatsApp + freshly fetched)
    // Fetch unprocessed messages, filtered by sourceIds if provided
    let msgQuery = supabaseAdmin
      .from("captured_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("processed", false)
      .order("captured_at", { ascending: true })
      .limit(200); // Max 200 messages per digest to avoid token overflow

    if (sourceIds?.length) {
      msgQuery = msgQuery.in("source_connection_id", sourceIds);
    }

    const { data: messages } = await msgQuery;

    if (!messages || messages.length === 0) {
      await supabaseAdmin
        .from("digest_jobs")
        .update({ status: "done", completed_at: new Date().toISOString(), error_message: "Nenhuma mensagem para processar" })
        .eq("id", jobId);
      return;
    }

    // 5. Build source_id -> podcast_theme map
    const sourceThemeMap: Record<string, string> = {};
    for (const src of (allSources || [])) {
      sourceThemeMap[src.id] = src.podcast_theme || "conversa";
    }

    // 5b. Group messages by theme, then by source/group within each theme
    const messagesByTheme: Record<string, typeof messages> = {};
    for (const msg of messages) {
      const theme = sourceThemeMap[msg.source_connection_id] || "conversa";
      if (!messagesByTheme[theme]) messagesByTheme[theme] = [];
      messagesByTheme[theme].push(msg);
    }

    const uniqueThemes = Object.keys(messagesByTheme);
    console.log(`[Worker] Found ${uniqueThemes.length} unique theme(s): ${uniqueThemes.join(", ")} across ${messages.length} messages`);

    // 5c. Fetch user context from news_preferences for personalization
    const { data: newsPrefs } = await supabaseAdmin
      .from("news_preferences")
      .select("parsed_filters, topics, keywords")
      .eq("user_id", userId)
      .single();

    let userContext = "";
    if (newsPrefs?.parsed_filters?.categories) {
      userContext = newsPrefs.parsed_filters.categories
        .map((c: any) => `- ${c.name}: ${c.description}`)
        .join("\n");
    }

    // 5d. Get user plan for depth settings
    const { data: userRecord } = await supabaseAdmin
      .from("users")
      .select("plan")
      .eq("id", userId)
      .single();

    const plan = userRecord?.plan || "free";
    const maxChars = plan === "business" ? 7000 : plan === "pro" ? 5000 : 3000;

    const themeLabels: Record<string, string> = {
      conversa: "Conversa do dia",
      aula: "Aula do dia",
      jornalístico: "Jornal do dia",
      resumo: "Resumo executivo",
      comentários: "Comentarios do dia",
      storytelling: "Historias do dia",
      estudo: "Estudo do dia",
      debate: "Debate do dia",
      entrevista: "Entrevista do dia",
      motivacional: "Motivacional do dia",
    };
    const themeEmojis: Record<string, string> = { conversa: "\uD83D\uDCAC", aula: "\uD83C\uDF93", jornalístico: "\uD83D\uDCF0", resumo: "\uD83D\uDCCB", comentários: "\uD83D\uDDE3\uFE0F", storytelling: "\uD83D\uDCD6", estudo: "\uD83D\uDCD5", debate: "\u2694\uFE0F", entrevista: "\uD83C\uDF99\uFE0F", motivacional: "\uD83D\uDD25" };

    const allDigestIds: string[] = [];
    const allMessageIds: string[] = [];
    let totalDuration = 0;
    let totalGroups = 0;

    // 6. Generate one podcast PER THEME
    for (const theme of uniqueThemes) {
      const themeMsgs = messagesByTheme[theme];
      console.log(`[Worker] === Generating podcast for theme "${theme}" with ${themeMsgs.length} messages ===`);

      // Group messages by source/group
      const groupedMessages: Record<string, { sender: string; text: string; time: string }[]> = {};
      for (const msg of themeMsgs) {
        const group = msg.group_name || "Sem grupo";
        if (!groupedMessages[group]) groupedMessages[group] = [];
        groupedMessages[group].push({
          sender: msg.sender_name,
          text: msg.content,
          time: new Date(msg.captured_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        });
      }

      const groups = Object.entries(groupedMessages).map(([groupName, msgs]) => ({ groupName, messages: msgs }));
      totalGroups += groups.length;

      // Generate script
      const tScript = Date.now();
      console.log(`[Worker] Generating script for theme "${theme}": ${themeMsgs.length} msgs, ${groups.length} groups (plan: ${plan}, maxChars: ${maxChars})`);
      const script = await generatePodcastScript(
        groups,
        userProfile?.name || "ouvinte",
        (settings?.audio_style as "casual" | "formal") || "casual",
        maxChars,
        userContext,
        theme
      );
      console.log(`[Worker][TIMING] Script generation (${theme}): ${Date.now() - tScript}ms (${script.length} chars)`);

      const contentSummary = generateContentSummary(script, groups);
      console.log(`[Worker] Content summary (${theme}): ${contentSummary}`);

      // Generate audio
      const tTTS = Date.now();
      console.log(`[Worker] Generating audio for theme "${theme}"...`);
      const { audioPath, duration } = await generateAudio(script, {
        speaker1Voice: settings?.audio_voice || "Sadachbia",
      }, theme);
      console.log(`[Worker][TIMING] TTS generation (${theme}): ${Date.now() - tTTS}ms (duration: ${duration}s)`);
      totalDuration += duration;

      // Upload to storage
      const tUpload = Date.now();
      const audioB64 = audioToBase64(audioPath);
      const audioBuffer = Buffer.from(audioB64, "base64");
      const themeSuffix = uniqueThemes.length > 1 ? `_${theme}` : "";
      const audioFileName = `digests/${userId}/${jobId}${themeSuffix}.ogg`;

      const { error: storageErr } = await supabaseAdmin.storage.from("podcasts").upload(audioFileName, audioBuffer, {
        contentType: "audio/ogg",
        upsert: true,
      });
      if (storageErr) throw new Error(`Storage upload failed (${theme}): ${storageErr.message}`);

      const { data: signedUrl } = await supabaseAdmin.storage.from("podcasts").createSignedUrl(audioFileName, 86400);
      console.log(`[Worker][TIMING] Upload to storage (${theme}): ${Date.now() - tUpload}ms`);

      const digestTitle = `${themeLabels[theme] || "Resumo do dia"} - ${new Date().toLocaleDateString("pt-BR")}`;

      // Save digest
      const { data: digest } = await supabaseAdmin
        .from("digests")
        .insert({
          user_id: userId,
          job_id: jobId,
          title: digestTitle,
          text_content: script,
          content_summary: contentSummary,
          audio_url: signedUrl?.signedUrl || "",
          audio_duration_seconds: duration,
          sources_summary: {
            theme,
            totalMessages: themeMsgs.length,
            groups: groups.map((g) => ({ name: g.groupName, count: g.messages.length })),
          },
        })
        .select()
        .single();

      if (digest?.id) allDigestIds.push(digest.id);

      // Deliver via WhatsApp
      if (settings?.delivery_channel === "whatsapp" && deliveryNumber && instanceToken) {
        const tDeliver = Date.now();
        const themeEmoji = themeEmojis[theme] || "\uD83C\uDF99";
        const multiLabel = uniqueThemes.length > 1 ? ` (${uniqueThemes.indexOf(theme) + 1}/${uniqueThemes.length})` : "";
        const callText = `${themeEmoji} *PodcastIA* \u2014 ${themeLabels[theme] || "Seu resumo"} chegou!${multiLabel}

\uD83D\uDCCA ${themeMsgs.length} mensagens de ${groups.length} fonte(s)
\u23F1 Dura\u00E7\u00E3o: ${Math.floor(duration / 60)}min ${duration % 60}s

${contentSummary}

Ou\u00E7a agora:`;

        await withRetry(
          () => sendWhatsAppText(deliveryNumber, callText, instanceToken),
          `WhatsApp text delivery (${theme})`,
          2, 3000
        );
        await withRetry(
          () => sendWhatsAppAudio(deliveryNumber, audioB64, instanceToken),
          `WhatsApp audio delivery (${theme})`,
          2, 3000
        );

        await supabaseAdmin.from("digests").update({ delivered_at: new Date().toISOString() }).eq("id", digest?.id);
        console.log(`[Worker][TIMING] WhatsApp delivery (${theme}): ${Date.now() - tDeliver}ms`);
      }

      // Mark this theme's messages as processed
      const themeMsgIds = themeMsgs.map((m: any) => m.id);
      allMessageIds.push(...themeMsgIds);
      await supabaseAdmin
        .from("captured_messages")
        .update({ processed: true, digest_id: digest?.id })
        .in("id", themeMsgIds);

      try { unlinkSync(audioPath); } catch (err: any) { console.error(`[Worker] Failed to cleanup audio file:`, err.message); }
    }

    // 12. Mark job done
    await supabaseAdmin
      .from("digest_jobs")
      .update({ status: "done", completed_at: new Date().toISOString(), sources_used: { messageCount: messages.length, groupCount: totalGroups, themes: uniqueThemes } })
      .eq("id", jobId);

    const totalTime = Date.now() - t0;
    console.log(`[Worker] Digest ${jobId} completed! ${uniqueThemes.length} theme(s), Total: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s), Duration: ${totalDuration}s, delivered to ${deliveryNumber}`);
  } catch (err: any) {
    console.error(`[Worker] Digest ${jobId} failed after ${Date.now() - t0}ms:`, err);
    await supabaseAdmin.from("digest_jobs").update({ status: "failed", error_message: err.message }).eq("id", jobId);
    throw err;
  }
}

export function startWorker() {
  const worker = new Worker("digest-generation", processDigest, {
    connection: redis,
    concurrency: 2,
  });

  worker.on("completed", (job) => console.log(`[Worker] Job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`[Worker] Job ${job?.id} failed:`, err.message));

  console.log("[Worker] Digest generation worker started");
  return worker;
}
