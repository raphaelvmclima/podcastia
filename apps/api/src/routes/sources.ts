import { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";
import { authMiddleware, getPlanLimits } from "../middleware/auth.js";
import { redis } from "../lib/redis.js";
import { execSync } from "child_process";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { randomUUID } from "crypto";

const UAZAPI_BASE = "https://loumarturismo.uazapi.com";
const UAZAPI_ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN || "";

async function getUserInstanceToken(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("user_settings").select("wa_instance_token").eq("user_id", userId).single();
  return data?.wa_instance_token || null;
}

async function uazFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${UAZAPI_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", token, ...options.headers },
  });
  return res.json();
}

async function uazAdminFetch(path: string, body: any) {
  const res = await fetch(`${UAZAPI_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", AdminToken: UAZAPI_ADMIN_TOKEN },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Fetch groups via curl to temp file (UAZAPI truncates large responses, exit code 56 is normal)
function fetchGroupsViaCurl(token: string): { id: string; name: string; type: string }[] {
  const tmpFile = `/tmp/uazapi_groups_${Date.now()}.json`;
  const seen = new Map<string, string>();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Write to file — even if curl exits with 56 (truncated), we get partial data
      try {
        execSync(
          `curl -s "${UAZAPI_BASE}/group/list" -H "token: ${token}" --compressed --max-time 120 -o ${tmpFile} 2>/dev/null`,
          { timeout: 130000 }
        );
      } catch {
        // exit code 56 (truncated) is expected — file still has partial data
      }

      // Read the (possibly truncated) file
      if (!existsSync(tmpFile)) continue;
      const output = readFileSync(tmpFile, "utf-8");

      const regex = /"JID":"([^"]+@g\.us)","OwnerJID":"[^"]*","OwnerPN":"[^"]*","Name":"([^"]*)"/g;
      let match;
      while ((match = regex.exec(output)) !== null) {
        if (!seen.has(match[1])) seen.set(match[1], match[2]);
      }

      try { unlinkSync(tmpFile); } catch {}
      console.log(`[Groups] Attempt ${attempt + 1}: found ${seen.size} groups (file: ${output.length} bytes)`);
      if (seen.size > 50) break;
    } catch (err: any) {
      console.error(`[Groups] Attempt ${attempt + 1} error: ${err.message}`);
    }
  }

  const groups = Array.from(seen.entries()).map(([id, name]) => ({ id, name, type: "group" }));
  groups.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`[Groups] Total unique groups: ${groups.length}`);
  return groups;
}

async function fetchContacts(token: string): Promise<{ id: string; name: string; type: string }[]> {
  try {
    const res = await fetch(`${UAZAPI_BASE}/contacts`, { headers: { token } });
    const data = (await res.json()) as any[];
    if (!Array.isArray(data)) return [];
    return data
      .filter((c) => c.jid?.endsWith("@s.whatsapp.net"))
      .map((c) => ({ id: c.jid, name: c.contact_name || c.contact_FirstName || c.jid.split("@")[0], type: "contact" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

function instanceName(userId: string): string {
  return `pdia_${userId.replace(/-/g, "").slice(0, 12)}`;
}

async function cacheGroups(userId: string, token: string) {
  const groups = fetchGroupsViaCurl(token);
  if (groups.length > 0) await redis.set(`wa_groups:${userId}`, JSON.stringify(groups), "EX", 600);
  return groups;
}

export async function sourcesRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authMiddleware);

  app.get("/api/sources", async (request) => {
    const { data } = await supabaseAdmin.from("source_connections").select("*").eq("user_id", request.userId).order("created_at", { ascending: false });
    return { sources: data || [] };
  });

  app.get("/api/sources/whatsapp/status", async (request) => {
    const token = await getUserInstanceToken(request.userId);
    if (!token) return { connected: false, state: "no_instance" };
    try {
      const data = await uazFetch("/instance/status", token);
      return {
        connected: data?.status?.connected === true && data?.status?.loggedIn === true,
        state: data?.instance?.status || "disconnected",
        name: data?.instance?.profileName || data?.instance?.name || "",
        number: data?.instance?.owner || "",
      };
    } catch { return { connected: false, state: "error" }; }
  });

  app.post("/api/sources/whatsapp/connect", async (request, reply) => {
    let token = await getUserInstanceToken(request.userId);
    if (!token) {
      const name = instanceName(request.userId);
      const result = await uazAdminFetch("/instance/create", { Name: name });
      if (result.token) {
        token = result.token;
        await supabaseAdmin.from("user_settings").update({ wa_instance_token: token, wa_instance_name: name }).eq("user_id", request.userId);
      } else {
        return reply.status(500).send({ error: "Falha ao criar instancia", details: result });
      }
    }
    const statusData = await uazFetch("/instance/status", token);
    if (statusData?.status?.connected && statusData?.status?.loggedIn) {
      return { status: "connected", name: statusData?.instance?.profileName || "" };
    }
    const connectData = await uazFetch("/instance/connect", token, { method: "POST", body: "{}" });
    if (connectData?.instance?.qrcode) {
      return { status: "qrcode", qrcode: connectData.instance.qrcode };
    }
    return { status: "pending", message: connectData?.response || "Aguardando..." };
  });

  app.post("/api/sources/whatsapp/disconnect", async (request) => {
    const token = await getUserInstanceToken(request.userId);
    if (token) { try { await uazFetch("/instance/disconnect", token, { method: "POST", body: "{}" }); } catch {} }
    await redis.del(`wa_groups:${request.userId}`);
    await redis.del(`wa_contacts:${request.userId}`);
    return { ok: true };
  });

  app.get("/api/sources/whatsapp/groups", async (request) => {
    const token = await getUserInstanceToken(request.userId);
    if (!token) return { items: [], total: 0, groupCount: 0, contactCount: 0 };

    const { search, filter } = request.query as { search?: string; filter?: string };
    const activeFilter = filter || "groups";

    const { data: userSources } = await supabaseAdmin.from("source_connections").select("config").eq("user_id", request.userId).eq("type", "whatsapp");
    const monitoredIds = new Set<string>();
    userSources?.forEach((s: any) => { (s.config?.monitoredGroups || []).forEach((id: string) => monitoredIds.add(id)); });

    let groups: { id: string; name: string; type: string }[] = [];
    let contacts: { id: string; name: string; type: string }[] = [];

    if (activeFilter === "all" || activeFilter === "groups") {
      const cached = await redis.get(`wa_groups:${request.userId}`);
      groups = cached ? JSON.parse(cached) : await cacheGroups(request.userId, token);
    }

    if (activeFilter === "all" || activeFilter === "contacts") {
      const cached = await redis.get(`wa_contacts:${request.userId}`);
      if (cached) { contacts = JSON.parse(cached); }
      else {
        contacts = await fetchContacts(token);
        if (contacts.length > 0) await redis.set(`wa_contacts:${request.userId}`, JSON.stringify(contacts), "EX", 600);
      }
    }

    let all = [...groups, ...contacts].map((item) => ({ ...item, isMonitored: monitoredIds.has(item.id) }));
    if (search?.trim()) {
      const term = search.toLowerCase().trim();
      all = all.filter((item) => item.name.toLowerCase().includes(term));
    }

    return { items: all.slice(0, 100), total: all.length, groupCount: groups.length, contactCount: contacts.length };
  });

  app.post("/api/sources/whatsapp/refresh-groups", async (request) => {
    const token = await getUserInstanceToken(request.userId);
    if (!token) return { ok: false };
    await redis.del(`wa_groups:${request.userId}`);
    await redis.del(`wa_contacts:${request.userId}`);
    const groups = await cacheGroups(request.userId, token);
    return { ok: true, groupCount: groups.length };
  });

  app.post("/api/sources/whatsapp/groups", async (request, reply) => {
    const { groups, podcast_theme } = request.body as { groups: { id: string; name: string }[]; podcast_theme?: string };
    if (!groups?.length) return reply.status(400).send({ error: "Nenhum item selecionado" });

    const limits = getPlanLimits(request.userPlan);
    const { count } = await supabaseAdmin.from("source_connections").select("*", { count: "exact", head: true }).eq("user_id", request.userId).eq("is_active", true);
    const available = limits.maxSources - (count || 0);
    if (groups.length > available) return reply.status(403).send({ error: `Limite: mais ${available} fonte(s)` });

    const token = await getUserInstanceToken(request.userId);
    const instName = instanceName(request.userId);

    // Configure webhook
    if (token) {
      try {
        await uazFetch("/webhook", token, {
          method: "POST",
          body: JSON.stringify({ url: `${process.env.APP_API_URL || "http://72.62.13.20:3001"}/api/webhooks/whatsapp`, enabled: true }),
        });
      } catch {}
    }

    const sources = groups.map((g) => ({
      user_id: request.userId, type: "whatsapp" as const, name: g.name,
      config: { monitoredGroups: [g.id], groupId: g.id, instanceName: instName, instanceToken: token },
      is_active: true,
      podcast_theme: podcast_theme || "conversa",
    }));

    const { data, error } = await supabaseAdmin.from("source_connections").insert(sources).select();
    if (error) return reply.status(400).send({ error: error.message });
    return { sources: data, count: data?.length };
  });

  app.post("/api/sources", async (request, reply) => {
    const { type, name, config, podcast_theme } = request.body as { type: string; name: string; config: any; podcast_theme?: string };
    const limits = getPlanLimits(request.userPlan);
    const { count } = await supabaseAdmin.from("source_connections").select("*", { count: "exact", head: true }).eq("user_id", request.userId).eq("is_active", true);
    if ((count || 0) >= limits.maxSources) return reply.status(403).send({ error: "Limite atingido" });

    // Validate estudo source
    if (type === "estudo" && !config?.study_topic?.trim()) {
      return reply.status(400).send({ error: "Descreva o tema que deseja estudar" });
    }

    // For webhook sources, generate unique token and URL
    const finalConfig = { ...config };
    if (type === "webhook") {
      const token = randomUUID();
      finalConfig.webhook_token = token;
      finalConfig.webhook_url = `${process.env.APP_API_URL || "https://api-podcastia.solutionprime.com.br"}/api/webhooks/source/${token}`;
    }

    const { data, error } = await supabaseAdmin.from("source_connections").insert({ user_id: request.userId, type, name, config: finalConfig, is_active: true, podcast_theme: podcast_theme || "conversa" }).select().single();
    if (error) return reply.status(400).send({ error: error.message });
    return { source: data };
  });

  app.delete("/api/sources/:id", async (request) => {
    const { id } = request.params as { id: string };
    await supabaseAdmin.from("source_connections").delete().eq("id", id).eq("user_id", request.userId);
    return { ok: true };
  });

  app.patch("/api/sources/:id/toggle", async (request) => {
    const { id } = request.params as { id: string };
    const { data: current } = await supabaseAdmin.from("source_connections").select("is_active").eq("id", id).eq("user_id", request.userId).single();
    const { data } = await supabaseAdmin.from("source_connections").update({ is_active: !current?.is_active }).eq("id", id).eq("user_id", request.userId).select().single();
    return { source: data };
  });


  app.patch("/api/sources/:id/theme", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { podcast_theme } = request.body as { podcast_theme: string };
    if (!podcast_theme) return reply.status(400).send({ error: "podcast_theme is required" });
    const { data, error } = await supabaseAdmin
      .from("source_connections")
      .update({ podcast_theme })
      .eq("id", id)
      .eq("user_id", request.userId)
      .select()
      .single();
    if (error) return reply.status(400).send({ error: error.message });
    return { source: data };
  });

  // ── File upload source ──
  app.post("/api/sources/upload", async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "Nenhum arquivo enviado" });

    const limits = getPlanLimits(request.userPlan);
    const { count } = await supabaseAdmin
      .from("source_connections")
      .select("*", { count: "exact", head: true })
      .eq("user_id", request.userId)
      .eq("is_active", true);
    if ((count || 0) >= limits.maxSources)
      return reply.status(403).send({ error: "Limite de fontes atingido" });

    const buffer = await data.toBuffer();
    const ext = data.filename?.split(".").pop() || "bin";
    const fileName = `${request.userId}/${randomUUID()}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("uploads")
      .upload(fileName, buffer, {
        contentType: data.mimetype,
        upsert: false,
      });

    if (uploadErr) return reply.status(500).send({ error: "Falha no upload: " + uploadErr.message });

    // Process content based on file type
    let extractedText = "";
    const mime = data.mimetype || "";

    if (mime === "application/pdf") {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const result = await pdfParse(buffer);
        extractedText = result.text?.slice(0, 50000) || "";
      } catch (e: any) {
        console.error("[Upload] PDF parse error:", e.message);
        extractedText = `[PDF: ${data.filename}]`;
      }
    } else if (mime.startsWith("image/")) {
      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent([
          "Descreva detalhadamente o conteudo desta imagem em portugues brasileiro. Extraia todo texto visivel.",
          { inlineData: { mimeType: mime, data: buffer.toString("base64") } },
        ]);
        extractedText = result.response.text() || `[Imagem: ${data.filename}]`;
      } catch (e: any) {
        console.error("[Upload] Image analysis error:", e.message);
        extractedText = `[Imagem: ${data.filename}]`;
      }
    } else if (mime.startsWith("text/")) {
      extractedText = buffer.toString("utf-8").slice(0, 50000);
    }

    // Save as source connection
    const { data: source, error: srcErr } = await supabaseAdmin
      .from("source_connections")
      .insert({
        user_id: request.userId,
        type: "file",
        name: data.filename || "Arquivo",
        config: {
          file_path: fileName,
          file_type: mime,
          file_size: buffer.length,
          original_name: data.filename,
        },
        is_active: true,
      })
      .select()
      .single();

    if (srcErr) return reply.status(400).send({ error: srcErr.message });

    // Save extracted content as captured message
    if (extractedText) {
      await supabaseAdmin.from("captured_messages").insert({
        user_id: request.userId,
        source_connection_id: source.id,
        source_type: "file",
        group_name: `Arquivo: ${data.filename}`,
        sender_name: "Upload",
        content: extractedText,
        media_type: "text",
        captured_at: new Date().toISOString(),
        processed: false,
      });
    }

    return { source, extracted: !!extractedText };
  });

}
