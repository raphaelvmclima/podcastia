import { Queue } from "bullmq";
import { redis } from "../lib/redis.js";

export const digestQueue = new Queue("digest-generation", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});
