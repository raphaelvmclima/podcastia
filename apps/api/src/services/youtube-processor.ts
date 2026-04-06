/**
 * YouTube Processor for PodcastIA
 *
 * Supports:
 * - Channel URLs: fetches latest videos via RSS + YouTube Data API v3 for richer metadata
 * - Individual video URLs: YouTube Data API v3 metadata → Gemini fileData → oEmbed fallback
 *
 * Priority chain for individual videos:
 *   1. YouTube Data API v3 (snippet.title + snippet.description + statistics)
 *   2. Gemini fileData to WATCH the video and generate summary
 *   3. oEmbed title + Gemini text research (fallback)
 *
 * Gemini 2.5 Flash can process YouTube video URLs natively via fileData.
 */

import { fetchRSSContent } from "./rss-processor.js";
import { env } from "../lib/env.js";

export interface RSSItem {
  title: string;
  content: string;
  pubDate: string;
}

const YOUTUBE_RSS_BASE = "https://www.youtube.com/feeds/videos.xml";
const MAX_VIDEOS_TO_SUMMARIZE = 3;
const MAX_SUMMARY_CHARS = 2000;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 120000; // 2 min per video (Gemini needs time to watch)

const YOUTUBE_DATA_API_BASE = "https://www.googleapis.com/youtube/v3";

// ─── Helpers ────────────────────────────────────────────────────────────────

function isVideoUrl(url: string): boolean {
  return /(?:watch\?v=|youtu\.be\/|\/embed\/|\/shorts\/)/.test(url);
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /\/embed\/([\w-]{11})/,
    /\/shorts\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[\w-]{11}$/.test(url)) return url;
  return null;
}

// ─── YouTube Data API v3 ────────────────────────────────────────────────────

interface YouTubeVideoMeta {
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  tags: string[];
  viewCount: string;
  likeCount: string;
  duration: string;
}

/**
 * Fetch video metadata via YouTube Data API v3.
 * Returns null on any failure (API not enabled, quota exceeded, etc.)
 */
async function fetchVideoMetaFromAPI(videoId: string): Promise<YouTubeVideoMeta | null> {
  try {
    const url = `${YOUTUBE_DATA_API_BASE}/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${env.YOUTUBE_API_KEY}`;

    console.log(`[youtube-processor] YouTube Data API v3 → video ${videoId}`);

    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`[youtube-processor] YouTube Data API v3 error ${resp.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = (await resp.json()) as any;
    const item = data?.items?.[0];
    if (!item) {
      console.warn(`[youtube-processor] YouTube Data API v3: no items for ${videoId}`);
      return null;
    }

    const snippet = item.snippet || {};
    const stats = item.statistics || {};
    const contentDetails = item.contentDetails || {};

    return {
      title: snippet.title || "",
      description: snippet.description || "",
      channelTitle: snippet.channelTitle || "",
      publishedAt: snippet.publishedAt || "",
      tags: snippet.tags || [],
      viewCount: stats.viewCount || "0",
      likeCount: stats.likeCount || "0",
      duration: contentDetails.duration || "",
    };
  } catch (err: any) {
    console.warn(`[youtube-processor] YouTube Data API v3 failed for ${videoId}:`, err.message);
    return null;
  }
}

/**
 * Fetch latest videos from a channel via YouTube Data API v3.
 * Returns null on failure (falls back to RSS).
 */
async function fetchChannelVideosFromAPI(
  channelId: string,
  maxResults = 10
): Promise<Array<{ videoId: string; title: string; description: string; publishedAt: string }> | null> {
  try {
    const url = `${YOUTUBE_DATA_API_BASE}/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${env.YOUTUBE_API_KEY}`;

    console.log(`[youtube-processor] YouTube Data API v3 → channel ${channelId} (max ${maxResults})`);

    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`[youtube-processor] YouTube Data API v3 channel error ${resp.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = (await resp.json()) as any;
    const items = data?.items;
    if (!items || items.length === 0) return null;

    return items
      .map((item: any) => ({
        videoId: item.id?.videoId || "",
        title: item.snippet?.title || "",
        description: item.snippet?.description || "",
        publishedAt: item.snippet?.publishedAt || "",
      }))
      .filter((v: any) => v.videoId);
  } catch (err: any) {
    console.warn(`[youtube-processor] YouTube Data API v3 channel failed:`, err.message);
    return null;
  }
}

// ─── oEmbed (existing, now tertiary fallback) ───────────────────────────────

/**
 * Get video title via oEmbed (no auth needed, fast)
 */
async function getVideoTitle(videoId: string): Promise<{ title: string; author: string }> {
  try {
    const resp = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (resp.ok) {
      const data = (await resp.json()) as any;
      return { title: data.title || "", author: data.author_name || "" };
    }
  } catch {
    /* ignore */
  }
  return { title: "", author: "" };
}

// ─── Gemini (existing) ─────────────────────────────────────────────────────

/**
 * Use Gemini to WATCH a YouTube video and generate a real summary.
 * Uses fileData to pass the YouTube URL directly to Gemini.
 */
async function summarizeVideoWithGemini(videoId: string, title: string): Promise<string | null> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    console.log(`[youtube-processor] Gemini watching video: ${videoUrl}`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  fileData: {
                    fileUri: videoUrl,
                    mimeType: "video/*",
                  },
                },
                {
                  text: `Assista este video do YouTube e faca um resumo detalhado em portugues brasileiro.
Inclua:
- Os pontos principais discutidos
- Dados, exemplos e casos mencionados
- Conclusoes e recomendacoes do autor
O resumo sera usado como fonte para um podcast, entao seja informativo e capture a essencia do conteudo.
Maximo ${MAX_SUMMARY_CHARS} caracteres.`,
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.2,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[youtube-processor] Gemini video error ${response.status}:`, errText.slice(0, 200));
      return null;
    }

    const data = (await response.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text) {
      return text.slice(0, MAX_SUMMARY_CHARS);
    }

    return null;
  } catch (err: any) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      console.error(`[youtube-processor] Gemini video timeout for ${videoId} (>${GEMINI_TIMEOUT_MS}ms)`);
    } else {
      console.error(`[youtube-processor] Gemini video error:`, err.message);
    }
    return null;
  }
}

/**
 * Fallback: use Gemini text-only to research the topic based on title
 */
async function researchTopicWithGemini(title: string, author: string): Promise<string | null> {
  try {
    const prompt = `Voce e um assistente de pesquisa para um podcast. Pesquise sobre o tema deste video do YouTube e gere conteudo informativo em portugues brasileiro.

Titulo do video: "${title}"
Canal: ${author}

IMPORTANTE: Voce NAO tem acesso ao conteudo do video. Baseie-se APENAS no titulo e no canal para pesquisar sobre o tema.
Gere um texto informativo de ate ${MAX_SUMMARY_CHARS} caracteres sobre o assunto do titulo.
Comece com "No video '${title}' do canal ${author}," e discorra sobre o tema de forma relevante e factual.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.3 },
        }),
      }
    );

    if (!response.ok) return null;
    const data = (await response.json()) as any;
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, MAX_SUMMARY_CHARS) || null;
  } catch {
    return null;
  }
}

// ─── Single Video Processing ────────────────────────────────────────────────

/**
 * Build a rich metadata header from YouTube Data API v3 data
 */
function buildMetaHeader(meta: YouTubeVideoMeta): string {
  const parts: string[] = [];
  if (meta.channelTitle) parts.push(`Canal: ${meta.channelTitle}`);
  if (meta.viewCount && parseInt(meta.viewCount) > 0) {
    parts.push(`Views: ${parseInt(meta.viewCount).toLocaleString("pt-BR")}`);
  }
  if (meta.likeCount && parseInt(meta.likeCount) > 0) {
    parts.push(`Likes: ${parseInt(meta.likeCount).toLocaleString("pt-BR")}`);
  }
  if (meta.duration) {
    // Parse ISO 8601 duration (PT1H2M3S)
    const match = meta.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (match) {
      const h = match[1] ? `${match[1]}h` : "";
      const m = match[2] ? `${match[2]}m` : "";
      const s = match[3] ? `${match[3]}s` : "";
      parts.push(`Duracao: ${h}${m}${s}`);
    }
  }
  if (meta.tags && meta.tags.length > 0) {
    parts.push(`Tags: ${meta.tags.slice(0, 8).join(", ")}`);
  }
  return parts.join(" | ");
}

/**
 * Process a single YouTube video URL
 *
 * Flow:
 *   1. YouTube Data API v3 for metadata (title, description, stats)
 *   2. Gemini fileData to watch the video (best content quality)
 *   3. Fallback: oEmbed title + Gemini text research
 */
async function fetchSingleVideo(videoUrl: string, sourceName?: string): Promise<RSSItem[]> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    console.error(`[youtube-processor] Could not extract video ID from: ${videoUrl}`);
    return [];
  }

  console.log(`[youtube-processor] Single video mode: ${videoId}`);

  // ── Step 1: Try YouTube Data API v3 for rich metadata ──
  const apiMeta = await fetchVideoMetaFromAPI(videoId);

  let title = "";
  let author = "";
  let apiDescription = "";
  let metaHeader = "";

  if (apiMeta) {
    title = apiMeta.title;
    author = apiMeta.channelTitle;
    apiDescription = apiMeta.description;
    metaHeader = buildMetaHeader(apiMeta);
    console.log(`[youtube-processor] Data API v3 OK: "${title}" by ${author} (${apiMeta.viewCount} views)`);
  } else {
    // Fallback to oEmbed for basic title
    console.log(`[youtube-processor] Data API v3 unavailable, falling back to oEmbed`);
    const oEmbed = await getVideoTitle(videoId);
    title = oEmbed.title;
    author = oEmbed.author;
  }

  if (!title) title = sourceName || `Video ${videoId}`;

  console.log(`[youtube-processor] Video: "${title}" by ${author}`);

  // ── Step 2: Gemini watches the actual video (best content quality) ──
  let content = await summarizeVideoWithGemini(videoId, title);

  // ── Step 3: Fallback — Gemini researches the topic from title ──
  if (!content && title) {
    console.log(`[youtube-processor] Falling back to topic research for: ${title}`);
    content = await researchTopicWithGemini(title, author);
  }

  // ── Build final content with API description enrichment ──
  const contentParts: string[] = [];
  contentParts.push(`${title}${author ? ` - ${author}` : ""}`);
  if (metaHeader) contentParts.push(metaHeader);

  if (content) {
    contentParts.push("");
    contentParts.push(content);
  }

  // If we have API description and Gemini failed, use description as content
  if (!content && apiDescription) {
    console.log(`[youtube-processor] Using YouTube Data API description as content`);
    contentParts.push("");
    contentParts.push(apiDescription.slice(0, MAX_SUMMARY_CHARS));
  }

  const finalContent = contentParts.join("\n");

  console.log(`[youtube-processor] Got content (${finalContent.length} chars) for: ${title}`);

  return [
    {
      title,
      content: finalContent,
      pubDate: apiMeta?.publishedAt || new Date().toISOString(),
    },
  ];
}

// ─── Channel Processing ─────────────────────────────────────────────────────

/**
 * Extract channel ID from URL
 */
async function extractChannelId(channelUrl: string): Promise<string | null> {
  try {
    if (/^UC[\w-]{20,}$/.test(channelUrl)) return channelUrl;
    const channelMatch = channelUrl.match(/\/channel\/(UC[\w-]+)/);
    if (channelMatch) return channelMatch[1];

    const response = await fetch(channelUrl, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
      },
    });
    if (!response.ok) return null;
    const html = await response.text();

    for (const pattern of [/"channelId"\s*:\s*"(UC[\w-]+)"/, /"browseId"\s*:\s*"(UC[\w-]+)"/]) {
      const match = html.match(pattern);
      if (match) return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Process a YouTube channel URL
 *
 * Flow:
 *   1. Try YouTube Data API v3 for latest videos (richer metadata)
 *   2. Fallback to RSS feed
 *   3. For top N videos, use Gemini fileData to summarize
 */
async function fetchChannelVideos(channelUrl: string): Promise<RSSItem[]> {
  const channelId = await extractChannelId(channelUrl);
  if (!channelId) {
    console.error(`[youtube-processor] Failed to resolve channel ID for: ${channelUrl}`);
    return [];
  }

  // ── Try YouTube Data API v3 for channel videos ──
  const apiVideos = await fetchChannelVideosFromAPI(channelId, 10);

  let videoList: Array<{ videoId: string; title: string; description: string; pubDate: string }> = [];

  if (apiVideos && apiVideos.length > 0) {
    console.log(`[youtube-processor] Data API v3 returned ${apiVideos.length} videos for channel ${channelId}`);

    // Enrich top videos with full metadata (snippet+stats)
    for (const v of apiVideos.slice(0, MAX_VIDEOS_TO_SUMMARIZE)) {
      const fullMeta = await fetchVideoMetaFromAPI(v.videoId);
      videoList.push({
        videoId: v.videoId,
        title: fullMeta?.title || v.title,
        description: fullMeta?.description || v.description,
        pubDate: fullMeta?.publishedAt || v.publishedAt,
      });
    }
    // Add remaining without enrichment
    for (const v of apiVideos.slice(MAX_VIDEOS_TO_SUMMARIZE)) {
      videoList.push({
        videoId: v.videoId,
        title: v.title,
        description: v.description,
        pubDate: v.publishedAt,
      });
    }
  } else {
    // Fallback to RSS
    console.log(`[youtube-processor] Data API v3 unavailable for channel, falling back to RSS`);
    const feedUrl = `${YOUTUBE_RSS_BASE}?channel_id=${channelId}`;
    console.log(`[youtube-processor] Fetching feed: ${feedUrl}`);

    const rssItems = await fetchRSSContent(feedUrl);
    if (rssItems.length === 0) return [];

    for (const item of rssItems) {
      const vid = extractVideoId(item.content) || extractVideoId(item.title);
      videoList.push({
        videoId: vid || "",
        title: item.title,
        description: item.content,
        pubDate: item.pubDate,
      });
    }
  }

  if (videoList.length === 0) return [];

  // ── Summarize top N with Gemini ──
  const results: RSSItem[] = [];

  for (const video of videoList.slice(0, MAX_VIDEOS_TO_SUMMARIZE)) {
    if (!video.videoId) {
      results.push({ title: video.title, content: video.description, pubDate: video.pubDate });
      continue;
    }

    console.log(`[youtube-processor] Processing channel video: ${video.title} (${video.videoId})`);
    const content = await summarizeVideoWithGemini(video.videoId, video.title);

    if (content) {
      results.push({
        title: video.title,
        content: `${video.title}\n\n${content}`,
        pubDate: video.pubDate,
      });
      console.log(`[youtube-processor] Got video summary for: ${video.title}`);
    } else if (video.description && video.description.length > 50) {
      // Use API description as fallback content
      results.push({
        title: video.title,
        content: `${video.title}\n\n${video.description.slice(0, MAX_SUMMARY_CHARS)}`,
        pubDate: video.pubDate,
      });
      console.log(`[youtube-processor] Using API description for: ${video.title}`);
    } else {
      results.push({
        title: video.title,
        content: video.description || video.title,
        pubDate: video.pubDate,
      });
      console.log(`[youtube-processor] Using basic info for: ${video.title}`);
    }
  }

  // Remaining videos without Gemini summarization
  for (const video of videoList.slice(MAX_VIDEOS_TO_SUMMARIZE)) {
    results.push({
      title: video.title,
      content: video.description || video.title,
      pubDate: video.pubDate,
    });
  }

  return results;
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Main entry point
 */
export async function fetchYouTubeContent(url: string, sourceName?: string): Promise<RSSItem[]> {
  try {
    if (isVideoUrl(url)) {
      return await fetchSingleVideo(url, sourceName);
    } else {
      return await fetchChannelVideos(url);
    }
  } catch (error: any) {
    console.error(`[youtube-processor] Error processing ${url}:`, error.message);
    return [];
  }
}
