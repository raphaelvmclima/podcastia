/**
 * YouTube Channel/Playlist Processor for PodcastIA
 * Fetches video listings from YouTube channels via their RSS feeds.
 * Uses only built-in Node.js APIs (fetch).
 */

import { fetchRSSContent, type RSSItem } from './rss-processor';

const YOUTUBE_RSS_BASE = 'https://www.youtube.com/feeds/videos.xml';

/**
 * Extract channel ID from a YouTube channel URL.
 * Supports formats:
 *   - https://www.youtube.com/channel/UC...
 *   - https://www.youtube.com/@handle
 *   - https://youtube.com/c/ChannelName
 *   - Direct channel ID string (UC...)
 */
async function extractChannelId(channelUrl: string): Promise<string | null> {
  try {
    // Already a channel ID (starts with UC and is ~24 chars)
    if (/^UC[\w-]{20,}$/.test(channelUrl)) {
      return channelUrl;
    }

    // Direct channel URL: /channel/UC...
    const channelMatch = channelUrl.match(/\/channel\/(UC[\w-]+)/);
    if (channelMatch) {
      return channelMatch[1];
    }

    // Need to fetch the page to extract channel_id for @handle or /c/ URLs
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(channelUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[youtube-processor] HTTP ${response.status} fetching ${channelUrl}`);
      return null;
    }

    const html = await response.text();

    // Try multiple patterns to find channel_id in the page HTML
    const patterns = [
      /"channelId"\s*:\s*"(UC[\w-]+)"/,
      /"externalId"\s*:\s*"(UC[\w-]+)"/,
      /channel_id=(UC[\w-]+)/,
      /<meta\s+itemprop="channelId"\s+content="(UC[\w-]+)"/,
      /data-channel-external-id="(UC[\w-]+)"/,
      /"browseId"\s*:\s*"(UC[\w-]+)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        return match[1];
      }
    }

    console.error(`[youtube-processor] Could not extract channel_id from ${channelUrl}`);
    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[youtube-processor] Timeout fetching channel page: ${channelUrl}`);
    } else {
      console.error(`[youtube-processor] Error extracting channel ID:`, error.message);
    }
    return null;
  }
}

/**
 * Fetch latest videos from a YouTube channel.
 * Resolves the channel URL to a channel ID, then fetches the YouTube RSS feed.
 * Returns last 10 videos with title, description, and publish date.
 * Returns empty array on any error.
 */
export async function fetchYouTubeContent(channelUrl: string): Promise<RSSItem[]> {
  try {
    const channelId = await extractChannelId(channelUrl);

    if (!channelId) {
      console.error(`[youtube-processor] Failed to resolve channel ID for: ${channelUrl}`);
      return [];
    }

    const feedUrl = `${YOUTUBE_RSS_BASE}?channel_id=${channelId}`;
    console.log(`[youtube-processor] Fetching feed: ${feedUrl}`);

    // Reuse the RSS processor since YouTube feeds are standard Atom
    const items = await fetchRSSContent(feedUrl);

    return items;
  } catch (error: any) {
    console.error(`[youtube-processor] Error processing ${channelUrl}:`, error.message);
    return [];
  }
}
