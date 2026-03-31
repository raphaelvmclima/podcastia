/**
 * RSS/Blog Feed Processor for PodcastIA
 * Fetches and parses RSS 2.0 and Atom feeds using only built-in APIs.
 */

export interface RSSItem {
  title: string;
  content: string;
  pubDate: string;
}

/**
 * Strip HTML tags from a string, decode common HTML entities.
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
 * Extract text content from an XML tag. Handles CDATA sections.
 */
function extractTag(xml: string, tagName: string): string {
  // Try with namespace prefix first (e.g., content:encoded, dc:date)
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

/**
 * Parse RSS 2.0 feed items from XML string.
 */
function parseRSS2(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = stripHtml(extractTag(itemXml, 'title'));
    const contentEncoded = extractTag(itemXml, 'content:encoded');
    const description = extractTag(itemXml, 'description');
    const content = stripHtml(contentEncoded || description);
    const pubDate = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date');

    if (title || content) {
      items.push({ title, content, pubDate });
    }
  }

  return items;
}

/**
 * Parse Atom feed entries from XML string.
 */
function parseAtom(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];
    const title = stripHtml(extractTag(entryXml, 'title'));

    // Atom content or summary
    const contentTag = extractTag(entryXml, 'content');
    const summary = extractTag(entryXml, 'summary');
    const content = stripHtml(contentTag || summary);

    // Atom uses <updated> or <published>
    const pubDate = extractTag(entryXml, 'published') || extractTag(entryXml, 'updated');

    if (title || content) {
      items.push({ title, content, pubDate });
    }
  }

  return items;
}

/**
 * Fetch and parse an RSS or Atom feed URL.
 * Returns the last 10 items sorted by date (newest first).
 * Returns empty array on any error.
 */
export async function fetchRSSContent(feedUrl: string): Promise<RSSItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'PodcastIA-Bot/1.0',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[rss-processor] HTTP ${response.status} fetching ${feedUrl}`);
      return [];
    }

    const xml = await response.text();

    // Detect feed type and parse accordingly
    let items: RSSItem[];

    if (xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"')) {
      items = parseAtom(xml);
    } else if (xml.includes('<feed')) {
      // Atom feed without standard namespace declaration
      items = parseAtom(xml);
    } else {
      // Default to RSS 2.0 parsing
      items = parseRSS2(xml);
    }

    // Sort by date descending
    items.sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      if (isNaN(dateA) && isNaN(dateB)) return 0;
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;
      return dateB - dateA;
    });

    // Return last 10 items
    return items.slice(0, 10);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[rss-processor] Timeout fetching ${feedUrl}`);
    } else {
      console.error(`[rss-processor] Error fetching ${feedUrl}:`, error.message);
    }
    return [];
  }
}
