/**
 * Enhanced News Fetcher for PodcastIA
 * Fetches recent news articles for given keywords and topics.
 * Uses Google News search and Brazilian news RSS feeds as fallback.
 * Only built-in Node.js APIs (fetch).
 *
 * Features: deduplication, source diversity, proper error handling, timeout.
 */

export interface NewsItem {
  title: string;
  content: string;
  source: string;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Known Brazilian news RSS feeds for fallback.
 */
const NEWS_RSS_FEEDS: Record<string, string> = {
  g1: 'https://g1.globo.com/rss/g1/',
  folha: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml',
  uol: 'https://rss.uol.com.br/feed/noticias.xml',
  bbc_brasil: 'https://www.bbc.com/portuguese/index.xml',
};

/**
 * Strip HTML tags and decode entities.
 */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
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
 * Calculate simple similarity between two strings (Jaccard on words).
 * Returns 0-1 where 1 is identical.
 */
function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

/**
 * Fetch news results from Google News search for a query.
 */
async function fetchGoogleNews(query: string): Promise<NewsItem[]> {
  try {
    const encodedQuery = encodeURIComponent(`${query} noticias`);
    const url = `https://www.google.com/search?q=${encodedQuery}&tbm=nws&hl=pt-BR&num=10`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[news-fetcher] Google search HTTP ${response.status} for "${query}"`);
      return [];
    }

    const html = await response.text();
    const results: NewsItem[] = [];

    // Google News results pattern: extract title and snippet blocks
    const titleRegex = /role="heading"[^>]*>([\s\S]*?)<\//g;
    const titles: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = titleRegex.exec(html)) !== null) {
      const title = stripHtml(match[1]);
      if (title && title.length > 10) {
        titles.push(title);
      }
    }

    // Alternative: extract from <h3> tags (common in search results)
    if (titles.length === 0) {
      const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/g;
      while ((match = h3Regex.exec(html)) !== null) {
        const title = stripHtml(match[1]);
        if (title && title.length > 10) {
          titles.push(title);
        }
      }
    }

    // Extract snippet/description blocks near titles
    const snippetRegex = /<div[^>]*class="[^"]*(?:snippet|description|BNeawe s3v9rd)[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    const snippets: string[] = [];
    while ((match = snippetRegex.exec(html)) !== null) {
      const snippet = stripHtml(match[1]);
      if (snippet && snippet.length > 20) {
        snippets.push(snippet);
      }
    }

    // Combine titles and snippets
    for (let i = 0; i < titles.length; i++) {
      results.push({
        title: titles[i],
        content: snippets[i] || '',
        source: 'Google News',
      });
    }

    return results;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[news-fetcher] Timeout on Google search for "${query}"`);
    } else {
      console.error(`[news-fetcher] Error searching Google for "${query}":`, error.message);
    }
    return [];
  }
}

/**
 * Fetch news from a known RSS feed and filter by keywords.
 */
async function fetchFromRSSFeed(feedUrl: string, keywords: string[], sourceName: string): Promise<NewsItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return [];

    const xml = await response.text();
    const results: NewsItem[] = [];

    // Parse RSS items
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descMatch = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);

      const title = stripHtml(titleMatch?.[1] || '');
      const desc = stripHtml(descMatch?.[1] || '');
      const fullText = `${title} ${desc}`.toLowerCase();

      // Check if any keyword matches
      const hasKeyword = keywords.length === 0 || keywords.some(kw =>
        fullText.includes(kw.toLowerCase())
      );

      if (hasKeyword && title) {
        results.push({
          title,
          content: desc,
          source: sourceName,
        });
      }
    }

    return results.slice(0, 10);
  } catch (error: any) {
    console.error(`[news-fetcher] Error fetching RSS ${feedUrl}:`, error.message);
    return [];
  }
}

/**
 * Deduplicate news items by title similarity.
 * Items with >60% word overlap are considered duplicates.
 * Prefers items with longer content.
 */
function deduplicateNews(items: NewsItem[]): NewsItem[] {
  const unique: NewsItem[] = [];

  for (const item of items) {
    const duplicateIdx = unique.findIndex(existing =>
      titleSimilarity(existing.title, item.title) > 0.6
    );
    if (duplicateIdx === -1) {
      unique.push(item);
    } else {
      // Keep the version with more content
      if (item.content.length > unique[duplicateIdx].content.length) {
        unique[duplicateIdx] = item;
      }
    }
  }

  return unique;
}

/**
 * Ensure source diversity — no single source dominates > 50% of results.
 * Re-orders items to interleave sources.
 */
function ensureSourceDiversity(items: NewsItem[], maxPerSource: number): NewsItem[] {
  const bySource: Record<string, NewsItem[]> = {};
  for (const item of items) {
    const src = item.source || 'unknown';
    if (!bySource[src]) bySource[src] = [];
    bySource[src].push(item);
  }

  // Cap each source
  for (const src of Object.keys(bySource)) {
    bySource[src] = bySource[src].slice(0, maxPerSource);
  }

  // Interleave: round-robin across sources
  const result: NewsItem[] = [];
  const sources = Object.keys(bySource);
  let added = true;
  let round = 0;
  while (added) {
    added = false;
    for (const src of sources) {
      if (round < bySource[src].length) {
        result.push(bySource[src][round]);
        added = true;
      }
    }
    round++;
  }

  return result;
}

/**
 * Fetch news articles for given keywords and topics.
 * Combines Google News search with Brazilian news RSS feeds.
 * Returns top 20 unique, source-diverse results.
 * Returns empty array on error.
 */
export async function fetchNewsForTopics(
  keywords: string[] = [],
  topics: string[] = []
): Promise<NewsItem[]> {
  try {
    const allItems: NewsItem[] = [];
    const searchTerms = [...keywords, ...topics].filter(Boolean);

    if (searchTerms.length === 0) {
      console.warn('[news-fetcher] No keywords or topics provided');
      return [];
    }

    // Sample up to 8 diverse search terms (prioritize topics, then keywords)
    const topicTerms = topics.filter(Boolean).slice(0, 5);
    const keywordTerms = keywords.filter(Boolean).filter(k => !topicTerms.includes(k));
    const kwStep = Math.max(1, Math.floor(keywordTerms.length / (8 - topicTerms.length)));
    const sampledKw = keywordTerms.filter((_, i) => i % kwStep === 0).slice(0, 8 - topicTerms.length);
    const diverseTerms = [...topicTerms, ...sampledKw].slice(0, 8);

    console.log(`[news-fetcher] Fetching news for ${diverseTerms.length} terms: ${diverseTerms.join(', ')}`);

    // Fetch from Google News for each search term (in parallel)
    const googlePromises = diverseTerms.map(term => fetchGoogleNews(term));

    // Also fetch from known RSS feeds with keyword filtering
    const rssPromises = Object.entries(NEWS_RSS_FEEDS).map(([name, url]) =>
      fetchFromRSSFeed(url, searchTerms, name)
    );

    const results = await Promise.allSettled([...googlePromises, ...rssPromises]);

    let successCount = 0;
    let failCount = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log(`[news-fetcher] Fetched ${allItems.length} raw items (${successCount} sources OK, ${failCount} failed)`);

    // Deduplicate
    const unique = deduplicateNews(allItems);
    console.log(`[news-fetcher] After dedup: ${unique.length} unique items (removed ${allItems.length - unique.length} duplicates)`);

    // Ensure source diversity (max 8 per source out of 20 total)
    const diverse = ensureSourceDiversity(unique, 8);

    return diverse.slice(0, 20);
  } catch (error: any) {
    console.error('[news-fetcher] Unexpected error:', error.message);
    return [];
  }
}
