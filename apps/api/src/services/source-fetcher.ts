/**
 * Source Fetcher - Main Orchestrator for PodcastIA
 * Routes source fetch requests to the appropriate processor
 * and transforms results into captured_message format.
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

/**
 * Fetch content from a source and transform into captured_message format.
 */
export async function fetchSourceContent(source: SourceConfig): Promise<CapturedMessage[]> {
  try {
    const groupName = SOURCE_TYPE_NAMES[source.type] || source.type;

    switch (source.type) {
      case 'rss': {
        if (!source.config.url) {
          console.error('[source-fetcher] RSS source missing url in config');
          return [];
        }
        const items = await fetchRSSContent(source.config.url);
        return items.map(item => ({
          sender: 'PodcastIA News',
          content: `${item.title}\n\n${item.content}`.trim(),
          group_name: groupName,
        }));
      }

      case 'youtube': {
        if (!source.config.url) {
          console.error('[source-fetcher] YouTube source missing url in config');
          return [];
        }
        const videos = await fetchYouTubeContent(source.config.url, source.config.name || source.name || '');
        return videos.map(item => ({
          sender: 'PodcastIA News',
          content: `${item.title}\n\n${item.content}`.trim(),
          group_name: groupName,
        }));
      }

      case 'news': {
        const keywords = source.config.keywords || [];
        const topics = source.config.topics || [];
        if (keywords.length === 0 && topics.length === 0) {
          console.error('[source-fetcher] News source missing keywords and topics in config');
          return [];
        }
        const articles = await fetchNewsForTopics(keywords, topics);
        return articles.map(item => ({
          sender: 'PodcastIA News',
          content: `${item.title}\n\n${item.content}\n\nFonte: ${item.source}`.trim(),
          group_name: groupName,
        }));
      }

      case 'http_request': {
        if (!source.config.url) {
          console.error('[source-fetcher] HTTP Request source missing url in config');
          return [];
        }
        return await fetchHttpRequestContent(source);
      }

      case 'webhook': {
        // Webhook is push-based — content arrives via the webhook endpoint,
        // not via polling. Nothing to fetch here.
        return [];
      }

      case 'instagram': {
        console.log('[source-fetcher] Instagram source not implemented yet - returning empty');
        return [];
      }

      case 'twitter': {
        console.log('[source-fetcher] Twitter/X source not implemented yet - returning empty');
        return [];
      }

      case 'telegram': {
        console.log('[source-fetcher] Telegram source not implemented yet - returning empty');
        return [];
      }

      case 'email': {
        console.log('[source-fetcher] Email source not implemented yet - returning empty');
        return [];
      }

      default: {
        console.warn(`[source-fetcher] Unknown source type: ${source.type}`);
        return [];
      }
    }
  } catch (error: any) {
    console.error(`[source-fetcher] Error processing source type "${source.type}":`, error.message);
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
          // Try to extract title + content/description from each item
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
