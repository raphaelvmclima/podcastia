import { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/admin.js";

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authMiddleware);
  app.addHook("onRequest", requireRole("super_admin"));

  // GET /api/admin/users - List all users with stats
  app.get("/api/admin/users", async (request) => {
    const { page = "1", limit = "50" } = request.query as { page?: string; limit?: string };
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    // Get total count
    const { count: totalUsers } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true });

    // Get users with pagination
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, email, name, plan, role, created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      return { users: [], total: 0, page: pageNum, limit: limitNum };
    }

    // Get stats for these users in parallel
    const userIds = (users || []).map((u) => u.id);

    if (userIds.length === 0) {
      return { users: [], total: totalUsers || 0, page: pageNum, limit: limitNum };
    }

    const [sourcesRes, digestsRes, lastActivityRes] = await Promise.all([
      supabaseAdmin
        .from("source_connections")
        .select("user_id")
        .in("user_id", userIds),
      supabaseAdmin
        .from("digests")
        .select("user_id")
        .in("user_id", userIds),
      supabaseAdmin
        .from("digests")
        .select("user_id, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false }),
    ]);

    // Count sources per user
    const sourcesCounts: Record<string, number> = {};
    (sourcesRes.data || []).forEach((s) => {
      sourcesCounts[s.user_id] = (sourcesCounts[s.user_id] || 0) + 1;
    });

    // Count digests per user
    const digestsCounts: Record<string, number> = {};
    (digestsRes.data || []).forEach((d) => {
      digestsCounts[d.user_id] = (digestsCounts[d.user_id] || 0) + 1;
    });

    // Last activity per user (first occurrence in desc-ordered results)
    const lastActivity: Record<string, string> = {};
    (lastActivityRes.data || []).forEach((d) => {
      if (!lastActivity[d.user_id]) {
        lastActivity[d.user_id] = d.created_at;
      }
    });

    const enrichedUsers = (users || []).map((u) => ({
      ...u,
      sources_count: sourcesCounts[u.id] || 0,
      digests_count: digestsCounts[u.id] || 0,
      last_activity: lastActivity[u.id] || null,
    }));

    return {
      users: enrichedUsers,
      total: totalUsers || 0,
      page: pageNum,
      limit: limitNum,
    };
  });

  // PATCH /api/admin/users/:id/plan - Update user plan
  app.patch("/api/admin/users/:id/plan", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { plan } = request.body as { plan: string };

    const validPlans = ["free", "starter", "pro", "business"];
    if (!plan || !validPlans.includes(plan)) {
      return reply.status(400).send({
        error: "Plano inválido",
        valid: validPlans,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ plan })
      .eq("id", id)
      .select("id, email, name, plan, role")
      .single();

    if (error) {
      return reply.status(400).send({ error: "Usuário não encontrado" });
    }

    return { user: data };
  });

  // PATCH /api/admin/users/:id/role - Update user role
  app.patch("/api/admin/users/:id/role", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { role } = request.body as { role: string };

    const validRoles = ["user", "admin", "super_admin"];
    if (!role || !validRoles.includes(role)) {
      return reply.status(400).send({
        error: "Role inválida",
        valid: validRoles,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ role })
      .eq("id", id)
      .select("id, email, name, plan, role")
      .single();

    if (error) {
      return reply.status(400).send({ error: "Usuário não encontrado" });
    }

    return { user: data };
  });

  // GET /api/admin/stats - Platform stats
  app.get("/api/admin/stats", async () => {
    const [usersRes, planRes, digestsRes, sourcesRes] = await Promise.all([
      // Total users
      supabaseAdmin
        .from("users")
        .select("*", { count: "exact", head: true }),

      // Users by plan
      supabaseAdmin
        .from("users")
        .select("plan"),

      // Digests last 30 days
      supabaseAdmin
        .from("digests")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

      // Active sources
      supabaseAdmin
        .from("source_connections")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    // Group users by plan
    const usersByPlan: Record<string, number> = {};
    (planRes.data || []).forEach((u) => {
      const plan = u.plan || "free";
      usersByPlan[plan] = (usersByPlan[plan] || 0) + 1;
    });

    return {
      total_users: usersRes.count || 0,
      users_by_plan: usersByPlan,
      digests_30d: digestsRes.count || 0,
      active_sources: sourcesRes.count || 0,
    };
  });
}
