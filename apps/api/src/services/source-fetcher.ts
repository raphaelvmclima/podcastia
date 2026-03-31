/**
 * Source Fetcher - Main Orchestrator for PodcastIA
 * Routes source fetch requests to the appropriate processor
 * and transforms results into captured_message format.
 */

import { fetchRSSContent } from './rss-processor';
import { fetchYouTubeContent } from './youtube-processor';
import { fetchNewsForTopics } from './news-fetcher';

export interface SourceConfig {
  type: string;
  config: {
    url?: string;
    keywords?: string[];
    topics?: string[];
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
};

/**
 * Fetch content from a source and transform into captured_message format.
 *
 * @param source - The source definition with type and config
 * @returns Array of messages ready to insert into captured_messages table
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
        const videos = await fetchYouTubeContent(source.config.url);
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
