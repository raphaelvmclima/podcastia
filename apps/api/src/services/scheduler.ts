import cron from "node-cron";
import { supabaseAdmin } from "../lib/supabase.js";
import { digestQueue } from "./queue.js";

// Cache of all known schedule times to avoid querying Supabase every minute
let cachedScheduleTimes: Set<string> = new Set();
let cacheLastRefresh = 0;
const CACHE_TTL = 300000; // Refresh cache every 5 minutes

async function refreshScheduleCache(): Promise<void> {
  const now = Date.now();
  if (now - cacheLastRefresh < CACHE_TTL) return;

  try {
    const times = new Set<string>();

    // Per-source schedule times
    const { data: sources } = await supabaseAdmin
      .from("source_connections")
      .select("schedule_times")
      .eq("is_active", true)
      .not("schedule_times", "is", null);

    sources?.forEach((s: any) => {
      (s.schedule_times || []).forEach((t: string) => times.add(t));
    });

    // Global user schedule times
    const { data: settings } = await supabaseAdmin
      .from("user_settings")
      .select("schedule_times");

    settings?.forEach((s: any) => {
      (s.schedule_times || []).forEach((t: string) => times.add(t));
    });

    cachedScheduleTimes = times;
    cacheLastRefresh = now;
  } catch (err: any) {
    console.error("[Scheduler] Cache refresh error:", err.message);
  }
}

export function startScheduler() {
  // Initial cache load
  refreshScheduleCache();

  cron.schedule("* * * * *", async () => {
    try {
      // Refresh cache periodically
      await refreshScheduleCache();

      const now = new Date();
      const brtOffset = -3;
      const brtTime = new Date(now.getTime() + brtOffset * 60 * 60 * 1000);
      const currentTime = `${String(brtTime.getUTCHours()).padStart(2, "0")}:${String(brtTime.getUTCMinutes()).padStart(2, "0")}`;

      // Skip entirely if no schedule matches current time
      if (!cachedScheduleTimes.has(currentTime)) return;

      const brtDate = `${brtTime.getUTCFullYear()}-${String(brtTime.getUTCMonth() + 1).padStart(2, "0")}-${String(brtTime.getUTCDate()).padStart(2, "0")}`;

      // ── A) Per-source schedules ──
      const { data: sourcesWithSchedule, error: srcErr } = await supabaseAdmin
        .from("source_connections")
        .select("id, user_id")
        .eq("is_active", true)
        .filter("schedule_times", "cs", `{"${currentTime}"}`);

      if (srcErr) {
        console.error("[Scheduler] Error fetching per-source schedules:", srcErr.message);
      } else if (sourcesWithSchedule && sourcesWithSchedule.length > 0) {
        const byUser: Record<string, string[]> = {};
        for (const src of sourcesWithSchedule) {
          if (!byUser[src.user_id]) byUser[src.user_id] = [];
          byUser[src.user_id].push(src.id);
        }

        for (const [userId, sourceIds] of Object.entries(byUser)) {
          const windowStartBRT = new Date(`${brtDate}T${currentTime}:00-03:00`);
          const windowEndBRT = new Date(`${brtDate}T${currentTime}:59-03:00`);

          const { count } = await supabaseAdmin
            .from("digest_jobs")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("scheduled_at", windowStartBRT.toISOString())
            .lt("scheduled_at", windowEndBRT.toISOString());

          if ((count || 0) > 0) continue;

          const { data: job, error: jobError } = await supabaseAdmin
            .from("digest_jobs")
            .insert({ user_id: userId, status: "pending", scheduled_at: now.toISOString() })
            .select()
            .single();

          if (jobError) {
            console.error(`[Scheduler] Error creating per-source job for ${userId}:`, jobError.message);
            continue;
          }

          if (job) {
            await digestQueue.add("generate", { jobId: job.id, userId, sourceIds });
            console.log(`[Scheduler] Queued per-source digest for user ${userId} at ${currentTime} BRT (${sourceIds.length} sources)`);
          }
        }
      }

      // ── B) Global schedule ──
      const { data: settings, error: settingsError } = await supabaseAdmin
        .from("user_settings")
        .select("user_id, schedule_times");

      if (settingsError) {
        console.error("[Scheduler] Error fetching settings:", settingsError.message);
        return;
      }

      if (!settings || settings.length === 0) return;

      for (const setting of settings) {
        const times: string[] = setting.schedule_times || [];
        if (!times.includes(currentTime)) continue;

        const windowStartBRT = new Date(`${brtDate}T${currentTime}:00-03:00`);
        const windowEndBRT = new Date(`${brtDate}T${currentTime}:59-03:00`);

        const { count, error: countError } = await supabaseAdmin
          .from("digest_jobs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", setting.user_id)
          .gte("scheduled_at", windowStartBRT.toISOString())
          .lt("scheduled_at", windowEndBRT.toISOString());

        if (countError) {
          console.error(`[Scheduler] Error checking existing jobs for ${setting.user_id}:`, countError.message);
          continue;
        }

        if ((count || 0) > 0) continue;

        const { count: sourceCount } = await supabaseAdmin
          .from("source_connections")
          .select("*", { count: "exact", head: true })
          .eq("user_id", setting.user_id)
          .eq("is_active", true)
          .is("schedule_times", null);

        if (!sourceCount || sourceCount === 0) continue;

        const { data: job, error: jobError } = await supabaseAdmin
          .from("digest_jobs")
          .insert({ user_id: setting.user_id, status: "pending", scheduled_at: now.toISOString() })
          .select()
          .single();

        if (jobError) {
          console.error(`[Scheduler] Error creating global job for ${setting.user_id}:`, jobError.message);
          continue;
        }

        if (job) {
          await digestQueue.add("generate", { jobId: job.id, userId: setting.user_id });
          console.log(`[Scheduler] Queued global digest for user ${setting.user_id} at ${currentTime} BRT`);
        }
      }
    } catch (err: any) {
      console.error("[Scheduler] Unexpected error in cron callback:", err.message);
    }
  });

  // Heartbeat every 30 minutes
  cron.schedule("*/30 * * * *", () => {
    const now = new Date();
    const brtHours = (now.getUTCHours() - 3 + 24) % 24;
    const brtMins = now.getUTCMinutes();
    console.log(`[Scheduler] Heartbeat - ${String(brtHours).padStart(2, "0")}:${String(brtMins).padStart(2, "0")} BRT | ${cachedScheduleTimes.size} cached times`);
  });

  console.log("[Scheduler] Digest scheduler started (dual mode: per-source + global, BRT timezone, with cache)");
}
