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
}

async function processDigest(job: Job<DigestJobData>) {
  const { jobId, userId } = job.data;
  console.log(`[Worker] Processing digest job ${jobId} for user ${userId}`);

  await supabaseAdmin
    .from("digest_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", jobId);

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
          const statusRes = await fetch("https://loumarturismo.uazapi.com/instance/status", {
            headers: { token: instanceToken },
          });
          const statusData = (await statusRes.json()) as any;
          deliveryNumber = statusData?.instance?.owner || "";
        } catch {}
      }
    }

    // 3. Fetch content from non-WhatsApp sources (RSS, YouTube, News, etc.)
    const { data: allSources } = await supabaseAdmin
      .from("source_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    const nonWaSources = (allSources || []).filter((s: any) => s.type !== "whatsapp");

    if (nonWaSources.length > 0) {
      console.log(`[Worker] Fetching content from ${nonWaSources.length} non-WA sources...`);

      for (const source of nonWaSources) {
        try {
          const items = await fetchSourceContent(source);
          if (items.length > 0) {
            const inserts = items.map((item) => ({
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

            await supabaseAdmin.from("captured_messages").insert(inserts);
            console.log(`[Worker] Fetched ${items.length} items from ${source.type}: ${source.name}`);
          }
        } catch (err: any) {
          console.error(`[Worker] Error fetching source ${source.name}:`, err.message);
        }
      }
    }

    // 4. Get ALL unprocessed messages (WhatsApp + freshly fetched)
    const { data: messages } = await supabaseAdmin
      .from("captured_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("processed", false)
      .order("captured_at", { ascending: true });

    if (!messages || messages.length === 0) {
      await supabaseAdmin
        .from("digest_jobs")
        .update({ status: "done", completed_at: new Date().toISOString(), error_message: "Nenhuma mensagem para processar" })
        .eq("id", jobId);
      return;
    }

    // 5. Group messages by source/group
    const groupedMessages: Record<string, { sender: string; text: string; time: string }[]> = {};
    for (const msg of messages) {
      const group = msg.group_name || "Sem grupo";
      if (!groupedMessages[group]) groupedMessages[group] = [];
      groupedMessages[group].push({
        sender: msg.sender_name,
        text: msg.content,
        time: new Date(msg.captured_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      });
    }

    const groups = Object.entries(groupedMessages).map(([groupName, msgs]) => ({ groupName, messages: msgs }));

    // 5b. Fetch user context from news_preferences for personalization
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

    // 5c. Get user plan for depth settings
    const { data: userRecord } = await supabaseAdmin
      .from("users")
      .select("plan")
      .eq("id", userId)
      .single();

    const plan = userRecord?.plan || "free";
    // Business/Pro get longer, deeper podcasts
    const maxChars = plan === "business" ? 7000 : plan === "pro" ? 5000 : 3000;

    // 6. Generate script via GPT
    console.log(`[Worker] Generating script for ${messages.length} messages across ${groups.length} groups (plan: ${plan}, maxChars: ${maxChars})`);
    const script = await generatePodcastScript(
      groups,
      userProfile?.name || "ouvinte",
      (settings?.audio_style as "casual" | "formal") || "casual",
      maxChars,
      userContext
    );

    // 7. Generate audio via Gemini TTS + ffmpeg
    console.log(`[Worker] Generating audio...`);
    const { audioPath, duration } = await generateAudio(script, {
      speaker1Voice: settings?.audio_voice || "Sadachbia",
    });

    // 8. Upload to Supabase Storage
    const audioB64 = audioToBase64(audioPath);
    const audioBuffer = Buffer.from(audioB64, "base64");
    const audioFileName = `digests/${userId}/${jobId}.ogg`;

    await supabaseAdmin.storage.from("podcasts").upload(audioFileName, audioBuffer, {
      contentType: "audio/ogg",
      upsert: true,
    });

    const { data: signedUrl } = await supabaseAdmin.storage.from("podcasts").createSignedUrl(audioFileName, 86400);

    // 9. Save digest
    const { data: digest } = await supabaseAdmin
      .from("digests")
      .insert({
        user_id: userId,
        job_id: jobId,
        title: `Resumo do dia - ${new Date().toLocaleDateString("pt-BR")}`,
        text_content: script,
        audio_url: signedUrl?.signedUrl || "",
        audio_duration_seconds: duration,
        sources_summary: {
          totalMessages: messages.length,
          groups: groups.map((g) => ({ name: g.groupName, count: g.messages.length })),
        },
      })
      .select()
      .single();

    // 10. Deliver via WhatsApp
    if (settings?.delivery_channel === "whatsapp" && deliveryNumber && instanceToken) {
      const callText = `🎙 *PodcastIA* — Seu resumo chegou!\n\n📊 ${messages.length} mensagens de ${groups.length} fonte(s)\n⏱ Duração: ${Math.floor(duration / 60)}min ${duration % 60}s\n\nOuça agora:`;

      await sendWhatsAppText(deliveryNumber, callText, instanceToken);
      await sendWhatsAppAudio(deliveryNumber, audioB64, instanceToken);

      await supabaseAdmin.from("digests").update({ delivered_at: new Date().toISOString() }).eq("id", digest?.id);
    }

    // 11. Mark messages as processed
    await supabaseAdmin
      .from("captured_messages")
      .update({ processed: true, digest_id: digest?.id })
      .in("id", messages.map((m) => m.id));

    // 12. Mark job done
    await supabaseAdmin
      .from("digest_jobs")
      .update({ status: "done", completed_at: new Date().toISOString(), sources_used: { messageCount: messages.length, groupCount: groups.length } })
      .eq("id", jobId);

    try { unlinkSync(audioPath); } catch {}
    console.log(`[Worker] Digest ${jobId} completed! Duration: ${duration}s, delivered to ${deliveryNumber}`);
  } catch (err: any) {
    console.error(`[Worker] Digest ${jobId} failed:`, err);
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
