import { searchFlights, searchProducts, searchGoogle } from "./google-search.js";
/**
 * Maia - WhatsApp AI Assistant for PodcastIA
 * Enhanced: multi-source types, media understanding, dashboard, URL search
 */

import { redis } from "../lib/redis.js";
import { supabaseAdmin } from "../lib/supabase.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const SESSION_TTL = 1800; // 30 minutes
const HISTORY_TTL = 604800; // 7 days - persistent across sessions
const MAX_HISTORY = 50; // Keep last 50 messages for full context

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function isActivationPhrase(text: string): boolean {
  const n = normalize(text);
  return [
    /^(ola|oi|hey|ei|bom dia|boa tarde|boa noite|hello|hi)\s*(,?\s*)maia/,
    /^maia\s*(,?\s*)(ola|oi|tudo bem|me ajuda|preciso)/,
    /^maia$/,
  ].some((p) => p.test(n));
}

export function isDeactivationPhrase(text: string): boolean {
  const n = normalize(text);
  return [
    /^(tchau|obrigad[oa]|valeu|ate mais|bye|chega|encerr|finaliz|para)\s*(,?\s*)maia/,
    /^tchau\s*maia$/,
    /^maia\s*(,?\s*)(tchau|obrigad|valeu|ate mais|bye)/,
  ].some((p) => p.test(n));
}

export async function activateSession(userId: string): Promise<void> {
  await redis.set(`maia:active:${userId}`, "1", "EX", SESSION_TTL);
  // Store session start time for timeout tracking
  await redis.set(`maia:session_start:${userId}`, Date.now().toString(), "EX", SESSION_TTL + 60);
}

// Track active sessions for timeout notification
const sessionTimeouts = new Map<string, NodeJS.Timeout>();

export function scheduleSessionTimeout(userId: string, phone: string, token: string, userName: string): void {
  // Clear any existing timeout
  const existing = sessionTimeouts.get(userId);
  if (existing) clearTimeout(existing);

  // Schedule farewell message when session expires
  const timeout = setTimeout(async () => {
    const stillActive = await isSessionActive(userId);
    if (!stillActive) {
      // Session expired naturally - send farewell
      const { sendWhatsAppText } = await import("../services/uazapi.js");
      const msg = `Oi ${userName}! Faz um tempinho que você não me chamou, então vou sair por aqui. Quando quiser voltar, é só dizer "Olá Maia"! 👋`;
      sendWhatsAppText(phone, msg, token).catch(() => {});
      console.log("[Maia] Session timeout - farewell sent to", userName);
      sessionTimeouts.delete(userId);
    }
  }, (SESSION_TTL + 5) * 1000); // 5s after TTL expires

  sessionTimeouts.set(userId, timeout);
}

export function cancelSessionTimeout(userId: string): void {
  const existing = sessionTimeouts.get(userId);
  if (existing) {
    clearTimeout(existing);
    sessionTimeouts.delete(userId);
  }
}

export async function deactivateSession(userId: string): Promise<void> {
  await redis.del(`maia:active:${userId}`);
  // DON'T delete chat history on deactivation - keep it for next session
  cancelSessionTimeout(userId);
}

export async function isSessionActive(userId: string): Promise<boolean> {
  return (await redis.get(`maia:active:${userId}`)) === "1";
}

export async function refreshTTL(userId: string): Promise<void> {
  await redis.expire(`maia:active:${userId}`, SESSION_TTL);
  await redis.expire(`maia:session_start:${userId}`, SESSION_TTL + 60);
}

export async function markSentMessage(messageId: string): Promise<void> {
  if (messageId) await redis.set(`maia:sent:${messageId}`, "1", "EX", 120);
}

export async function isSentByMaia(messageId: string): Promise<boolean> {
  if (!messageId) return false;
  return (await redis.get(`maia:sent:${messageId}`)) === "1";
}

async function addMessage(userId: string, role: "user" | "assistant", content: string): Promise<void> {
  const ts = Date.now();
  const msg = JSON.stringify({ role, content, ts });
  // Redis for speed (ephemeral cache)
  await redis.lpush(`maia:chat:${userId}`, msg);
  await redis.ltrim(`maia:chat:${userId}`, 0, MAX_HISTORY - 1);
  await redis.expire(`maia:chat:${userId}`, HISTORY_TTL);
  // Supabase for permanent persistence (fire and forget)
  supabaseAdmin.from("maia_chat_history").insert({
    user_id: userId, role, content, created_at: new Date(ts).toISOString(),
  }).then(() => {}).catch((err: any) => console.error("[Maia] History save error:", err.message));
}

async function getHistory(userId: string): Promise<{ role: string; content: string }[]> {
  // Try Redis first (fast, has recent messages)
  const raw = await redis.lrange(`maia:chat:${userId}`, 0, MAX_HISTORY - 1);
  if (raw.length > 0) {
    return raw.map((r) => JSON.parse(r)).reverse().map((m) => ({ role: m.role, content: m.content }));
  }
  // Fallback to Supabase (persistent history from previous sessions)
  const { data } = await supabaseAdmin
    .from("maia_chat_history")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY);
  if (data?.length) {
    // Restore to Redis for faster access during this session
    const reversed = [...data].reverse();
    for (const m of reversed) {
      await redis.lpush(`maia:chat:${userId}`, JSON.stringify({ role: m.role, content: m.content, ts: Date.now() }));
    }
    await redis.ltrim(`maia:chat:${userId}`, 0, MAX_HISTORY - 1);
    await redis.expire(`maia:chat:${userId}`, HISTORY_TTL);
    return reversed.map((m) => ({ role: m.role, content: m.content }));
  }
  return [];
}

export async function getUserByPhone(phone: string): Promise<{ userId: string; token: string; name: string } | null> {
  const digits = phone.replace(/\D/g, "").replace(/@.*/, "");
  const cached = await redis.get(`maia:user:${digits}`);
  if (cached) return JSON.parse(cached);

  const { data: settings } = await supabaseAdmin
    .from("user_settings")
    .select("user_id, wa_instance_token")
    .not("wa_instance_token", "is", null);

  if (!settings?.length) return null;

  for (const s of settings) {
    if (!s.wa_instance_token) continue;
    try {
      const res = await fetch(`${process.env.UAZAPI_URL || "https://loumarturismo.uazapi.com"}/instance/status`, {
        headers: { token: s.wa_instance_token },
      });
      const data = (await res.json()) as any;
      const owner = (data?.instance?.owner || "").replace(/\D/g, "");
      if (owner && owner === digits) {
        const { data: user } = await supabaseAdmin.from("users").select("name").eq("id", s.user_id).single();
        const result = { userId: s.user_id, token: s.wa_instance_token, name: user?.name || "amigo" };
        await redis.set(`maia:user:${digits}`, JSON.stringify(result), "EX", 86400);
        return result;
      }
    } catch (err: any) {
      console.error(`[Maia] Error checking instance:`, err.message);
    }
  }
  return null;
}

// --------------- URL Search ---------------

export async function searchForUrl(query: string, type: "rss" | "youtube" | "website"): Promise<string | null> {
  console.log(`[Maia] Searching URL for: "${query}" (type: ${type})`);

  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  if (type === "youtube") {
    // === YouTube: search directly on youtube.com ===
    try {
      // sp=EgIQAg== filters to "Channels" only
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%3D%3D`;
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": UA, "Accept-Language": "pt-BR" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const html = await res.text();
        // Extract @handles from search results
        const handles = [...new Set((html.match(/@[a-zA-Z0-9._-]{3,}/g) || []))].filter(
          h => !h.startsWith("@.") && !h.startsWith("@300") && h.length > 3
        );
        console.log(`[Maia] YouTube search found ${handles.length} channels:`, handles.slice(0, 5).join(", "));

        if (handles.length === 1) {
          return `https://www.youtube.com/${handles[0]}`;
        }
        if (handles.length > 1) {
          // Return multiple options for user to choose
          const options = handles.slice(0, 5).map((h, i) => `${i + 1}. https://www.youtube.com/${h}`).join("\n");
          return "__MULTIPLE__" + options;
        }
      }
    } catch (err: any) {
      console.error("[Maia] YouTube search error:", err.message);
    }

    // Fallback: try direct @handle guess
    const guess = query.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
    try {
      const checkUrl = `https://www.youtube.com/@${guess}`;
      const res = await fetch(checkUrl, { method: "HEAD", signal: AbortSignal.timeout(5000), headers: { "User-Agent": UA } });
      if (res.ok) {
        console.log(`[Maia] YouTube handle guess worked: ${checkUrl}`);
        return checkUrl;
      }
    } catch {}

    return null;
  }

  if (type === "rss") {
    // === RSS: try common patterns ===
    const domain = query.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9.-]/g, "");
    const rssGuesses = [
      `https://${domain}/feed`,
      `https://${domain}/rss`,
      `https://feeds.feedburner.com/${domain}`,
      `https://${domain}/feed/rss`,
    ];
    for (const url of rssGuesses) {
      try {
        const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000), headers: { "User-Agent": UA } });
        if (res.ok) {
          console.log(`[Maia] RSS found: ${url}`);
          return url;
        }
      } catch {}
    }

    // Try DuckDuckGo for RSS
    try {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " RSS feed xml")}`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const html = await res.text();
        const rssMatch = html.match(/href="(https?:\/\/[^"]*(?:feed|rss|xml|atom)[^"]*)"/i);
        if (rssMatch) return rssMatch[1];
      }
    } catch {}

    return null;
  }

  // === Website: DuckDuckGo search ===
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " site oficial")}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const html = await res.text();
      const urlMatch = html.match(/href="(https:\/\/[^"]+)"/);
      if (urlMatch && !urlMatch[1].includes("duckduckgo")) return urlMatch[1];
    }
  } catch {}

  return null;
}

// --------------- Action Types ---------------

type MaiaAction =
  | { type: "create_source"; sourceType: string; name: string; config: Record<string, any>; topic?: string; theme?: string }
  | { type: "search_url"; query: string; urlType: "rss" | "youtube" | "website" }
  | { type: "update_schedule"; times: string[] }
  | { type: "list_sources" }
  | { type: "delete_source"; name: string }
  | { type: "toggle_source"; name: string; active: boolean }
  | { type: "change_theme"; name: string; theme: string }
  | { type: "generate_now" }
  | { type: "dashboard_stats" }
  | { type: "list_digests" }
  | { type: "chat_digest"; question: string }
  | { type: "show_themes" }
  | { type: "search_flights"; origin: string; destination: string; dates?: string; passengers?: number; children?: number }
  | { type: "search_products"; query: string }
  | { type: "none" };

function parseAction(text: string): { cleanText: string; action: MaiaAction } {
  // Parse ACTION tag - supports nested JSON like {"config":{"url":"..."}}
  const actionStart = text.indexOf("[ACTION:");
  if (actionStart === -1) return { cleanText: text.trim(), action: { type: "none" } };

  const actionEnd = text.indexOf("[/ACTION]", actionStart);
  if (actionEnd === -1) return { cleanText: text.trim(), action: { type: "none" } };

  const fullTag = text.slice(actionStart, actionEnd + 9);
  const cleanText = text.replace(fullTag, "").trim();

  // Extract action type
  const typeMatch = fullTag.match(/\[ACTION:(\w+)\]/);
  if (!typeMatch) return { cleanText, action: { type: "none" } };
  const actionType = typeMatch[1];

  // Extract JSON data (everything between first { and last } within the tag)
  let data: any = {};
  const jsonStart = fullTag.indexOf("{");
  const jsonEnd = fullTag.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try { data = JSON.parse(fullTag.slice(jsonStart, jsonEnd + 1)); } catch { data = {}; }
  }


  switch (actionType) {
    case "CREATE_SOURCE":
      return {
        cleanText,
        action: {
          type: "create_source",
          sourceType: data.source_type || data.type || "estudo",
          name: data.name || data.topic || "",
          config: data.config || {},
          topic: data.topic || data.name || "",
          theme: data.theme,
        },
      };
    case "SEARCH_URL":
      return {
        cleanText,
        action: {
          type: "search_url",
          query: data.query || "",
          urlType: data.url_type || "website",
        },
      };
    case "UPDATE_SCHEDULE":
      return { cleanText, action: { type: "update_schedule", times: data.times || [] } };
    case "LIST_SOURCES":
      return { cleanText, action: { type: "list_sources" } };
    case "DELETE_SOURCE":
      return { cleanText, action: { type: "delete_source", name: data.name || "" } };
    case "TOGGLE_SOURCE":
      return { cleanText, action: { type: "toggle_source", name: data.name || "", active: data.active ?? true } };
    case "CHANGE_THEME":
      return { cleanText, action: { type: "change_theme", name: data.name || "", theme: data.theme || "conversa" } };
    case "GENERATE_NOW":
      return { cleanText, action: { type: "generate_now" } };
    case "DASHBOARD_STATS":
      return { cleanText, action: { type: "dashboard_stats" } };
    case "LIST_DIGESTS":
      return { cleanText, action: { type: "list_digests" } };
    case "CHAT_DIGEST":
      return { cleanText, action: { type: "chat_digest", question: data.question || "" } };
    case "SHOW_THEMES":
    case "SEARCH_FLIGHTS":
      return {
        cleanText,
        action: {
          type: "search_flights",
          origin: data.origin || data.from || "",
          destination: data.destination || data.to || "",
          dates: data.dates || data.date || data.period || undefined,
          passengers: data.passengers || data.adults || 1,
          children: data.children || data.kids || 0,
        },
      };
    case "SEARCH_PRODUCTS":
      return {
        cleanText,
        action: {
          type: "search_products",
          query: data.query || data.product || "",
        },
      };
      return { cleanText, action: { type: "show_themes" } };
    default:
      return { cleanText, action: { type: "none" } };
  }
}

// --------------- Action Execution ---------------

async function executeAction(userId: string, action: MaiaAction): Promise<string | null> {
  if (action.type === "create_source") {
    const validTypes = ["rss", "youtube", "news", "http_request", "webhook", "google_shopping", "estudo"];
    const sourceType = validTypes.includes(action.sourceType) ? action.sourceType : "estudo";

    // Build config based on type
    let config = action.config;
    if (sourceType === "estudo" && !config.study_topic) {
      config = { study_topic: action.topic || action.name };
    }

    // For types that need URLs, try to search if not provided
    if (sourceType === "rss" && !config.url) {
      return "Me manda o link do feed RSS que você quer acompanhar!";
    }
    if (sourceType === "youtube" && !config.url) {
      return "Me manda o link do canal do YouTube que você quer acompanhar!";
    }
    if (sourceType === "http_request" && !config.url) {
      return "Me manda o link do site que você quer acompanhar!";
    }

    const sourceName = action.name || (config.study_topic || config.url || "Nova fonte").slice(0, 50);
    const theme = action.theme || (sourceType === "estudo" ? "estudo" : "conversa");

    const { error } = await supabaseAdmin.from("source_connections").insert({
      user_id: userId,
      type: sourceType,
      name: sourceName,
      config,
      is_active: true,
      podcast_theme: theme,
    });

    if (error) {
      console.error("[Maia] Create source error:", error.message);
      return "Ops, erro ao criar a fonte: " + error.message;
    }
    console.log(`[Maia] Created source "${sourceName}" (${sourceType}) for ${userId}`);
    return null;
  }

  if (action.type === "search_url") {
    if (!action.query) return "Preciso saber o que você quer buscar.";
    const url = await searchForUrl(action.query, action.urlType);
    if (url) return `Encontrei: ${url}`;
    return `Não consegui encontrar a URL para "${action.query}". Tenta me dar mais detalhes?`;
  }

  if (action.type === "update_schedule") {
    const validTimes = (action.times || []).filter((t) => /^\d{2}:\d{2}$/.test(t));
    if (!validTimes.length) return "Não entendi os horários. Use formato HH:MM.";
    const { error } = await supabaseAdmin.from("user_settings").update({ schedule_times: validTimes }).eq("user_id", userId);
    if (error) return "Erro ao atualizar: " + error.message;
    console.log(`[Maia] Updated schedule for ${userId}: ${validTimes.join(", ")}`);
    return null;
  }

  if (action.type === "list_sources") {
    const { data: sources } = await supabaseAdmin
      .from("source_connections")
      .select("name, type, podcast_theme, is_active")
      .eq("user_id", userId);
    if (!sources?.length) return "Você não tem nenhuma fonte cadastrada.";
    const active = sources.filter((s) => s.is_active);
    const inactive = sources.filter((s) => !s.is_active);
    let result = "";
    if (active.length) {
      result += "Fontes ativas:\n" + active.map((s, i) => `${i + 1}. ${s.name} (${s.type}) - tema: ${s.podcast_theme || "padrão"}`).join("\n");
    }
    if (inactive.length) {
      result += (result ? "\n\n" : "") + "Fontes inativas:\n" + inactive.map((s, i) => `${i + 1}. ${s.name} (${s.type})`).join("\n");
    }
    return result || "Nenhuma fonte encontrada.";
  }

  if (action.type === "delete_source") {
    if (!action.name) return null;
    const { data: sources } = await supabaseAdmin
      .from("source_connections")
      .select("id, name")
      .eq("user_id", userId);
    const target = sources?.find((s) => normalize(s.name).includes(normalize(action.name)));
    if (!target) return `Não encontrei fonte "${action.name}".`;
    await supabaseAdmin.from("source_connections").update({ is_active: false }).eq("id", target.id);
    console.log(`[Maia] Deactivated source "${target.name}"`);
    return null;
  }

  if (action.type === "toggle_source") {
    if (!action.name) return "Preciso do nome da fonte.";
    const { data: sources } = await supabaseAdmin
      .from("source_connections")
      .select("id, name, is_active")
      .eq("user_id", userId);
    const target = sources?.find((s) => normalize(s.name).includes(normalize(action.name)));
    if (!target) return `Não encontrei fonte "${action.name}".`;
    await supabaseAdmin.from("source_connections").update({ is_active: action.active }).eq("id", target.id);
    console.log(`[Maia] Toggled source "${target.name}" to ${action.active}`);
    return null;
  }

  if (action.type === "change_theme") {
    if (!action.name) return "Preciso do nome da fonte.";
    const validThemes = ["conversa", "aula", "jornalístico", "resumo", "comentários", "storytelling", "estudo_bíblico", "debate", "entrevista", "motivacional", "estudo"];
    if (!validThemes.includes(action.theme)) {
      return `Tema "${action.theme}" não disponível. Opcoes: ${validThemes.join(", ")}`;
    }
    const { data: sources } = await supabaseAdmin
      .from("source_connections")
      .select("id, name")
      .eq("user_id", userId)
      .eq("is_active", true);
    const target = sources?.find((s) => normalize(s.name).includes(normalize(action.name)));
    if (!target) return `Não encontrei fonte ativa "${action.name}".`;
    await supabaseAdmin.from("source_connections").update({ podcast_theme: action.theme }).eq("id", target.id);
    console.log(`[Maia] Changed theme of "${target.name}" to ${action.theme}`);
    return null;
  }

  if (action.type === "generate_now") {
    const { data: job, error } = await supabaseAdmin.from("digest_jobs").insert({
      user_id: userId, status: "pending", scheduled_at: new Date().toISOString(),
    }).select().single();
    if (error) { console.error("[Maia] Generate now error:", error.message); return "Erro ao gerar: " + error.message; }
    try {
      const { Queue } = await import("bullmq");
      const queue = new Queue("digest-generation", { connection: redis as any });
      await queue.add("generate", { jobId: job.id, userId });
      console.log(`[Maia] Queued immediate digest for ${userId}: ${job.id}`);
    } catch (err: any) {
      console.error("[Maia] Queue error:", err.message);
      return "Erro ao enfileirar: " + err.message;
    }
    return null;
  }

  if (action.type === "dashboard_stats") {
    try {
      const [sourcesRes, digestsRes, recentRes, settingsRes] = await Promise.all([
        supabaseAdmin.from("source_connections").select("type, is_active").eq("user_id", userId),
        supabaseAdmin.from("digest_jobs").select("id, status").eq("user_id", userId),
        supabaseAdmin.from("digest_jobs").select("id, status, created_at").eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(5),
        supabaseAdmin.from("user_settings").select("schedule_times").eq("user_id", userId).single(),
      ]);

      const sources = sourcesRes.data || [];
      const activeSources = sources.filter((s) => s.is_active).length;
      const totalSources = sources.length;
      const typeCount: Record<string, number> = {};
      sources.filter((s) => s.is_active).forEach((s) => { typeCount[s.type] = (typeCount[s.type] || 0) + 1; });

      const digests = digestsRes.data || [];
      const completedDigests = digests.filter((d) => d.status === "completed").length;
      const pendingDigests = digests.filter((d) => d.status === "pending").length;

      const recent = recentRes.data || [];
      const scheduleTimes = settingsRes.data?.schedule_times || [];

      let stats = `Dashboard PodcastIA:\n`;
      stats += `- Fontes: ${activeSources} ativas / ${totalSources} total\n`;
      if (Object.keys(typeCount).length) {
        stats += `- Tipos: ${Object.entries(typeCount).map(([t, c]) => `${t}(${c})`).join(", ")}\n`;
      }
      stats += `- Podcasts gerados: ${completedDigests}\n`;
      if (pendingDigests) stats += `- Pendentes: ${pendingDigests}\n`;
      if (scheduleTimes.length) stats += `- Horarios: ${scheduleTimes.join(", ")}\n`;
      if (recent.length) {
        stats += `- Últimos 5:\n`;
        recent.forEach((d) => {
          const date = new Date(d.created_at).toLocaleDateString("pt-BR");
          stats += `  ${date} - ${d.status}\n`;
        });
      }
      return stats;
    } catch (err: any) {
      console.error("[Maia] Dashboard error:", err.message);
      return "Erro ao buscar estatísticas.";
    }
  }

  if (action.type === "list_digests") {
    const { data: digests } = await supabaseAdmin
      .from("digest_jobs")
      .select("id, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!digests?.length) return "Nenhum podcast gerado ainda.";

    let result = "Últimos podcasts:\n";
    digests.forEach((d, i) => {
      const date = new Date(d.created_at).toLocaleDateString("pt-BR");
      const time = new Date(d.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const statusEmoji = d.status === "completed" ? "OK" : d.status === "pending" ? "Aguardando" : d.status === "processing" ? "Gerando" : d.status;
      result += `${i + 1}. ${date} ${time} - ${statusEmoji}\n`;
    });
    return result;
  }

if (action.type === "search_flights") {
    if (!action.origin || !action.destination) return "Preciso saber a origem e o destino. Ex: passagem de Sao Paulo para Rio de Janeiro.";
    console.log('[Maia] Searching flights:', action.origin, '->', action.destination);
    const result = await searchFlights(action.origin, action.destination, { dates: action.dates, passengers: action.passengers, children: action.children });
    return result;
  }

  if (action.type === "search_products") {
    if (!action.query) return "Preciso saber qual produto voce quer buscar.";
    console.log('[Maia] Searching products:', action.query);
    const result = await searchProducts(action.query);
    return result;
  }

  if (action.type === "show_themes") {
    return "__SHOW_THEMES__";
  }

  if (action.type === "chat_digest") {
    const { data: recentDigests } = await supabaseAdmin
      .from("digests")
      .select("id, title, text_content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!recentDigests?.length) return "Você ainda não tem nenhum podcast gerado. Quer que eu crie um?";

    const question = action.question.toLowerCase();
    let bestDigest = recentDigests[0];

    for (const d of recentDigests) {
      const titleLower = (d.title || "").toLowerCase();
      const contentLower = (d.text_content || "").toLowerCase().slice(0, 2000);
      const questionWords = question.split(/\s+/).filter((w: string) => w.length > 3);
      const matches = questionWords.filter((w: string) => titleLower.includes(w) || contentLower.includes(w));
      if (matches.length > 0) { bestDigest = d; break; }
    }

    if (!bestDigest.text_content) return "Esse podcast não tem conteúdo de texto disponível.";

    const digestContext = bestDigest.text_content.slice(0, 6000);
    const chatPrompt = "Baseado no podcast \"" + (bestDigest.title || "Podcast") + "\":\n\n" + digestContext + "\n\nPergunta: " + action.question;

    try {
      const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.OPENAI_API_KEY },
        body: JSON.stringify({
          model: "gpt-4o-mini", max_tokens: 1500,
          messages: [
            { role: "system", content: "Você responde duvidas sobre o conteúdo de um podcast. Respostas CONCISAS em português brasileiro, pois serão convertidas em audio. Fale de forma natural e direta." },
            { role: "user", content: chatPrompt },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!chatRes.ok) return "Desculpa, não consegui processar sua pergunta.";
      const chatData = (await chatRes.json()) as any;
      return chatData.choices?.[0]?.message?.content || "Não consegui encontrar essa informação no podcast.";
    } catch {
      return "Ops, tive um probleminha ao buscar no podcast.";
    }
  }

  return null;
}

// --------------- System Prompt ---------------

function getSystemPrompt(userName: string): string {
  return `Você e a Maia, assistente pessoal de podcasts do ${userName} via WhatsApp. Você cria, gerencia e tira duvidas sobre os podcasts gerados.

PERSONALIDADE: Amigável, objetiva, português brasileiro informal. Respostas CURTAS (2-3 frases max). Fale de forma natural pois sua resposta será convertida em AUDIO.

IMPORTANTE: Você só fala sobre PODCASTS e os assuntos dos podcasts gerados. Se ${userName} perguntar algo que não tem relação com podcasts ou com o conteúdo dos podcasts dele, diga educadamente que você e especialista em podcasts.

TIRAR DUVIDAS SOBRE PODCASTS:
- Quando ${userName} perguntar algo sobre um assunto que foi tema de podcast, use a ação CHAT_DIGEST para buscar o conteúdo e responder com base nele
- Exemplos: "o que o podcast falou sobre sepse?", "quais foram os pontos principais?", "explica melhor aquela parte sobre tratamento"
- Você pode responder perguntas técnicas DESDE QUE baseadas no conteúdo dos podcasts gerados

SUAS CAPACIDADES IMPORTANTES:
- Você ASSISTE vídeos do YouTube usando Gemini (processa o conteúdo real dos vídeos)
- Quando o usuário pede um canal YouTube, os vídeos são baixados e assistidos pela IA para gerar o podcast
- NUNCA diga que não consegue assistir vídeos ou acessar conteúdo de vídeos

VOCÊ PODE VER CONTEÚDO MULTIMÍDIA:
- Se o usuário enviar AUDIO/VOZ, você recebe a transcrição automática entre [AUDIO] e [/AUDIO]
- Se enviar IMAGEM, você recebe a descrição entre [IMAGEM] e [/IMAGEM]
- Se enviar DOCUMENTO/PDF, você recebe o texto extraído entre [DOCUMENTO] e [/DOCUMENTO]
- Responda naturalmente ao conteúdo mídia como se você tivesse visto/ouvido

TIPOS DE FONTE QUE VOCE PODE CRIAR:
1. estudo: Tema de estudo livre. config: {"study_topic": "descrição do tema"}
2. youtube: Canal do YouTube. config: {"channel_url": "URL do canal"}
3. rss: Feed RSS de blog/site. config: {"feed_url": "URL do feed"}
4. news: Notícias por palavras-chave. config: {"keywords": ["palavra1"], "topics": ["topico1"]}
5. http_request: Pagina web qualquer. config: {"url": "URL", "method": "GET"}
6. webhook: Dados externos via webhook. config: {"webhook_token": "token"}
7. google_shopping: Precos e produtos. config: {"search_terms": ["termo1"]}

TEMAS DE ÁUDIO DISPONÍVEIS (NÃO liste os temas no seu texto - a lista é enviada automaticamente por texto formatado):
1. conversa — Dois amigos conversando no bar sobre o assunto, com piadas e histórias pessoais. Clima leve e descontraído.
2. aula — Estilo professor e aluno. A Maia ensina com perguntas socráticas e o Raphael tenta responder. Didático e interativo.
3. jornalístico — Formato telejornal profissional. Apresentação formal com reportagens e dados. Sério e informativo.
4. resumo — Briefing executivo rápido. Só os pontos essenciais, sem enrolação. Direto ao ponto em poucos minutos.
5. comentários — Os dois discordam sobre cada tema. Um analítico, outro prático. Gera reflexão com opiniões opostas.
6. storytelling — Contação de histórias. Transforma o conteúdo em narrativas com personagens, suspense e emoção.
7. estudo — Aula universitária de nível técnico. Conteúdo acadêmico com terminologia científica, como um livro-texto.
8. debate — Debate acalorado. Cada um defende uma posição oposta com argumentos e contra-argumentos. Intenso e apaixonado.
9. entrevista — Formato jornalista entrevistando especialista. Perguntas provocativas com respostas baseadas em dados.
10. motivacional — Conteúdo inspirador com energia alta. Desafios, superação e call-to-action no final.

FLUXO DE CRIACAO DE FONTE:
Quando ${userName} pedir uma fonte/podcast sobre algo, siga OBRIGATORIAMENTE estes passos EM ORDEM:
1. Identifique o TIPO correto da fonte pelo contexto (YouTube, RSS, notícias, estudo, etc)
2. Confirme que entendeu o pedido e pergunte se quer receber agora ou no horário agendado
3. OBRIGATÓRIO: Pergunte qual estilo de áudio prefere. Diga apenas: "Te mandei a lista de estilos, escolhe o que mais combina com você!" seguido de [ACTION:SHOW_THEMES][/ACTION]. NÃO liste os temas no seu texto, NÃO mencione nomes de temas específicos como "conversa ou comentários". A lista formatada é enviada automaticamente por texto.
4. Somente APÓS o usuário escolher o tema, execute a criação da fonte

IMPORTANTE: NUNCA crie a fonte sem antes perguntar o estilo de áudio. O passo 3 é OBRIGATÓRIO.

EXEMPLOS de como criar cada tipo:
- "quero acompanhar o Primo Rico no YouTube" -> CREATE_SOURCE com source_type=youtube, nome=Primo Rico
- "quero notícias sobre IA" -> CREATE_SOURCE com source_type=news, config com keywords
- "adiciona o RSS do TechCrunch" -> CREATE_SOURCE com source_type=rss, nome=TechCrunch
- "quero estudar física quântica" -> CREATE_SOURCE com source_type=estudo
- "monitora precos de iPhone" -> CREATE_SOURCE com source_type=google_shopping
- "acompanha esse site: url.com" -> CREATE_SOURCE com source_type=http_request

ACOES DISPONIVEIS (use SOMENTE quando tiver as informações):
1. CRIAR FONTE: [ACTION:CREATE_SOURCE]{"source_type":"tipo","name":"nome","topic":"descricao ou URL","theme":"conversa"}[/ACTION]
2. BUSCAR URL: [ACTION:SEARCH_URL]{"query":"o que buscar","url_type":"rss|youtube|website"}[/ACTION]
3. ALTERAR HORARIOS: [ACTION:UPDATE_SCHEDULE]{"times":["HH:MM"]}[/ACTION]
4. LISTAR FONTES: [ACTION:LIST_SOURCES][/ACTION]
5. REMOVER FONTE: [ACTION:DELETE_SOURCE]{"name":"nome"}[/ACTION]
6. ATIVAR/DESATIVAR FONTE: [ACTION:TOGGLE_SOURCE]{"name":"nome","active":true}[/ACTION]
7. MUDAR TEMA AUDIO: [ACTION:CHANGE_THEME]{"name":"nome da fonte","theme":"tema"}[/ACTION]
8. GERAR AGORA: [ACTION:GENERATE_NOW][/ACTION]
9. VER DASHBOARD: [ACTION:DASHBOARD_STATS][/ACTION]
10. VER HISTÓRICO: [ACTION:LIST_DIGESTS][/ACTION]
11. TIRAR DUVIDA SOBRE PODCAST: [ACTION:CHAT_DIGEST]{"question":"pergunta do usuário"}[/ACTION] — Use quando o usuário perguntar sobre conteúdo de um podcast gerado
12. MOSTRAR TEMAS DE ÁUDIO: [ACTION:SHOW_THEMES][/ACTION] — Use SEMPRE que for perguntar qual tema/estilo de áudio o usuário prefere. Envia lista formatada por texto automaticamente
13. BUSCAR PASSAGENS: [ACTION:SEARCH_FLIGHTS]{"origin":"cidade origem","destination":"cidade destino","dates":"periodo","passengers":1,"children":0}[/ACTION] — Busca passagens aereas mais baratas ida e volta no Google. OBRIGATORIO: antes de buscar, pergunte ao usuario: 1) De onde para onde? 2) Quantos adultos? 3) Tem crianca? Quantas? 4) Qual periodo/datas? Se o usuario ja informou tudo, busque direto.
14. BUSCAR PRODUTOS: [ACTION:SEARCH_PRODUCTS]{"query":"nome do produto"}[/ACTION] — Busca os precos mais baratos de produtos direto no Google Shopping

REGRAS CRITICAS:
- MÁXIMO UMA action tag por mensagem, SEMPRE no FINAL da resposta
- Sem ação = sem tags
- Horários formato HH:MM (24h BRT)
- Nomes curtos e descritivos
- Para YouTube/RSS/HTTP, SEMPRE peça o link ao usuário antes de criar a fonte

REGRA MAIS IMPORTANTE - NUNCA QUEBRE ESTA REGRA:
- Quando você disser que vai fazer algo (criar fonte, gerar podcast, listar, etc), você DEVE incluir a action tag correspondente NA MESMA MENSAGEM.
- NUNCA diga "vou criar" sem incluir [ACTION:CREATE_SOURCE]...[/ACTION] na mesma resposta.
- NUNCA diga "vou gerar" sem incluir [ACTION:GENERATE_NOW][/ACTION] na mesma resposta.
- Quando o usuario perguntar sobre passagens aereas, voos, ou viagens, use [ACTION:SEARCH_FLIGHTS] com origin e destination.
- Quando o usuario perguntar sobre precos de produtos, ofertas, ou compras, use [ACTION:SEARCH_PRODUCTS] com o nome do produto.
- SEARCH_FLIGHTS e SEARCH_PRODUCTS buscam direto no Google em tempo real e retornam os menores precos.
- FLUXO PASSAGENS OBRIGATORIO: Se o usuario pedir passagem mas NAO informar todos os dados, PERGUNTE antes de buscar:
  1) Origem e destino (se faltou algum)
  2) Quantos passageiros adultos?
  3) Tem crianca viajando? Quantas e qual idade?
  4) Qual periodo ou datas flexiveis?
  Quando tiver TODAS as infos, execute SEARCH_FLIGHTS com origin, destination, dates, passengers e children.
- Se o usuario ja informou tudo na mesma mensagem, busque direto sem perguntar.
- Nos resultados de passagens, SEMPRE destaque: escalas (cidade + tempo de conexao), duracao total do voo, companhia aerea e melhor periodo.
- NUNCA diga "vou buscar" sem incluir [ACTION:SEARCH_URL]...[/ACTION] na mesma resposta.
- Se você promete uma ação mas não inclui a tag, a ação NÃO acontece e o usuário fica esperando.
- Após executar a ação, SEMPRE confirme o resultado E pergunte: "Quer que eu gere o podcast agora ou prefere receber no horário agendado?"

FLUXO COMPLETO DE EXEMPLOS:

Exemplo 1 - YouTube:
Usuario: "quero acompanhar o Primo Rico no YouTube"
Sua resposta: "Legal! Me manda o link do canal do Primo Rico no YouTube!"
Usuario: "https://www.youtube.com/@primorico"
Sua resposta: "Criei a fonte do Primo Rico! Quer que eu gere agora ou prefere agendar? [ACTION:CREATE_SOURCE]{"source_type":"youtube","name":"Primo Rico","topic":"Primo Rico","config":{"url":"https://www.youtube.com/@primorico"},"theme":"comentários"}[/ACTION]"

Exemplo 2 - Estudo (não precisa de link):
Usuario: "quero estudar farmacologia"
Sua resposta: "Criei a fonte de estudo sobre farmacologia! Quer que eu gere agora? [ACTION:CREATE_SOURCE]{"source_type":"estudo","name":"Farmacologia","topic":"Farmacologia completa","theme":"estudo"}[/ACTION]"

Exemplo 3 - Notícias (não precisa de link):
Usuario: "quero notícias sobre inteligência artificial"
Sua resposta: "Criei a fonte de notícias sobre IA! [ACTION:CREATE_SOURCE]{"source_type":"news","name":"Inteligência Artificial","topic":"inteligência artificial","theme":"conversa"}[/ACTION]"

IMPORTANTE: Fontes tipo "estudo" e "news" NÃO precisam de link. Só YouTube, RSS e HTTP precisam.

- Se o usuário responder de forma objetiva com tudo de uma vez, execute direto sem perguntar`;
}

// --------------- Main Process ---------------

/**
 * Detect intent from GPT response when ACTION tags are missing.
 * GPT-4o-mini often describes actions in natural language without including the tags.
 * This function detects those patterns and returns the appropriate action.
 */
function detectIntentFromResponse(response: string, userMessage: string): MaiaAction {
  const r = response.toLowerCase();

  // Only detect if GPT did NOT include ACTION tags
  if (response.includes("[ACTION:")) return { type: "none" };

  // ZERO: If user message IS a URL, GPT should be handling it via CREATE_SOURCE
  // But if GPT just asks for the link again, detect and create directly
  const urlInUser = userMessage.match(/https?:\/\/[^\s"'<>]+/);
  if (urlInUser && (r.includes("me manda") || r.includes("manda o link") || r.includes("pode me passar") || r.includes("me envia"))) {
    // GPT is asking for URL but user already sent one! Create directly.
    const url = urlInUser[0].split("?")[0];
    let sourceType = "http_request";
    let name = url;
    if (url.includes("youtube.com")) { sourceType = "youtube"; name = url.replace(/https?:\/\/(?:www\.)?youtube\.com\/@?/, "").replace(/\/.*/, ""); }
    else if (url.includes("feed") || url.includes("rss") || url.includes(".xml")) { sourceType = "rss"; name = url; }
    console.log("[Maia] URL-in-message detected while GPT asks for link. Creating directly: " + sourceType + " " + url);
    return { type: "create_source", sourceType, name: name || "Nova fonte", config: { url }, topic: name, theme: "conversa" };
  }

// DETECT FLIGHTS: user asks about flights/passagens
  const u = userMessage.toLowerCase();
  if (u.match(/passag|voo|voar|aere|flight/) && u.match(/para |pra |-> |→ /)) {
    // Extract origin and destination from user message
    const fromTo = u.match(/(?:de|from|saindo de)s+([ws]+?)s+(?:para|pra|to|→|->)s+([ws]+?)(?:s+(?:ida|em|no dia|dia|date)|[.,!?]|$)/i);
    if (fromTo) {
      const origin = fromTo[1].trim();
      const dest = fromTo[2].trim();
      console.log("[Maia] Intent detected: SEARCH_FLIGHTS", origin, "->", dest);
    }
  }

  // DETECT PRODUCTS: user asks about product prices
  if (u.match(/pre[cç]o|quanto custa|mais barato|comprar|onde encontr|oferta/) && !u.match(/passag|voo|aere/)) {
    const productMatch = u.match(/(?:pre[cç]o|quanto custa|mais barato|comprar|onde encontr|oferta)s+(?:de?s+|do?s+|da?s+)?(.+)/i);
    if (productMatch) {
      const query = productMatch[1].replace(/[?!.,]+$/g, "").trim();
      if (query.length > 2) {
        console.log("[Maia] Intent detected: SEARCH_PRODUCTS", query);
        return { type: "search_products", query };
      }
    }
  }

  // FIRST: Detect "vou gerar" / "gerar agora" (priority over "vou criar")
  if ((r.includes("vou gerar") || r.includes("gerando agora") || r.includes("gerar o podcast") || r.includes("gerar agora") || r.includes("gerando o podcast")) && !response.includes("[ACTION:")) {
    console.log("[Maia] Intent detected: GENERATE_NOW");
    return { type: "generate_now" };
  }

  // Detect "vou criar a fonte" / "criei" / "criando"
  if (r.includes("vou criar") || r.includes("criei") || r.includes("criando a fonte")) {

    // Extract source type FROM GPT RESPONSE (it mentions YouTube, RSS, etc.)
    let sourceType = "estudo";
    if (r.includes("youtube") || r.includes("canal")) sourceType = "youtube";
    else if (r.includes("rss") || r.includes("feed")) sourceType = "rss";
    else if (r.includes("notícia") || r.includes("noticia")) sourceType = "news";

    // Extract name: look for proper nouns in GPT response (capitalized words after "canal", "fonte", etc.)
    let name = "";
    // Try to find name pattern: "canal do X" or "fonte sobre X" or "sobre X"
    const namePatterns = [
      /canal (?:do |da |dos |das )?(.+?)(?:\s+com|\s+no|\s*\.|\s*!|\s*,)/i,
      /fonte (?:sobre |do |da )?(.+?)(?:\s+com|\s+no|\s*\.|\s*!|\s*,)/i,
      /vídeos (?:do |da )?(.+?)(?:\s+com|\s+no|\s*\.|\s*!|\s*,)/i,
      /podcast (?:sobre |do |da )?(.+?)(?:\s+com|\s+no|\s*\.|\s*!|\s*,)/i,
    ];
    for (const pattern of namePatterns) {
      const m = response.match(pattern);
      if (m && m[1]) {
        name = m[1].trim().replace(/["]/g, "");
        break;
      }
    }
    // Fallback: quoted text in response
    if (!name) {
      const quoteMatch = response.match(/"([^"]{3,50})"/);
      if (quoteMatch) name = quoteMatch[1];
    }
    if (!name) name = "Nova fonte";

    // Extract theme from response
    let theme = "conversa";
    const themeMap: Record<string, string> = {
      "comentário": "comentários", "comentarios": "comentários",
      "conversa": "conversa", "aula": "aula", "debate": "debate",
      "entrevista": "entrevista", "motivacional": "motivacional",
      "storytelling": "storytelling", "resumo": "resumo",
      "jornalístico": "jornalístico", "jornalistico": "jornalístico",
      "estudo": "estudo",
    };
    // Look for theme keyword: 'tema "X"' or 'estilo X' or just theme name in context
    const themeQuote = response.match(/tema["\s]+([^".,!]+)/i) || response.match(/estilo["\s]+([^".,!]+)/i);
    if (themeQuote) {
      const key = themeQuote[1].trim().toLowerCase();
      if (themeMap[key]) theme = themeMap[key];
    } else {
      // Check if any theme name appears in the response
      for (const [key, val] of Object.entries(themeMap)) {
        if (r.includes(key)) { theme = val; break; }
      }
    }

    // Extract URL from user message or GPT response
    const urlMatch = userMessage.match(/https?:\/\/[^\s"'<>]+/) || response.match(/https?:\/\/[^\s"'<>]+/);
    const config: Record<string, any> = {};
    if (urlMatch) {
      config.url = urlMatch[0].split("?")[0]; // Clean query params
      console.log("[Maia] URL extracted:", config.url);
    }

    console.log("[Maia] Intent detected: CREATE_SOURCE type=" + sourceType + " name=" + name + " theme=" + theme + " url=" + (config.url || "none"));
    return { type: "create_source", sourceType, name, config, topic: name, theme };
  }



  // Detect listing sources
  if (r.includes("suas fontes") || r.includes("fontes ativas")) {
    console.log("[Maia] Intent detected: LIST_SOURCES");
    return { type: "list_sources" };
  }

  return { type: "none" };
}

export async function processMessage(userId: string, userName: string, text: string, mediaContext?: string): Promise<string> {
  // Build the final user text including media context
  let userText = text;
  if (mediaContext) {
    userText = mediaContext + (text ? `\n\n${text}` : "");
  }

  await addMessage(userId, "user", userText);
  await refreshTTL(userId);

  const history = await getHistory(userId);
  const messages = [
    { role: "system" as const, content: getSystemPrompt(userName) },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o", max_tokens: 1500, messages }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) { console.error("[Maia] GPT error:", res.status); return "Desculpa, tive um probleminha. Tenta de novo?"; }

    const data = (await res.json()) as any;
    const rawResponse = data.choices?.[0]?.message?.content || "Desculpa, não consegui processar.";
    const { cleanText, action } = parseAction(rawResponse);

    // Execute ACTION if GPT included the tag
    if (action.type !== "none") {
      console.log("[Maia] ACTION tag found:", action.type);
      const result = await executeAction(userId, action);
      if (result) {
        const finalText = cleanText ? `${cleanText}\n\n${result}` : result;
        await addMessage(userId, "assistant", finalText);
        return finalText;
      }
    }

    // Fallback: detect intent from natural language when GPT didn't use ACTION tags
    if (action.type === "none") {
      const detectedAction = detectIntentFromResponse(rawResponse, userText);
      if (detectedAction.type !== "none") {
        console.log("[Maia] Executing detected action:", detectedAction.type);
        const result = await executeAction(userId, detectedAction);
        if (result) {
          // executeAction returned a message (e.g. "me manda o link" or error)
          console.log("[Maia] Action result:", result.slice(0, 80));
          await addMessage(userId, "assistant", result);
          return result;
        }
        // Action executed successfully - REPLACE GPT response with clear confirmation
        const actionName = (detectedAction as any).name || "fonte";
        const confirmed = `Pronto! Fonte "${actionName}" criada com sucesso! Quer que eu gere o podcast agora ou prefere receber em um horário agendado?`;
        console.log("[Maia] Action success:", confirmed.slice(0, 80));
        await addMessage(userId, "assistant", confirmed);
        return confirmed;
      }
    }

    await addMessage(userId, "assistant", cleanText);
    return cleanText;
  } catch (err: any) {
    clearTimeout(timeout);
    console.error("[Maia] Error:", err.message);
    return "Ops, algo deu errado. Tenta novamente!";
  }
}

export async function getGreeting(userName: string, userId: string): Promise<string> {
  const hour = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCHours();
  const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // Check if user has previous history (returning user vs first time)
  const { count } = await supabaseAdmin
    .from("maia_chat_history")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (count && count > 0) {
    // Returning user - natural, short greeting like a friend
    return `${period}, ${userName}! No que posso te ajudar?`;
  }

  // First time - introduce herself
  return `${period}, ${userName}! Sou a Maia, sua assistente pessoal de podcasts. Me diz um assunto que quer aprender ou acompanhar e eu monto tudo pra você!`;
}

export function getFarewell(userName: string): string {
  return `Até mais, ${userName}! Quando precisar, é só me chamar.`;
}
