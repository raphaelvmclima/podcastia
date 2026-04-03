import cron from "node-cron";
import { supabaseAdmin } from "../lib/supabase.js";
import { digestQueue } from "./queue.js";

export function startScheduler() {
  // Run every minute, check if any user has a digest scheduled for now
  cron.schedule("* * * * *", async () => {
    try {
      // Use BRT (UTC-3) for user-facing schedule times
      const now = new Date();
      const brtOffset = -3;
      const brtTime = new Date(now.getTime() + brtOffset * 60 * 60 * 1000);
      const currentTime = `${String(brtTime.getUTCHours()).padStart(2, "0")}:${String(brtTime.getUTCMinutes()).padStart(2, "0")}`;

      // Find users whose schedule_times includes the current BRT time
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

        // Check if we already created a job for this user today (BRT date) at this time
        const brtDate = `${brtTime.getUTCFullYear()}-${String(brtTime.getUTCMonth() + 1).padStart(2, "0")}-${String(brtTime.getUTCDate()).padStart(2, "0")}`;
        
        // Convert BRT time window to UTC for the database query
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

        // Check if user has at least one active source
        const { count: sourceCount } = await supabaseAdmin
          .from("source_connections")
          .select("*", { count: "exact", head: true })
          .eq("user_id", setting.user_id)
          .eq("is_active", true);

        if (!sourceCount || sourceCount === 0) {
          console.log(`[Scheduler] Skipping user ${setting.user_id} at ${currentTime} BRT — no active sources`);
          continue;
        }

        // Create digest job
        const { data: job, error: jobError } = await supabaseAdmin
          .from("digest_jobs")
          .insert({
            user_id: setting.user_id,
            status: "pending",
            scheduled_at: now.toISOString(),
          })
          .select()
          .single();

        if (jobError) {
          console.error(`[Scheduler] Error creating job for ${setting.user_id}:`, jobError.message);
          continue;
        }

        if (job) {
          await digestQueue.add("generate", { jobId: job.id, userId: setting.user_id });
          console.log(`[Scheduler] Queued digest for user ${setting.user_id} at ${currentTime} BRT`);
        }
      }
    } catch (err: any) {
      console.error("[Scheduler] Unexpected error in cron callback:", err.message);
    }
  });

  // Log heartbeat every 30 minutes to confirm scheduler is alive
  cron.schedule("*/30 * * * *", () => {
    const now = new Date();
    const brtHours = (now.getUTCHours() - 3 + 24) % 24;
    const brtMins = now.getUTCMinutes();
    console.log(`[Scheduler] Heartbeat — ${String(brtHours).padStart(2, "0")}:${String(brtMins).padStart(2, "0")} BRT`);
  });

  console.log("[Scheduler] Digest scheduler started (checking every minute, BRT timezone)");
}
