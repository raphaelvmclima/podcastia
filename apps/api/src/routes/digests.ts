import { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";
import { authMiddleware, getPlanLimits, requirePlan } from "../middleware/auth.js";
import { digestQueue } from "../services/queue.js";

export async function digestsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authMiddleware);

  // List digests
  app.get("/api/digests", async (request) => {
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
    const offset = (page - 1) * limit;

    const { data, count } = await supabaseAdmin
      .from("digests")
      .select("id, title, audio_url, audio_duration_seconds, sources_summary, created_at, delivered_at", { count: "exact" })
      .eq("user_id", request.userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    return { digests: data || [], total: count || 0, page, limit };
  });

  // Get single digest
  app.get("/api/digests/:id", async (request) => {
    const { id } = request.params as { id: string };

    const { data } = await supabaseAdmin
      .from("digests")
      .select("*")
      .eq("id", id)
      .eq("user_id", request.userId)
      .single();

    return { digest: data };
  });

  // Generate digest now (Pro+)
  app.post("/api/digests/generate-now", async (request, reply) => {
    const limits = getPlanLimits(request.userPlan);
    if (!["pro", "business"].includes(request.userPlan)) {
      return reply.status(403).send({ error: "Disponível apenas para planos Pro e Business" });
    }

    // Check daily limit
    const today = new Date().toISOString().split("T")[0];
    const { count } = await supabaseAdmin
      .from("digest_jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", request.userId)
      .gte("created_at", `${today}T00:00:00`)
      .in("status", ["pending", "processing", "done"]);

    if ((count || 0) >= limits.maxDigestsPerDay) {
      return reply.status(429).send({ error: "Limite diário de resumos atingido" });
    }

    // Create job
    const { data: job } = await supabaseAdmin
      .from("digest_jobs")
      .insert({
        user_id: request.userId,
        status: "pending",
        scheduled_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Enqueue
    await digestQueue.add("generate", { jobId: job!.id, userId: request.userId });

    return { job };
  });

  // Chat about a digest
  app.post("/api/digests/:id/chat", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { message } = request.body as { message: string };

    const { data: digest } = await supabaseAdmin
      .from("digests")
      .select("text_content, title")
      .eq("id", id)
      .eq("user_id", request.userId)
      .single();

    if (!digest) return reply.status(404).send({ error: "Resumo não encontrado" });

    // Import dynamically to avoid circular deps
    const { chatAboutDigest } = await import("../services/ai.js");
    const response = await chatAboutDigest(digest.text_content, digest.title, message);

    return { response };
  });
}
