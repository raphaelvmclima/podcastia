import { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

export async function settingsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authMiddleware);

  app.get("/api/settings", async (request) => {
    const { data } = await supabaseAdmin
      .from("user_settings")
      .select("*")
      .eq("user_id", request.userId)
      .single();

    return { settings: data };
  });

  app.patch("/api/settings", async (request) => {
    const updates = request.body as Record<string, any>;

    const { data } = await supabaseAdmin
      .from("user_settings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("user_id", request.userId)
      .select()
      .single();

    return { settings: data };
  });

}
