import "dotenv/config";

export const env = {
  PORT: parseInt(process.env.APP_PORT || "3001"),
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY!,
  UAZAPI_URL: process.env.UAZAPI_URL!,
  UAZAPI_TOKEN: process.env.UAZAPI_TOKEN!,
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  JWT_SECRET: process.env.JWT_SECRET || "podcastia-secret-change-me",
  APP_URL: process.env.APP_URL || "http://localhost:3000",
};
