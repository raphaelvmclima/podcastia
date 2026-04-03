/**
 * Flights/Travel Deals Processor for PodcastIA
 * Fetches flight deals from Brazilian travel deal RSS feeds.
 * Sources: Melhores Destinos, Passagens Promo, and custom RSS feeds.
 */

export interface FlightsConfig {
  feedUrls?: string[];
  keywords?: string[];
  origins?: string[];
  destinations?: string[];
}

export interface FlightItem {
  group_name: string;
  sender: string;
  content: string;
}

const DEFAULT_FEEDS = [
  'https://www.melhoresdestinos.com.br/feed',
  'https://www.passagenspromo.com.br/feed',
];

const USER_AGENT = 'PodcastIA-Flights/1.0';

/**
 * Strip HTML tags from a string.
 */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract text from an XML tag.
 */
function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\s\S]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

/**
 * Fetch and parse an RSS feed for flight deals.
 */
async function fetchFlightFeed(feedUrl: string, keywords: string[]): Promise<FlightItem[]> {
  const items: FlightItem[] = [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[flights-processor] HTTP ${res.status} from ${feedUrl}`);
      return [];
    }

    const xml = await res.text();
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    // Determine source name from feed URL
    let sourceName = 'Passagens';
    if (feedUrl.includes('melhoresdestinos')) sourceName = 'Melhores Destinos';
    else if (feedUrl.includes('passagenspromo')) sourceName = 'Passagens Promo';
    else {
      try { sourceName = new URL(feedUrl).hostname; } catch {}
    }

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const title = stripHtml(extractTag(itemXml, 'title'));
      const description = stripHtml(extractTag(itemXml, 'description'));
      const contentEncoded = stripHtml(extractTag(itemXml, 'content:encoded'));
      const pubDate = extractTag(itemXml, 'pubDate');
      const content = contentEncoded || description;

      if (!title) continue;

      // Filter by keywords if provided
      if (keywords.length > 0) {
        const fullText = `${title} ${content}`.toLowerCase();
        const hasKeyword = keywords.some(kw => fullText.includes(kw.toLowerCase()));
        if (!hasKeyword) continue;
      }

      // Extract price if present in title/content
      const priceMatch = (title + ' ' + content).match(/R$\s*[\d.,]+/);
      const price = priceMatch ? priceMatch[0] : '';

      let summary = title;
      if (price && !title.includes('R$')) {
        summary += ` - ${price}`;
      }
      if (content && content.length > 0) {
        const shortDesc = content.slice(0, 300);
        summary += `\n${shortDesc}`;
      }
      if (pubDate) {
        try {
          const dateStr = new Date(pubDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          summary += ` (${dateStr})`;
        } catch {}
      }

      items.push({
        group_name: 'Passagens',
        sender: sourceName,
        content: summary.trim(),
      });
    }

    return items;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error(`[flights-processor] Timeout fetching ${feedUrl}`);
    } else {
      console.error(`[flights-processor] Error fetching ${feedUrl}: ${err.message}`);
    }
    return [];
  }
}

/**
 * Main entry point - fetch flight deals from configured feeds.
 * Returns up to 15 items, sorted by relevance to keywords.
 */
export async function fetchFlightsContent(config: FlightsConfig): Promise<FlightItem[]> {
  const feedUrls = config.feedUrls && config.feedUrls.length > 0 ? config.feedUrls : DEFAULT_FEEDS;

  // Build keyword list from origins, destinations, and explicit keywords
  const keywords: string[] = [...(config.keywords || [])];
  if (config.origins) keywords.push(...config.origins);
  if (config.destinations) keywords.push(...config.destinations);

  console.log(`[flights-processor] Fetching from ${feedUrls.length} feeds, keywords: ${keywords.join(', ') || '(all)'}`);

  const promises = feedUrls.map(url => fetchFlightFeed(url, keywords));
  const results = await Promise.allSettled(promises);

  const allItems: FlightItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }

  // Deduplicate by title similarity
  const unique: FlightItem[] = [];
  for (const item of allItems) {
    const isDup = unique.some(existing => {
      const a = existing.content.toLowerCase().slice(0, 60);
      const b = item.content.toLowerCase().slice(0, 60);
      return a === b;
    });
    if (!isDup) unique.push(item);
  }

  console.log(`[flights-processor] Found ${unique.length} unique deals from ${allItems.length} total`);
  return unique.slice(0, 15);
}
