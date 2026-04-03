/**
 * YouTube Processor for PodcastIA
 *
 * Supports:
 * - Channel URLs: fetches latest videos via RSS, summarizes top 3 with Gemini
 * - Individual video URLs: Gemini watches the video via fileData and summarizes
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
  } catch { /* ignore */ }
  return { title: "", author: "" };
}

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
          contents: [{
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
          }],
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

/**
 * Process a single YouTube video URL
 */
async function fetchSingleVideo(videoUrl: string, sourceName?: string): Promise<RSSItem[]> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    console.error(`[youtube-processor] Could not extract video ID from: ${videoUrl}`);
    return [];
  }

  console.log(`[youtube-processor] Single video mode: ${videoId}`);

  // Get title via oEmbed (fast)
  const meta = await getVideoTitle(videoId);
  const title = meta.title || sourceName || `Video ${videoId}`;
  const author = meta.author || "";

  console.log(`[youtube-processor] Video: "${title}" by ${author}`);

  // Try 1: Gemini watches the actual video (best quality)
  let content = await summarizeVideoWithGemini(videoId, title);

  // Try 2: Gemini researches the topic from title (fallback)
  if (!content && title) {
    console.log(`[youtube-processor] Falling back to topic research for: ${title}`);
    content = await researchTopicWithGemini(title, author);
  }

  if (content) {
    console.log(`[youtube-processor] Got content (${content.length} chars) for: ${title}`);
    return [{
      title,
      content: `${title}${author ? ` - ${author}` : ""}\n\n${content}`,
      pubDate: new Date().toISOString(),
    }];
  }

  return [{
    title,
    content: `${title}${author ? ` - ${author}` : ""}`,
    pubDate: new Date().toISOString(),
  }];
}

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
  } catch { return null; }
}

/**
 * Process a YouTube channel URL
 */
async function fetchChannelVideos(channelUrl: string): Promise<RSSItem[]> {
  const channelId = await extractChannelId(channelUrl);
  if (!channelId) {
    console.error(`[youtube-processor] Failed to resolve channel ID for: ${channelUrl}`);
    return [];
  }

  const feedUrl = `${YOUTUBE_RSS_BASE}?channel_id=${channelId}`;
  console.log(`[youtube-processor] Fetching feed: ${feedUrl}`);

  const rssItems = await fetchRSSContent(feedUrl);
  if (rssItems.length === 0) return [];

  const results: RSSItem[] = [];

  for (const item of rssItems.slice(0, MAX_VIDEOS_TO_SUMMARIZE)) {
    const videoId = extractVideoId(item.content) || extractVideoId(item.title);
    if (!videoId) { results.push(item); continue; }

    console.log(`[youtube-processor] Processing channel video: ${item.title} (${videoId})`);
    const content = await summarizeVideoWithGemini(videoId, item.title);

    if (content) {
      results.push({ title: item.title, content: `${item.title}\n\n${content}`, pubDate: item.pubDate });
      console.log(`[youtube-processor] Got video summary for: ${item.title}`);
    } else {
      results.push(item);
      console.log(`[youtube-processor] Using RSS description for: ${item.title}`);
    }
  }

  for (const item of rssItems.slice(MAX_VIDEOS_TO_SUMMARIZE)) {
    results.push(item);
  }

  return results;
}

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
