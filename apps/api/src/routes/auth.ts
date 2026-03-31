import { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post("/api/auth/register", async (request, reply) => {
    const { email, password, name } = request.body as { email: string; password: string; name: string };

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (error) {
      return reply.status(400).send({ error: error.message });
    }

    // Create user profile
    await supabaseAdmin.from("users").insert({
      id: data.user.id,
      email,
      name,
      plan: "free",
    });

    // Create default settings
    await supabaseAdmin.from("user_settings").insert({
      user_id: data.user.id,
      audio_voice: "Sadachbia",
      audio_speed: 1.0,
      audio_style: "casual",
      delivery_channel: "email",
      delivery_target: email,
      schedule_times: ["08:00"],
      timezone: "America/Sao_Paulo",
    });

    // Sign in to get token
    const { data: session, error: signError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (signError) {
      return reply.status(400).send({ error: signError.message });
    }

    return { user: data.user, session: session.session };
  });

  // Login
  app.post("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return reply.status(401).send({ error: error.message });
    }

    return { user: data.user, session: data.session };
  });

  // Refresh token
  app.post("/api/auth/refresh", async (request, reply) => {
    const { refresh_token } = request.body as { refresh_token: string };

    const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token });

    if (error) {
      return reply.status(401).send({ error: error.message });
    }

    return { session: data.session };
  });

  // Get current user profile
  app.get("/api/auth/me", async (request, reply) => {
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (!token) return reply.status(401).send({ error: "Não autenticado" });

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return reply.status(401).send({ error: "Token inválido" });

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    const { data: settings } = await supabaseAdmin
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    return { user: { ...profile, email: user.email }, settings };
  });


  // Change password
  app.post("/api/auth/change-password", async (request, reply) => {
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (!token) return reply.status(401).send({ error: "Nao autenticado" });

    const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };
    if (!currentPassword || !newPassword) return reply.status(400).send({ error: "Preencha todos os campos" });
    if (newPassword.length < 6) return reply.status(400).send({ error: "Senha deve ter no minimo 6 caracteres" });

    const { data: { user: pwUser }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !pwUser) return reply.status(401).send({ error: "Token invalido" });

    // Verify current password
    const { error: signError } = await supabaseAdmin.auth.signInWithPassword({
      email: pwUser.email!,
      password: currentPassword,
    });
    if (signError) return reply.status(400).send({ error: "Senha atual incorreta" });

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(pwUser.id, {
      password: newPassword,
    });
    if (updateError) return reply.status(500).send({ error: updateError.message });

    return { ok: true, message: "Senha alterada com sucesso" };
  });
}