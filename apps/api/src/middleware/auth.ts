import { FastifyRequest, FastifyReply } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    userPlan: string;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return reply.status(401).send({ error: "Token não fornecido" });
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return reply.status(401).send({ error: "Token inválido" });
  }

  // Get user plan
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .single();

  request.userId = user.id;
  request.userPlan = profile?.plan || "free";
}

// Plan limits
const PLAN_LIMITS: Record<string, {
  maxSources: number;
  maxDigestsPerDay: number;
  maxAudioMinutes: number;
  channels: string[];
}> = {
  free: { maxSources: 1, maxDigestsPerDay: 1, maxAudioMinutes: 3, channels: ["email"] },
  starter: { maxSources: 3, maxDigestsPerDay: 3, maxAudioMinutes: 8, channels: ["whatsapp", "email"] },
  pro: { maxSources: 999, maxDigestsPerDay: 10, maxAudioMinutes: 20, channels: ["whatsapp", "telegram", "email"] },
  business: { maxSources: 999, maxDigestsPerDay: 999, maxAudioMinutes: 30, channels: ["whatsapp", "telegram", "email", "webhook"] },
};

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

export function requirePlan(...plans: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!plans.includes(request.userPlan)) {
      return reply.status(403).send({ 
        error: "Plano insuficiente", 
        required: plans,
        current: request.userPlan 
      });
    }
  };
}
