import * as cheerio from 'cheerio';

/**
 * ONRC URL Discovery Service
 *
 * Automatically discovers and validates ONRC procedure URLs by crawling
 * the navigation structure. This prevents hardcoded URLs from breaking
 * when ONRC restructures their website.
 */

export interface DiscoveredProcedure {
  id: string;
  name: string;
  url: string;
  category: 'inmatriculari' | 'mentiuni' | 'dizolvari';
  confidence: number;
  discoveredAt: string;
}

export interface URLHealthStatus {
  url: string;
  status: 'healthy' | 'broken' | 'redirected';
  httpCode: number;
  checkedAt: string;
  newUrl?: string;
}

// Known ONRC navigation entry points
const ONRC_NAV_PAGES = {
  inmatriculari: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
  mentiuni: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
  dizolvari: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-juridice',
};

// Keywords to identify procedure types
const PROCEDURE_KEYWORDS: Record<string, string[]> = {
  'infiintare-srl': ['societate cu raspundere limitata', 'srl', 'infiintare', 'înființare'],
  'infiintare-srl-d': ['srl-d', 'debutant', 'microintreprindere'],
  'cesiune-parti-sociale': ['cesiune', 'transmitere', 'parti sociale', 'părți sociale'],
  'schimbare-administrator': ['administrator', 'conducere', 'control', 'director', 'cenzor'],
  'majorare-capital': ['majorare', 'capital social', 'marire capital'],
  'schimbare-sediu': ['sediu social', 'schimbarea sediului', 'mutare sediu'],
  'dizolvare-lichidare': ['dizolvare', 'lichidare', 'radiere', 'desfiintare'],
};

/**
 * Check if a URL is accessible
 */
export async function checkURLHealth(url: string): Promise<URLHealthStatus> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LegalPlatformBot/1.0)',
      },
      redirect: 'manual',
    });

    const status: URLHealthStatus = {
      url,
      httpCode: response.status,
      checkedAt: new Date().toISOString(),
      status: 'healthy',
    };

    if (response.status === 404 || response.status === 410) {
      status.status = 'broken';
    } else if (response.status >= 300 && response.status < 400) {
      status.status = 'redirected';
      status.newUrl = response.headers.get('location') || undefined;
    } else if (response.status >= 400) {
      status.status = 'broken';
    }

    return status;
  } catch (error) {
    return {
      url,
      httpCode: 0,
      status: 'broken',
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Discover all procedure URLs from ONRC navigation pages
 */
export async function discoverProcedureURLs(): Promise<DiscoveredProcedure[]> {
  const discovered: DiscoveredProcedure[] = [];

  for (const [category, navUrl] of Object.entries(ONRC_NAV_PAGES)) {
    try {
      const response = await fetch(navUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LegalPlatformBot/1.0)',
          'Accept-Language': 'ro-RO,ro;q=0.9',
        },
      });

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract all links from the navigation
      const links: Array<{ href: string; text: string }> = [];

      // Look for links in navigation divs and lists
      $('a[href*="/index.php"], div[onclick*="/index.php"]').each((_, el) => {
        const $el = $(el);
        let href = $el.attr('href') || '';

        // Handle onclick navigation
        if (!href) {
          const onclick = $el.attr('onclick') || '';
          const match = onclick.match(/window\.location='([^']+)'/);
          if (match) href = match[1];
        }

        const text = $el.text().trim();

        if (
          href &&
          text &&
          href.includes(category === 'dizolvari' ? 'dizolv' : category.slice(0, 6))
        ) {
          // Normalize URL
          if (href.startsWith('/')) {
            href = `https://www.onrc.ro${href}`;
          }
          if (!href.includes('/ro/')) {
            href = href.replace('/index.php/', '/index.php/ro/');
          }
          links.push({ href, text });
        }
      });

      // Match discovered links to known procedure types
      for (const link of links) {
        const procedureId = identifyProcedure(link.href, link.text);
        if (procedureId) {
          discovered.push({
            id: procedureId,
            name: cleanProcedureName(link.text),
            url: link.href,
            category: category as 'inmatriculari' | 'mentiuni' | 'dizolvari',
            confidence: calculateConfidence(link.href, link.text, procedureId),
            discoveredAt: new Date().toISOString(),
          });
        }
      }

      // Be polite
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to crawl ${navUrl}:`, error);
    }
  }

  // Deduplicate by ID, keeping highest confidence
  const byId = new Map<string, DiscoveredProcedure>();
  for (const proc of discovered) {
    const existing = byId.get(proc.id);
    if (!existing || proc.confidence > existing.confidence) {
      byId.set(proc.id, proc);
    }
  }

  return Array.from(byId.values());
}

/**
 * Identify which procedure a URL/text corresponds to
 */
function identifyProcedure(url: string, text: string): string | null {
  const combined = (url + ' ' + text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics

  for (const [procedureId, keywords] of Object.entries(PROCEDURE_KEYWORDS)) {
    const matchCount = keywords.filter((kw) =>
      combined.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    ).length;

    if (
      matchCount >= 2 ||
      (matchCount === 1 && keywords.some((kw) => kw.length > 10 && combined.includes(kw)))
    ) {
      return procedureId;
    }
  }

  return null;
}

/**
 * Calculate confidence score for a discovered URL
 */
function calculateConfidence(url: string, text: string, procedureId: string): number {
  const keywords = PROCEDURE_KEYWORDS[procedureId] || [];
  const combined = (url + ' ' + text).toLowerCase();

  let score = 0.5; // Base score

  // URL contains procedure-specific path
  if (url.includes(procedureId.replace(/-/g, ''))) score += 0.2;

  // Multiple keyword matches
  const matches = keywords.filter((kw) => combined.includes(kw)).length;
  score += Math.min(matches * 0.1, 0.3);

  return Math.min(score, 1.0);
}

/**
 * Clean up procedure name from scraped text
 */
function cleanProcedureName(text: string): string {
  return text
    .replace(/^\d+\.\s*/, '') // Remove leading numbers
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find a replacement URL for a broken procedure URL
 */
export async function findReplacementURL(
  procedureId: string,
  brokenUrl: string
): Promise<string | null> {
  console.log(`[URL Discovery] Searching for replacement URL for ${procedureId}...`);

  const discovered = await discoverProcedureURLs();
  const match = discovered.find((d) => d.id === procedureId);

  if (match && match.url !== brokenUrl) {
    console.log(
      `[URL Discovery] Found replacement: ${match.url} (confidence: ${match.confidence})`
    );
    return match.url;
  }

  return null;
}

/**
 * Validate all configured URLs and report status
 */
export async function validateAllURLs(
  urls: Array<{ id: string; url: string; fallbackUrl?: string }>
): Promise<Map<string, URLHealthStatus>> {
  const results = new Map<string, URLHealthStatus>();

  for (const { id, url, fallbackUrl } of urls) {
    const status = await checkURLHealth(url);
    results.set(id, status);

    if (status.status === 'broken' && fallbackUrl) {
      const fallbackStatus = await checkURLHealth(fallbackUrl);
      results.set(`${id}-fallback`, fallbackStatus);
    }

    // Be polite
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return results;
}
