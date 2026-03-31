import cron from "node-cron";
import { supabaseAdmin } from "../lib/supabase.js";
import { digestQueue } from "./queue.js";

export function startScheduler() {
  // Run every minute, check if any user has a digest scheduled for now
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Find users whose schedule_times includes the current time
    const { data: settings } = await supabaseAdmin
      .from("user_settings")
      .select("user_id, schedule_times");

    if (!settings) return;

    for (const setting of settings) {
      const times: string[] = setting.schedule_times || [];
      if (!times.includes(currentTime)) continue;

      // Check if we already created a job for this user today at this time
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabaseAdmin
        .from("digest_jobs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", setting.user_id)
        .gte("scheduled_at", `${today}T${currentTime}:00`)
        .lt("scheduled_at", `${today}T${currentTime}:59`);

      if ((count || 0) > 0) continue;

      // Create digest job
      const { data: job } = await supabaseAdmin
        .from("digest_jobs")
        .insert({
          user_id: setting.user_id,
          status: "pending",
          scheduled_at: now.toISOString(),
        })
        .select()
        .single();

      if (job) {
        await digestQueue.add("generate", { jobId: job.id, userId: setting.user_id });
        console.log(`[Scheduler] Queued digest for user ${setting.user_id} at ${currentTime}`);
      }
    }
  });

  console.log("[Scheduler] Digest scheduler started (checking every minute)");
}
