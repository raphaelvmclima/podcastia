import { FastifyRequest, FastifyReply } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", request.userId)
      .single();

    const userRole = user?.role || "user";
    if (!roles.includes(userRole)) {
      return reply.status(403).send({ error: "Acesso negado" });
    }
    (request as any).userRole = userRole;
  };
}
