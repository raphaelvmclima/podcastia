/**
 * Source Fetcher - Main Orchestrator for PodcastIA
 * Routes source fetch requests to the appropriate processor
 * and transforms results into captured_message format.
 *
 * Features: per-source timeout, proper error propagation, logging.
 */

import { fetchRSSContent } from './rss-processor.js';
import { fetchYouTubeContent } from './youtube-processor.js';
import { fetchNewsForTopics } from './news-fetcher.js';

export interface SourceConfig {
  type: string;
  name?: string;
  config: {
    url?: string;
    method?: string;
    headers?: string;
    body?: string;
    keywords?: string[];
    topics?: string[];
    webhook_token?: string;
    webhook_url?: string;
    [key: string]: any;
  };
}

export interface CapturedMessage {
  sender: string;
  content: string;
  group_name: string;
}

/**
 * Source type display names for group_name field.
 */
const SOURCE_TYPE_NAMES: Record<string, string> = {
  rss: 'RSS Feed',
  youtube: 'YouTube',
  news: 'Noticias',
  instagram: 'Instagram',
  twitter: 'Twitter/X',
  telegram: 'Telegram',
  email: 'Email',
  http_request: 'HTTP Request',
  webhook: 'Webhook',
};

/** Per-source-type timeout in ms */
const SOURCE_TIMEOUTS: Record<string, number> = {
  rss: 20000,
  youtube: 60000,   // YouTube/Gemini can be slow
  news: 45000,      // Multiple parallel fetches
  http_request: 30000,
};

const DEFAULT_TIMEOUT = 30000;

/**
 * Wrap a promise with a timeout. Throws on timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[source-fetcher] Timeout after ${ms}ms for ${label}`)), ms);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

/**
 * Fetch content from a source and transform into captured_message format.
 * Errors are caught and logged — returns empty array on failure (never throws).
 */
export async function fetchSourceContent(source: SourceConfig): Promise<CapturedMessage[]> {
  const sourceName = source.name || source.type;
  const t0 = Date.now();

  try {
    const groupName = SOURCE_TYPE_NAMES[source.type] || source.type;
    const timeoutMs = SOURCE_TIMEOUTS[source.type] || DEFAULT_TIMEOUT;

    let result: CapturedMessage[];

    switch (source.type) {
      case 'rss': {
        if (!source.config.url) {
          console.error(`[source-fetcher] RSS source "${sourceName}" missing url in config`);
          return [];
        }
        const items = await withTimeout(
          fetchRSSContent(source.config.url),
          timeoutMs,
          `RSS: ${sourceName}`
        );
        result = items.map(item => ({
          sender: 'PodcastIA News',
          content: `${item.title}\n\n${item.content}`.trim(),
          group_name: groupName,
        }));
        break;
      }

      case 'youtube': {
        if (!source.config.url) {
          console.error(`[source-fetcher] YouTube source "${sourceName}" missing url in config`);
          return [];
        }
        const videos = await withTimeout(
          fetchYouTubeContent(source.config.url, source.config.name || source.name || ''),
          timeoutMs,
          `YouTube: ${sourceName}`
        );
        result = videos.map(item => ({
          sender: 'PodcastIA News',
          content: `${item.title}\n\n${item.content}`.trim(),
          group_name: groupName,
        }));
        break;
      }

      case 'news': {
        const keywords = source.config.keywords || [];
        const topics = source.config.topics || [];
        if (keywords.length === 0 && topics.length === 0) {
          console.error(`[source-fetcher] News source "${sourceName}" missing keywords and topics in config`);
          return [];
        }
        const articles = await withTimeout(
          fetchNewsForTopics(keywords, topics),
          timeoutMs,
          `News: ${sourceName}`
        );
        result = articles.map(item => ({
          sender: 'PodcastIA News',
          content: `${item.title}\n\n${item.content}\n\nFonte: ${item.source}`.trim(),
          group_name: groupName,
        }));
        break;
      }

      case 'http_request': {
        if (!source.config.url) {
          console.error(`[source-fetcher] HTTP Request source "${sourceName}" missing url in config`);
          return [];
        }
        result = await withTimeout(
          fetchHttpRequestContent(source),
          timeoutMs,
          `HTTP: ${sourceName}`
        );
        break;
      }

      case 'webhook': {
        // Webhook is push-based — content arrives via the webhook endpoint,
        // not via polling. Nothing to fetch here.
        return [];
      }

      case 'instagram':
      case 'twitter':
      case 'telegram':
      case 'email': {
        console.log(`[source-fetcher] ${source.type} source not implemented yet - returning empty`);
        return [];
      }

      default: {
        console.warn(`[source-fetcher] Unknown source type: ${source.type}`);
        return [];
      }
    }

    console.log(`[source-fetcher] ${source.type}: "${sourceName}" returned ${result.length} items in ${Date.now() - t0}ms`);
    return result;
  } catch (error: any) {
    console.error(`[source-fetcher] Error processing "${sourceName}" (${source.type}) after ${Date.now() - t0}ms:`, error.message);
    return [];
  }
}

/**
 * Fetch content from an HTTP endpoint (GET/POST/PUT/PATCH).
 */
async function fetchHttpRequestContent(source: SourceConfig): Promise<CapturedMessage[]> {
  const url = source.config.url!;
  const method = (source.config.method || 'GET').toUpperCase();
  const groupName = source.name || 'HTTP Request';

  let headers: Record<string, string> = { 'Accept': 'application/json, text/plain, */*' };
  if (source.config.headers) {
    try {
      const parsed = JSON.parse(source.config.headers);
      headers = { ...headers, ...parsed };
    } catch (e) {
      console.warn('[source-fetcher] Invalid headers JSON, using defaults');
    }
  }

  const fetchOptions: RequestInit = { method, headers };

  if (method !== 'GET' && source.config.body) {
    fetchOptions.body = source.config.body;
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  console.log(`[source-fetcher] HTTP ${method} ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  fetchOptions.signal = controller.signal;

  try {
    const res = await fetch(url, fetchOptions);
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[source-fetcher] HTTP ${method} ${url} returned ${res.status}`);
      return [];
    }

    const text = await res.text();
    if (!text.trim()) return [];

    // Try to extract meaningful content from JSON
    let content = text;
    try {
      const json = JSON.parse(text);
      content = extractContentFromJson(json);
    } catch {
      // Not JSON — use raw text
    }

    // Truncate if too long
    if (content.length > 15000) {
      content = content.slice(0, 15000) + '\n\n[... conteudo truncado]';
    }

    return [{
      sender: 'HTTP Request',
      content,
      group_name: groupName,
    }];
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error(`[source-fetcher] HTTP ${method} ${url} timeout (30s)`);
    } else {
      console.error(`[source-fetcher] HTTP ${method} ${url} error:`, err.message);
    }
    return [];
  }
}

/**
 * Extract readable content from a JSON response.
 * Handles common API response patterns.
 */
function extractContentFromJson(json: any): string {
  // If it's a string, return directly
  if (typeof json === 'string') return json;

  // If it has a common content field
  const contentFields = ['content', 'text', 'body', 'message', 'data', 'result', 'results', 'items', 'articles', 'posts', 'entries'];
  for (const field of contentFields) {
    if (json[field] !== undefined) {
      const val = json[field];
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) {
        return val.map((item, i) => {
          if (typeof item === 'string') return item;
          const title = item.title || item.name || item.headline || '';
          const desc = item.content || item.description || item.text || item.summary || item.body || '';
          if (title || desc) return `${title}\n${desc}`.trim();
          return JSON.stringify(item, null, 2);
        }).join('\n\n---\n\n');
      }
      if (typeof val === 'object') {
        return JSON.stringify(val, null, 2);
      }
    }
  }

  // Fallback: stringify the whole response
  return JSON.stringify(json, null, 2);
}
