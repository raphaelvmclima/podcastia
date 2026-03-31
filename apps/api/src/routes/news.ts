import { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";
import { parseNewsPreferences } from "../services/ai.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

export async function newsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authMiddleware);

  app.post("/api/news/configure", async (request, reply) => {
    const { message } = request.body as { message: string };
    if (!message?.trim()) return reply.status(400).send({ error: "Mensagem vazia" });

    try {
      const { data: current } = await supabaseAdmin
        .from("news_preferences")
        .select("*")
        .eq("user_id", request.userId)
        .single();

      const previousConversation = current?.raw_conversation || "";
      const fullConversation = previousConversation
        ? `${previousConversation}\nUsuario: ${message}`
        : `Usuario: ${message}`;

      const systemPrompt = `Voce e uma assistente simpatica que ajuda o usuario a configurar preferencias de noticias para um podcast diario.

Trabalho:
1. Entender o que o usuario quer receber
2. Responder confirmando o que entendeu
3. Ao final, resumir os filtros configurados

Conversa ate agora:
${fullConversation}

Responda em portugues brasileiro, concisa e amigavel. Confirme os topicos que vai monitorar.`;

      const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 1024,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
        }),
      });

      const gptData = (await gptRes.json()) as any;
      const assistantResponse = gptData.choices?.[0]?.message?.content || "Desculpe, tive um problema.";
      const filters = await parseNewsPreferences(fullConversation);
      const updatedConversation = `${fullConversation}\nAssistente: ${assistantResponse}`;

      // Save/update news_preferences
      if (current) {
        await supabaseAdmin.from("news_preferences").update({
          raw_conversation: updatedConversation,
          parsed_filters: filters,
          keywords: filters.keywords || [],
          topics: filters.topics || [],
          excluded_topics: filters.excludedTopics || [],
          updated_at: new Date().toISOString(),
        }).eq("user_id", request.userId);
      } else {
        await supabaseAdmin.from("news_preferences").insert({
          user_id: request.userId,
          raw_conversation: updatedConversation,
          parsed_filters: filters,
          keywords: filters.keywords || [],
          topics: filters.topics || [],
          excluded_topics: filters.excludedTopics || [],
        });
      }

      // Auto-create or update "news" source connection
      const topicNames = [...(filters.topics || []), ...(filters.keywords || [])].slice(0, 5).join(", ");
      const sourceName = `Noticias: ${topicNames || "personalizado"}`;

      const { data: existingSource } = await supabaseAdmin
        .from("source_connections")
        .select("id")
        .eq("user_id", request.userId)
        .eq("type", "news")
        .single();

      if (existingSource) {
        await supabaseAdmin.from("source_connections").update({
          name: sourceName,
          config: { filters, keywords: filters.keywords, topics: filters.topics, excludedTopics: filters.excludedTopics },
        }).eq("id", existingSource.id);
      } else {
        await supabaseAdmin.from("source_connections").insert({
          user_id: request.userId,
          type: "news",
          name: sourceName,
          config: { filters, keywords: filters.keywords, topics: filters.topics, excludedTopics: filters.excludedTopics },
          is_active: true,
        });
      }

      return { response: assistantResponse, filters };
    } catch (err: any) {
      console.error("News configure error:", err);
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get("/api/news/preferences", async (request) => {
    const { data } = await supabaseAdmin
      .from("news_preferences")
      .select("keywords, topics, excluded_topics, updated_at")
      .eq("user_id", request.userId)
      .single();
    return { preferences: data };
  });
}
