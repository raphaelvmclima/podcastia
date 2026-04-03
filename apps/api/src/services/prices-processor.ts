/**
 * Product Prices Processor for PodcastIA
 * Monitors product prices via Google Shopping scraping and price comparison RSS feeds.
 * Fallback to Brazilian price comparison sites (Promobit, Pelando).
 */

export interface PricesConfig {
  products: string[];
  region?: string;
  feedUrls?: string[];
}

export interface PriceItem {
  group_name: string;
  sender: string;
  content: string;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PROMO_FEEDS = [
  'https://www.promobit.com.br/feed',
];

/**
 * Strip HTML tags.
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
 * Extract tag content from XML.
 */
function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

/**
 * Search Google Shopping for a product and extract prices.
 */
async function searchGoogleShopping(product: string, region: string): Promise<PriceItem[]> {
  const items: PriceItem[] = [];
  const query = encodeURIComponent(`${product} preco ${region}`);
  const url = `https://www.google.com/search?q=${query}&tbm=shop&hl=pt-BR&gl=BR`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[prices-processor] Google Shopping HTTP ${res.status} for "${product}"`);
      return [];
    }

    const html = await res.text();

    // Extract price blocks (R$ X.XXX,XX)
    const priceBlockRegex = /R\$\s*[\d.,]+/g;
    const prices = html.match(priceBlockRegex) || [];

    // Extract product names near prices from heading tags
    const nameRegex = /(?:role="heading"|<h[34][^>]*>)([\s\S]*?)(?:<\/|<\/h[34]>)/gi;
    const names: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = nameRegex.exec(html)) !== null) {
      const name = stripHtml(match[1]);
      if (name && name.length > 5 && name.length < 200) names.push(name);
    }

    // Extract store names
    const storeRegex = /class="[^"]*(?:merchant|store|aULzUe)[^"]*"[^>]*>([^<]+)</gi;
    const stores: string[] = [];
    while ((match = storeRegex.exec(html)) !== null) {
      const store = stripHtml(match[1]);
      if (store && store.length > 1 && store.length < 100) stores.push(store);
    }

    // Combine results
    const numResults = Math.min(prices.length, 5);
    const resultParts: string[] = [];

    for (let i = 0; i < numResults; i++) {
      const price = prices[i];
      const store = stores[i] || '';
      const part = store ? `${price} (${store})` : price;
      resultParts.push(part);
    }

    if (resultParts.length > 0) {
      items.push({
        group_name: 'Precos',
        sender: 'Google Shopping',
        content: `${product}: ${resultParts.join(' / ')}`,
      });
    }

    return items;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error(`[prices-processor] Timeout searching Google Shopping for "${product}"`);
    } else {
      console.error(`[prices-processor] Error searching "${product}": ${err.message}`);
    }
    return [];
  }
}

/**
 * Fetch deals from promo RSS feeds filtered by product keywords.
 */
async function fetchPromoFeeds(products: string[], feedUrls: string[]): Promise<PriceItem[]> {
  const items: PriceItem[] = [];

  for (const feedUrl of feedUrls) {
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

      if (!res.ok) continue;

      const xml = await res.text();
      const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
      let match: RegExpExecArray | null;

      let sourceName = 'Promocoes';
      if (feedUrl.includes('promobit')) sourceName = 'Promobit';
      else if (feedUrl.includes('pelando')) sourceName = 'Pelando';
      else {
        try { sourceName = new URL(feedUrl).hostname; } catch {}
      }

      while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        const title = stripHtml(extractTag(itemXml, 'title'));
        const description = stripHtml(extractTag(itemXml, 'description'));
        const fullText = `${title} ${description}`.toLowerCase();

        // Filter by product keywords
        const matchesProduct = products.some(p => {
          const keywords = p.toLowerCase().split(/\s+/);
          return keywords.every(kw => fullText.includes(kw));
        });

        if (!matchesProduct) continue;

        let content = title;
        if (description && description.length < 300) {
          content += `\n${description}`;
        }

        items.push({
          group_name: 'Precos',
          sender: sourceName,
          content: content.trim(),
        });
      }
    } catch (err: any) {
      clearTimeout(timeout);
      console.error(`[prices-processor] Error fetching promo feed ${feedUrl}: ${err.message}`);
    }
  }

  return items.slice(0, 10);
}

/**
 * Main entry point - search product prices from multiple sources.
 */
export async function fetchPricesContent(config: PricesConfig): Promise<PriceItem[]> {
  if (!config.products || config.products.length === 0) {
    console.error('[prices-processor] No products configured');
    return [];
  }

  const region = config.region || 'Brasil';
  const feedUrls = config.feedUrls && config.feedUrls.length > 0 ? config.feedUrls : PROMO_FEEDS;

  console.log(`[prices-processor] Searching prices for ${config.products.length} products: ${config.products.join(', ')}`);

  // Search Google Shopping for each product (in parallel, max 5)
  const googlePromises = config.products.slice(0, 5).map(product =>
    searchGoogleShopping(product, region)
  );

  // Also search promo feeds
  const promoPromise = fetchPromoFeeds(config.products, feedUrls);

  const results = await Promise.allSettled([...googlePromises, promoPromise]);

  const allItems: PriceItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }

  console.log(`[prices-processor] Found ${allItems.length} price results`);
  return allItems.slice(0, 20);
}
