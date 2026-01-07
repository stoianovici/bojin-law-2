import * as cheerio from 'cheerio';
import type { SlotDefinition } from '@/types/mapa';
import crypto from 'crypto';
import { analyzeONRCContent, enrichSlotDefinitions, type RawDocumentItem } from '@/lib/ai';
import { checkURLHealth, findReplacementURL } from './url-discovery';
import {
  ONRC_STRUCTURE,
  getAllProcedures,
  getProcedureLocation,
  type ONRCProcedure,
} from './procedures';

// Re-export the structure for convenience
export { ONRC_STRUCTURE, getAllProcedures, getProcedureLocation };
export type { ONRCProcedure };

// Legacy export for backward compatibility
export const ONRC_PROCEDURES = getAllProcedures().map((p) => {
  const location = getProcedureLocation(p.id);
  return {
    ...p,
    category: location?.category.id || 'unknown',
    subcategory: location?.subcategory.id || 'unknown',
  };
});

export interface ScrapedTemplate {
  id: string;
  name: string;
  description: string;
  sourceUrl: string;
  category: string;
  subcategory: string;
  slotDefinitions: SlotDefinition[];
  contentHash: string;
  scrapedAt: string;
  error?: string;
  // AI enhancement metadata
  aiEnhanced?: boolean;
  aiConfidence?: number;
  procedureSummary?: string;
  legalContext?: string;
  aiWarnings?: string[];
  // URL health metadata
  urlStatus?: 'healthy' | 'recovered' | 'fallback';
  originalUrl?: string;
  recoveredUrl?: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  templates: ScrapedTemplate[];
  errors: Array<{ procedureId: string; error: string }>;
  syncedAt: string;
}

/**
 * Generate a content hash from slot definitions for change detection
 */
function generateContentHash(slots: SlotDefinition[]): string {
  const content = JSON.stringify(slots.map((s) => ({ name: s.name, required: s.required })));
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Check if text is a "Dacă este cazul" section header (standalone)
 */
function isDacaEsteCazulHeader(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower === 'dacă este cazul' ||
    lower === 'daca este cazul' ||
    lower === 'dacă este cazul:' ||
    lower === 'daca este cazul:'
  );
}

/**
 * Check if text starts with "Dacă este cazul" prefix (inline conditional)
 * Returns the document name after the prefix, or null if not a match
 */
function extractAfterDacaEsteCazul(text: string): string | null {
  const lower = text.toLowerCase().trim();
  const patterns = [/^dacă este cazul[,:\s]+(.+)/i, /^daca este cazul[,:\s]+(.+)/i];

  for (const pattern of patterns) {
    const match = text.trim().match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

interface ParseResult {
  slots: SlotDefinition[];
  rawItems: RawDocumentItem[];
}

/**
 * Parse document requirements from ONRC HTML
 * Documents are split into two sections:
 * 1. Mandatory (everything before "Dacă este cazul" header) - required: true
 * 2. Conditional (everything after "Dacă este cazul" header) - required: false, category: 'daca_este_cazul'
 *
 * Returns both parsed slots and raw items for AI enhancement
 */
function parseDocumentRequirements($: cheerio.CheerioAPI, procedureId: string): ParseResult {
  const slots: SlotDefinition[] = [];
  const rawItems: RawDocumentItem[] = [];
  let order = 1;
  let rawIndex = 0;
  let inDacaEsteCazulSection = false;

  // Strategy 1: Look for ordered lists (most common format)
  // First, check if there's a "Dacă este cazul" section header
  const allElements: Array<{
    type: 'item' | 'header' | 'conditional_item';
    text: string;
    el: unknown;
  }> = [];

  // Collect all list items and potential headers
  $('ol > li, .content ol > li, article ol > li, .pagina_cu_module ol > li').each((_, el) => {
    const $el = $(el);
    const directText = $el.clone().children('ul, ol').remove().end().text().trim();
    const fullText = $el.text().trim();

    // Check if this item contains "Dacă este cazul" with nested list items
    if (
      isDacaEsteCazulHeader(directText) ||
      directText.toLowerCase().startsWith('dacă este cazul') ||
      directText.toLowerCase().startsWith('daca este cazul')
    ) {
      // Mark this as a header
      allElements.push({ type: 'header', text: directText, el });

      // Extract nested bullet points as conditional items
      $el.find('ul > li, ol > li').each((_, nestedEl) => {
        const nestedText = $(nestedEl).text().trim();
        if (nestedText.length > 5 && nestedText.length < 500) {
          allElements.push({ type: 'conditional_item', text: nestedText, el: nestedEl });
        }
      });
    } else if (fullText.length > 3) {
      allElements.push({ type: 'item', text: fullText, el });
    }
  });

  // Also look for headers/paragraphs that might contain "Dacă este cazul"
  $('p, h3, h4, h5, strong, b, .content p').each((_, el) => {
    const text = $(el).text().trim();
    if (isDacaEsteCazulHeader(text)) {
      allElements.push({ type: 'header', text, el });
    }
  });

  // Strategy 1b: Look for <ul> elements that follow the main <ol>
  // These typically contain conditional items after "Dacă este cazul"
  // ONRC uses nested <ul> structure: <ul><ul><ul><li>...</li></ul></ul></ul>
  $('ol').each((_, olEl) => {
    const $ol = $(olEl);
    // Check if the last <li> in this <ol> contains "Dacă este cazul"
    const $lastLi = $ol.find('> li').last();
    const lastLiText = $lastLi.text().trim();

    if (
      lastLiText.toLowerCase().startsWith('dacă este cazul') ||
      lastLiText.toLowerCase().startsWith('daca este cazul')
    ) {
      // Find <ul> elements that immediately follow this <ol>
      let $nextEl = $ol.next();
      while ($nextEl.length && $nextEl.is('ul')) {
        // Extract all <li> items from nested <ul> structure
        $nextEl.find('li').each((_, liEl) => {
          const liText = $(liEl).text().trim();
          // Only add if it's a document-like item (not just nested structure)
          if (
            liText.length > 10 &&
            liText.length < 500 &&
            !liText.toLowerCase().startsWith('dacă este cazul')
          ) {
            allElements.push({ type: 'conditional_item', text: liText, el: liEl });
          }
        });
        $nextEl = $nextEl.next();
        // Stop if we hit something that's not a <ul>
        if (!$nextEl.is('ul')) break;
      }
    }
  });

  // Process items
  for (const item of allElements) {
    if (item.type === 'header') {
      inDacaEsteCazulSection = true;
      continue;
    }

    // Handle conditional items from nested lists (always conditional)
    if (item.type === 'conditional_item') {
      const text = item.text;
      if (text.length > 5 && text.length < 500) {
        rawItems.push({
          text: text,
          isConditional: true,
          originalIndex: rawIndex++,
        });

        // Extract document name
        const nameParts = text.split(/[;,–-]/);
        let name = nameParts[0].trim();
        name = name.replace(/^\d+\.\s*/, '');
        name = name.replace(/^[a-z]\)\s*/i, '');
        name = name.replace(/\s+/g, ' ');

        if (name.length > 3 && name.length < 200) {
          const description = nameParts.slice(1).join(', ').trim() || undefined;
          slots.push({
            name: capitalizeFirst(name),
            description: description ? capitalizeFirst(description) : undefined,
            category: 'daca_este_cazul',
            required: false,
            order: order++,
          });
        }
      }
      continue;
    }

    if (item.type === 'item') {
      let text = item.text;
      if (text.length > 5 && text.length < 500) {
        // Check if this item itself is a "Dacă este cazul" header (standalone)
        if (isDacaEsteCazulHeader(text)) {
          inDacaEsteCazulSection = true;
          continue;
        }

        // Check if this item STARTS with "Dacă este cazul" (inline conditional)
        let isInlineConditional = false;
        const extractedAfterDaca = extractAfterDacaEsteCazul(text);
        if (extractedAfterDaca) {
          text = extractedAfterDaca;
          isInlineConditional = true;
        }

        // Capture raw item for AI analysis
        const hasConditionalKeywords =
          text.toLowerCase().includes('după caz') ||
          text.toLowerCase().includes('opțional') ||
          text.toLowerCase().includes('facultativ');
        const isConditional =
          inDacaEsteCazulSection || isInlineConditional || hasConditionalKeywords;

        rawItems.push({
          text: text,
          isConditional,
          originalIndex: rawIndex++,
        });

        // Extract document name (usually before the first comma or semicolon)
        const nameParts = text.split(/[;,–-]/);
        let name = nameParts[0].trim();

        // Clean up the name
        name = name.replace(/^\d+\.\s*/, ''); // Remove leading numbers
        name = name.replace(/^[a-z]\)\s*/i, ''); // Remove letter prefixes like "a)"
        name = name.replace(/\s+/g, ' '); // Normalize whitespace

        if (name.length > 3 && name.length < 200) {
          const isRequired = !isConditional;

          // Extract description (rest of the text)
          const description = nameParts.slice(1).join(', ').trim() || undefined;

          // Determine category based on section and keywords
          const category = isConditional ? 'daca_este_cazul' : determineCategory(name, text);

          slots.push({
            name: capitalizeFirst(name),
            description: description ? capitalizeFirst(description) : undefined,
            category,
            required: isRequired,
            order: order++,
          });
        }
      }
    }
  }

  // Strategy 2: Look for numbered paragraphs if no list found
  if (slots.length === 0) {
    inDacaEsteCazulSection = false;
    $('p, .content p, article p').each((_, el) => {
      const text = $(el).text().trim();

      // Check for "Dacă este cazul" header
      if (isDacaEsteCazulHeader(text)) {
        inDacaEsteCazulSection = true;
        return;
      }

      // Look for paragraphs starting with numbers
      const match = text.match(/^(\d+)[.)]\s*(.+)/);
      if (match) {
        const name = match[2].split(/[;,–-]/)[0].trim();
        if (name.length > 3 && name.length < 200) {
          // Capture raw item
          rawItems.push({
            text: match[2],
            isConditional: inDacaEsteCazulSection,
            originalIndex: rawIndex++,
          });

          const category = inDacaEsteCazulSection
            ? 'daca_este_cazul'
            : determineCategory(name, text);
          slots.push({
            name: capitalizeFirst(name),
            category,
            required: !inDacaEsteCazulSection,
            order: order++,
          });
        }
      }
    });
  }

  // Strategy 3: Look for bold text as document names
  if (slots.length === 0) {
    $('strong, b').each((_, el) => {
      const text = $(el).text().trim();
      if (
        text.length > 10 &&
        text.length < 200 &&
        (text.toLowerCase().includes('cerere') ||
          text.toLowerCase().includes('act') ||
          text.toLowerCase().includes('declarație') ||
          text.toLowerCase().includes('dovad'))
      ) {
        rawItems.push({
          text,
          isConditional: false,
          originalIndex: rawIndex++,
        });

        slots.push({
          name: capitalizeFirst(text),
          category: determineCategory(text, text),
          required: true,
          order: order++,
        });
      }
    });
  }

  // Remove duplicates by name
  const uniqueSlots = slots.filter(
    (slot, index, self) =>
      index === self.findIndex((s) => s.name.toLowerCase() === slot.name.toLowerCase())
  );

  return { slots: uniqueSlots, rawItems };
}

/**
 * Determine document category based on content
 */
function determineCategory(name: string, fullText: string): string {
  const lower = (name + ' ' + fullText).toLowerCase();

  if (lower.includes('cerere') || lower.includes('formular')) return 'formulare';
  if (lower.includes('act constitutiv') || lower.includes('statut')) return 'acte_constitutive';
  if (lower.includes('identitate') || lower.includes('pașaport') || lower.includes('ci'))
    return 'identitate';
  if (lower.includes('declarație') || lower.includes('specimen')) return 'declaratii';
  if (lower.includes('sediu') || lower.includes('spațiu') || lower.includes('închiriere'))
    return 'sediu';
  if (lower.includes('capital') || lower.includes('cont') || lower.includes('bancă'))
    return 'financiar';
  if (lower.includes('hotărâre') || lower.includes('haga') || lower.includes('aga'))
    return 'hotarari';
  if (lower.includes('certificat')) return 'certificate';
  if (lower.includes('contract') || lower.includes('cesiune')) return 'contracte';

  return 'diverse';
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export interface ScrapeOptions {
  useAI?: boolean;
  enrichWithAI?: boolean;
  autoRecoverURLs?: boolean;
}

/**
 * Fetch and parse a single ONRC procedure page
 * Optionally uses AI for enhanced content understanding
 * Can auto-recover from broken URLs by discovering new ones
 */
async function scrapeProcedure(
  procedure: (typeof ONRC_PROCEDURES)[0],
  options: ScrapeOptions = {}
): Promise<ScrapedTemplate> {
  const { useAI = false, enrichWithAI = false, autoRecoverURLs = true } = options;

  const result: ScrapedTemplate = {
    id: `onrc-${procedure.id}`,
    name: procedure.name,
    description: procedure.description,
    sourceUrl: procedure.url,
    originalUrl: procedure.url,
    category: procedure.category,
    subcategory: procedure.subcategory,
    slotDefinitions: [],
    contentHash: '',
    scrapedAt: new Date().toISOString(),
    aiEnhanced: false,
    urlStatus: 'healthy',
  };

  try {
    // Check URL health first
    const urlHealth = await checkURLHealth(procedure.url);
    let activeUrl = procedure.url;

    if (urlHealth.status === 'broken') {
      console.log(`[Scraper] URL broken for ${procedure.id}: ${procedure.url}`);

      // Try to auto-recover by discovering new URL
      if (autoRecoverURLs) {
        const recoveredUrl = await findReplacementURL(procedure.id, procedure.url);
        if (recoveredUrl) {
          console.log(`[Scraper] Recovered URL for ${procedure.id}: ${recoveredUrl}`);
          activeUrl = recoveredUrl;
          result.urlStatus = 'recovered';
          result.recoveredUrl = recoveredUrl;
        }
      }

      // If still broken, try fallback
      if (activeUrl === procedure.url && procedure.fallbackUrl) {
        const fallbackHealth = await checkURLHealth(procedure.fallbackUrl);
        if (fallbackHealth.status === 'healthy') {
          activeUrl = procedure.fallbackUrl;
          result.urlStatus = 'fallback';
        }
      }
    }

    // Fetch the active URL
    let response = await fetch(activeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LegalPlatformBot/1.0; +https://bojin.ro)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8',
      },
    });

    // If active URL fails, try fallback as last resort
    if (!response.ok && procedure.fallbackUrl && activeUrl !== procedure.fallbackUrl) {
      response = await fetch(procedure.fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LegalPlatformBot/1.0; +https://bojin.ro)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8',
        },
      });
      activeUrl = procedure.fallbackUrl;
      result.urlStatus = 'fallback';
    }

    result.sourceUrl = activeUrl;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Parse document requirements (returns both slots and raw items)
    const { slots, rawItems } = parseDocumentRequirements($, procedure.id);

    // If AI analysis is enabled, always try AI even with no pre-extracted items
    // AI can analyze the full HTML to find procedure-specific content
    if (useAI && process.env.ANTHROPIC_API_KEY) {
      try {
        console.log(`[AI] Analyzing ${procedure.name} with ${rawItems.length} items...`);

        const aiResult = await analyzeONRCContent(procedure.id, procedure.name, html, rawItems);

        if (aiResult.slots.length > 0 && aiResult.confidence > 0.6) {
          result.slotDefinitions = aiResult.slots;
          result.aiEnhanced = true;
          result.aiConfidence = aiResult.confidence;
          result.procedureSummary = aiResult.procedureSummary;
          result.legalContext = aiResult.legalContext;
          result.aiWarnings = aiResult.warnings;

          console.log(
            `[AI] Enhanced ${procedure.name}: ${aiResult.slots.length} slots (confidence: ${aiResult.confidence})`
          );
        } else {
          // AI result not reliable, use basic parsing
          result.slotDefinitions = slots;
          result.aiWarnings = ['AI analysis confidence too low, using basic parsing'];
        }
      } catch (aiError) {
        console.error(`[AI] Analysis failed for ${procedure.name}:`, aiError);
        result.slotDefinitions = slots;
        result.aiWarnings = [
          `AI analysis failed: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`,
        ];
      }
    } else if (enrichWithAI && slots.length > 0 && process.env.ANTHROPIC_API_KEY) {
      // Enrich existing slots with better descriptions
      try {
        console.log(`[AI] Enriching ${procedure.name} slots...`);
        const enrichedSlots = await enrichSlotDefinitions(procedure.name, slots);
        result.slotDefinitions = enrichedSlots;
        result.aiEnhanced = true;
        result.aiConfidence = 0.8;
        console.log(`[AI] Enriched ${procedure.name}: ${enrichedSlots.length} slots`);
      } catch (enrichError) {
        console.error(`[AI] Enrichment failed for ${procedure.name}:`, enrichError);
        result.slotDefinitions = slots;
      }
    } else {
      // No AI, use basic parsing
      result.slotDefinitions = slots;
    }

    // If no slots found, use fallback data
    if (result.slotDefinitions.length === 0) {
      result.slotDefinitions = getFallbackSlots(procedure.id);
      result.error = 'Used fallback data - page structure may have changed';
      result.aiEnhanced = false;
    }

    // Generate content hash
    result.contentHash = generateContentHash(result.slotDefinitions);
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.slotDefinitions = getFallbackSlots(procedure.id);
    result.contentHash = generateContentHash(result.slotDefinitions);
    result.aiEnhanced = false;
  }

  return result;
}

/**
 * Get fallback slot definitions for a procedure (used when scraping fails)
 * Comprehensive fallback data for all common ONRC procedures
 */
function getFallbackSlots(procedureId: string): SlotDefinition[] {
  const fallbacks: Record<string, SlotDefinition[]> = {
    // ============================================================================
    // ÎNMATRICULĂRI - Persoane Juridice
    // ============================================================================
    'infiintare-srl': [
      { name: 'Cerere de înregistrare', category: 'formulare', required: true, order: 1 },
      {
        name: 'Dovada verificării disponibilității denumirii',
        category: 'formulare',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv',
        description: 'Statutul societății',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      { name: 'Acte de identitate asociați', category: 'identitate', required: true, order: 4 },
      {
        name: 'Declarație pe propria răspundere administrator',
        category: 'declaratii',
        required: true,
        order: 5,
      },
      { name: 'Specimen de semnătură', category: 'declaratii', required: true, order: 6 },
      {
        name: 'Dovada sediului social',
        description: 'Contract închiriere/comodat sau act proprietate',
        category: 'sediu',
        required: true,
        order: 7,
      },
      {
        name: 'Dovada capitalului social',
        description: 'Extras de cont sau chitanță depunere',
        category: 'financiar',
        required: true,
        order: 8,
      },
      {
        name: 'Declarație privind beneficiarul real',
        category: 'declaratii',
        required: true,
        order: 9,
      },
      { name: 'Anexa 1 - Înregistrare fiscală', category: 'formulare', required: true, order: 10 },
    ],
    'infiintare-srl-d': [
      { name: 'Cerere de înregistrare SRL-D', category: 'formulare', required: true, order: 1 },
      {
        name: 'Dovada verificării disponibilității denumirii',
        category: 'formulare',
        required: true,
        order: 2,
      },
      { name: 'Actul constitutiv SRL-D', category: 'acte_constitutive', required: true, order: 3 },
      { name: 'Act de identitate asociat unic', category: 'identitate', required: true, order: 4 },
      {
        name: 'Declarație pe propria răspundere debutant',
        description: 'Declarație că îndeplinește condițiile SRL-D',
        category: 'declaratii',
        required: true,
        order: 5,
      },
      {
        name: 'Declarație privind beneficiarul real',
        category: 'declaratii',
        required: true,
        order: 6,
      },
      { name: 'Dovada sediului social', category: 'sediu', required: true, order: 7 },
    ],
    'infiintare-sa': [
      { name: 'Cerere de înregistrare SA', category: 'formulare', required: true, order: 1 },
      {
        name: 'Dovada verificării disponibilității denumirii',
        category: 'formulare',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv SA',
        description: 'Contract de societate și statut',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      { name: 'Acte de identitate fondatori', category: 'identitate', required: true, order: 4 },
      {
        name: 'Declarații administratori/directori',
        category: 'declaratii',
        required: true,
        order: 5,
      },
      { name: 'Specimen de semnătură', category: 'declaratii', required: true, order: 6 },
      { name: 'Dovada sediului social', category: 'sediu', required: true, order: 7 },
      {
        name: 'Dovada capitalului social',
        description: 'Min. 90.000 RON',
        category: 'financiar',
        required: true,
        order: 8,
      },
      {
        name: 'Declarație privind beneficiarul real',
        category: 'declaratii',
        required: true,
        order: 9,
      },
      {
        name: 'Raport evaluare aporturi în natură',
        category: 'financiar',
        required: false,
        order: 10,
      },
    ],
    'infiintare-gie': [
      { name: 'Cerere de înregistrare GIE', category: 'formulare', required: true, order: 1 },
      {
        name: 'Dovada verificării disponibilității denumirii',
        category: 'formulare',
        required: true,
        order: 2,
      },
      {
        name: 'Contractul de constituire GIE',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      { name: 'Acte de identitate membri', category: 'identitate', required: true, order: 4 },
      { name: 'Declarație administrator', category: 'declaratii', required: true, order: 5 },
      { name: 'Dovada sediului', category: 'sediu', required: true, order: 6 },
    ],

    // ============================================================================
    // ÎNMATRICULĂRI - Persoane Fizice
    // ============================================================================
    'infiintare-pfa': [
      { name: 'Cerere de înregistrare PFA', category: 'formulare', required: true, order: 1 },
      {
        name: 'Dovada verificării disponibilității denumirii',
        category: 'formulare',
        required: true,
        order: 2,
      },
      { name: 'Act de identitate', category: 'identitate', required: true, order: 3 },
      {
        name: 'Declarație pe propria răspundere',
        description: 'Privind îndeplinirea condițiilor legale',
        category: 'declaratii',
        required: true,
        order: 4,
      },
      {
        name: 'Dovada calificării profesionale',
        description: 'Diploma, certificat sau experiență',
        category: 'certificate',
        required: true,
        order: 5,
      },
      { name: 'Dovada sediului profesional', category: 'sediu', required: true, order: 6 },
      { name: 'Specimen de semnătură', category: 'declaratii', required: true, order: 7 },
    ],
    'infiintare-ii': [
      { name: 'Cerere de înregistrare II', category: 'formulare', required: true, order: 1 },
      {
        name: 'Dovada verificării disponibilității denumirii',
        category: 'formulare',
        required: true,
        order: 2,
      },
      { name: 'Act de identitate titular', category: 'identitate', required: true, order: 3 },
      {
        name: 'Declarație pe propria răspundere',
        category: 'declaratii',
        required: true,
        order: 4,
      },
      { name: 'Dovada sediului', category: 'sediu', required: true, order: 5 },
      { name: 'Specimen de semnătură', category: 'declaratii', required: true, order: 6 },
    ],
    'infiintare-if': [
      { name: 'Cerere de înregistrare IF', category: 'formulare', required: true, order: 1 },
      {
        name: 'Dovada verificării disponibilității denumirii',
        category: 'formulare',
        required: true,
        order: 2,
      },
      {
        name: 'Acordul de constituire',
        description: 'Semnat de membrii familiei',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      { name: 'Acte de identitate membri', category: 'identitate', required: true, order: 4 },
      {
        name: 'Documente stare civilă',
        description: 'Certificat căsătorie, naștere',
        category: 'identitate',
        required: true,
        order: 5,
      },
      { name: 'Declarație reprezentant', category: 'declaratii', required: true, order: 6 },
      { name: 'Dovada sediului', category: 'sediu', required: true, order: 7 },
    ],

    // ============================================================================
    // ÎNMATRICULĂRI - Operațiuni Prealabile
    // ============================================================================
    'verificare-rezervare-pj': [
      {
        name: 'Cerere verificare/rezervare denumire',
        category: 'formulare',
        required: true,
        order: 1,
      },
      { name: 'Dovada plății tarifului', category: 'taxe', required: true, order: 2 },
    ],
    'verificare-rezervare-pf': [
      {
        name: 'Cerere verificare/rezervare denumire PFA/II/IF',
        category: 'formulare',
        required: true,
        order: 1,
      },
      { name: 'Act de identitate solicitant', category: 'identitate', required: true, order: 2 },
      { name: 'Dovada plății tarifului', category: 'taxe', required: true, order: 3 },
    ],

    // ============================================================================
    // MENȚIUNI - Persoane Juridice
    // ============================================================================
    'cesiune-parti-sociale': [
      { name: 'Cerere de înregistrare mențiuni', category: 'formulare', required: true, order: 1 },
      {
        name: 'Contractul de cesiune',
        description: 'Contract autentificat notarial sau sub semnătură privată',
        category: 'contracte',
        required: true,
        order: 2,
      },
      {
        name: 'Hotărârea AGA',
        description: 'Hotărârea Adunării Generale a Asociaților',
        category: 'hotarari',
        required: true,
        order: 3,
      },
      {
        name: 'Actul constitutiv actualizat',
        description: 'Cu noua structură asociați',
        category: 'acte_constitutive',
        required: true,
        order: 4,
      },
      {
        name: 'Act identitate cesionar',
        description: 'Pentru noul asociat',
        category: 'identitate',
        required: true,
        order: 5,
      },
      { name: 'Declarație beneficiar real', category: 'declaratii', required: false, order: 6 },
    ],
    'schimbare-administrator': [
      { name: 'Cerere de înregistrare mențiuni', category: 'formulare', required: true, order: 1 },
      {
        name: 'Hotărârea AGA',
        description: 'Privind numirea/revocarea',
        category: 'hotarari',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv actualizat',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      {
        name: 'Act identitate noul administrator',
        category: 'identitate',
        required: true,
        order: 4,
      },
      {
        name: 'Specimen semnătură',
        description: 'Pentru noul administrator',
        category: 'declaratii',
        required: true,
        order: 5,
      },
      {
        name: 'Declarație pe propria răspundere',
        description: 'A noului administrator',
        category: 'declaratii',
        required: true,
        order: 6,
      },
    ],
    'majorare-capital': [
      { name: 'Cerere de înregistrare mențiuni', category: 'formulare', required: true, order: 1 },
      {
        name: 'Hotărârea AGA',
        description: 'Privind majorarea capitalului',
        category: 'hotarari',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv actualizat',
        description: 'Cu noul capital social',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      {
        name: 'Dovada aportului',
        description: 'Extras de cont sau evaluare aport în natură',
        category: 'financiar',
        required: true,
        order: 4,
      },
    ],
    'reducere-capital': [
      { name: 'Cerere de înregistrare mențiuni', category: 'formulare', required: true, order: 1 },
      {
        name: 'Hotărârea AGA',
        description: 'Privind reducerea capitalului',
        category: 'hotarari',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv actualizat',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      {
        name: 'Dovada publicării în Monitorul Oficial',
        category: 'diverse',
        required: true,
        order: 4,
      },
    ],
    'schimbare-sediu-acelasi-judet': [
      { name: 'Cerere de înregistrare mențiuni', category: 'formulare', required: true, order: 1 },
      {
        name: 'Hotărârea AGA',
        description: 'Privind schimbarea sediului',
        category: 'hotarari',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv actualizat',
        description: 'Cu noul sediu',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      {
        name: 'Dovada noului sediu',
        description: 'Contract închiriere/comodat sau act proprietate',
        category: 'sediu',
        required: true,
        order: 4,
      },
      {
        name: 'Acordul asociației de proprietari',
        description: 'Dacă sediul este în bloc',
        category: 'sediu',
        required: false,
        order: 5,
      },
    ],
    'schimbare-sediu-alt-judet': [
      { name: 'Cerere de înregistrare mențiuni', category: 'formulare', required: true, order: 1 },
      {
        name: 'Hotărârea AGA',
        description: 'Privind schimbarea sediului în alt județ',
        category: 'hotarari',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv actualizat',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      { name: 'Dovada noului sediu', category: 'sediu', required: true, order: 4 },
      {
        name: 'Certificat constatator de la ORC vechi',
        category: 'certificate',
        required: true,
        order: 5,
      },
    ],
    'modificare-denumire': [
      { name: 'Cerere de înregistrare mențiuni', category: 'formulare', required: true, order: 1 },
      { name: 'Dovada verificării noii denumiri', category: 'formulare', required: true, order: 2 },
      {
        name: 'Hotărârea AGA',
        description: 'Privind schimbarea denumirii',
        category: 'hotarari',
        required: true,
        order: 3,
      },
      {
        name: 'Actul constitutiv actualizat',
        category: 'acte_constitutive',
        required: true,
        order: 4,
      },
    ],
    'modificare-obiect-activitate': [
      { name: 'Cerere de înregistrare mențiuni', category: 'formulare', required: true, order: 1 },
      {
        name: 'Hotărârea AGA',
        description: 'Privind modificarea obiectului de activitate',
        category: 'hotarari',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv actualizat',
        description: 'Cu noile coduri CAEN',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
    ],
    'excludere-retragere-asociati': [
      { name: 'Cerere de înregistrare mențiuni', category: 'formulare', required: true, order: 1 },
      {
        name: 'Hotărârea AGA',
        description: 'Privind excluderea/retragerea',
        category: 'hotarari',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv actualizat',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      {
        name: 'Dovada restituirii părților sociale',
        category: 'financiar',
        required: false,
        order: 4,
      },
    ],

    // ============================================================================
    // MENȚIUNI - Persoane Fizice
    // ============================================================================
    'modificari-pfa-ii-if': [
      { name: 'Cerere de înregistrare mențiuni', category: 'formulare', required: true, order: 1 },
      { name: 'Act de identitate', category: 'identitate', required: true, order: 2 },
      {
        name: 'Documente justificative',
        description: 'În funcție de modificare',
        category: 'diverse',
        required: true,
        order: 3,
      },
    ],
    'suspendare-pfa-ii-if': [
      { name: 'Cerere de suspendare/reluare', category: 'formulare', required: true, order: 1 },
      { name: 'Act de identitate', category: 'identitate', required: true, order: 2 },
      {
        name: 'Declarație pe propria răspundere',
        category: 'declaratii',
        required: true,
        order: 3,
      },
    ],

    // ============================================================================
    // DIZOLVĂRI / LICHIDĂRI / RADIERI
    // ============================================================================
    'dizolvare-lichidare-simultana': [
      {
        name: 'Cerere de înregistrare',
        description: 'Pentru dizolvare și radiere',
        category: 'formulare',
        required: true,
        order: 1,
      },
      {
        name: 'Hotărârea AGA',
        description: 'De dizolvare și lichidare simultană',
        category: 'hotarari',
        required: true,
        order: 2,
      },
      {
        name: 'Certificat fiscal ANAF',
        description: 'Privind obligațiile fiscale',
        category: 'certificate',
        required: true,
        order: 3,
      },
      {
        name: 'Certificat fiscal local',
        description: 'De la primărie',
        category: 'certificate',
        required: true,
        order: 4,
      },
      {
        name: 'Situații financiare',
        description: 'Bilanț de lichidare',
        category: 'financiar',
        required: true,
        order: 5,
      },
      {
        name: 'Declarație pe propria răspundere',
        description: 'Privind achitarea datoriilor',
        category: 'declaratii',
        required: true,
        order: 6,
      },
    ],
    'dizolvare-voluntara-lichidator': [
      { name: 'Cerere de înregistrare dizolvare', category: 'formulare', required: true, order: 1 },
      {
        name: 'Hotărârea AGA',
        description: 'De dizolvare cu numire lichidator',
        category: 'hotarari',
        required: true,
        order: 2,
      },
      { name: 'Act identitate lichidator', category: 'identitate', required: true, order: 3 },
      { name: 'Declarație lichidator', category: 'declaratii', required: true, order: 4 },
      { name: 'Specimen semnătură lichidator', category: 'declaratii', required: true, order: 5 },
    ],
    'dizolvare-deces': [
      { name: 'Cerere de înregistrare', category: 'formulare', required: true, order: 1 },
      { name: 'Certificat de deces', category: 'identitate', required: true, order: 2 },
      {
        name: 'Hotărâre judecătorească',
        description: 'Sau certificat de moștenitor',
        category: 'hotarari',
        required: true,
        order: 3,
      },
      { name: 'Declarație moștenitori', category: 'declaratii', required: true, order: 4 },
    ],
    'desfiintare-pfa': [
      { name: 'Cerere de radiere PFA', category: 'formulare', required: true, order: 1 },
      { name: 'Act de identitate', category: 'identitate', required: true, order: 2 },
      {
        name: 'Declarație pe propria răspundere',
        description: 'Privind încetarea activității',
        category: 'declaratii',
        required: true,
        order: 3,
      },
      { name: 'Certificat fiscal ANAF', category: 'certificate', required: false, order: 4 },
    ],
    'desfiintare-ii': [
      { name: 'Cerere de radiere II', category: 'formulare', required: true, order: 1 },
      { name: 'Act de identitate titular', category: 'identitate', required: true, order: 2 },
      {
        name: 'Declarație pe propria răspundere',
        category: 'declaratii',
        required: true,
        order: 3,
      },
    ],
    'desfiintare-if': [
      { name: 'Cerere de radiere IF', category: 'formulare', required: true, order: 1 },
      { name: 'Acte de identitate membri', category: 'identitate', required: true, order: 2 },
      { name: 'Declarație reprezentant', category: 'declaratii', required: true, order: 3 },
    ],
  };

  return fallbacks[procedureId] || [];
}

// SyncOptions extends ScrapeOptions - additional sync-level options can be added here
export type SyncOptions = ScrapeOptions;

/**
 * Sync all ONRC templates
 * @param options - Optional configuration for AI enhancement
 */
export async function syncONRCTemplates(options: SyncOptions = {}): Promise<SyncResult> {
  const results: ScrapedTemplate[] = [];
  const errors: Array<{ procedureId: string; error: string }> = [];

  console.log(
    `[Sync] Starting ONRC sync (AI: ${options.useAI ? 'enabled' : 'disabled'}, Enrich: ${options.enrichWithAI ? 'enabled' : 'disabled'})`
  );

  for (const procedure of ONRC_PROCEDURES) {
    try {
      const template = await scrapeProcedure(procedure, options);
      results.push(template);

      if (template.error) {
        errors.push({ procedureId: procedure.id, error: template.error });
      }

      // Small delay between requests to be polite (longer if using AI)
      const delay = options.useAI || options.enrichWithAI ? 1000 : 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ procedureId: procedure.id, error: errorMessage });
    }
  }

  const aiEnhancedCount = results.filter((r) => r.aiEnhanced).length;
  const aiSuffix = aiEnhancedCount > 0 ? ` (${aiEnhancedCount} AI-enhanced)` : '';

  return {
    success: errors.length === 0 || results.length > 0,
    message:
      errors.length === 0
        ? `Successfully synced ${results.length} templates${aiSuffix}`
        : `Synced ${results.length} templates with ${errors.length} warnings${aiSuffix}`,
    templates: results,
    errors,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Sync a single ONRC template by ID
 * @param procedureId - The procedure ID to sync
 * @param options - Optional configuration for AI enhancement
 */
export async function syncSingleTemplate(
  procedureId: string,
  options: ScrapeOptions = {}
): Promise<ScrapedTemplate | null> {
  const procedure = ONRC_PROCEDURES.find(
    (p) => p.id === procedureId || `onrc-${p.id}` === procedureId
  );
  if (!procedure) return null;
  return scrapeProcedure(procedure, options);
}
