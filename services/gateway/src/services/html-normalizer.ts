/**
 * HTML Normalizer
 *
 * Sanitizes and normalizes AI-generated HTML before OOXML conversion.
 * Fixes common AI output issues without requiring prompt changes.
 */

import { JSDOM } from 'jsdom';
import { DocumentTemplate, NormalizerRules, DocumentStyleConfig } from './document-templates';

// ============================================================================
// Emoji Patterns
// ============================================================================

/**
 * Regex pattern to match emoji characters
 * Includes:
 * - Emoticons, dingbats, symbols
 * - Supplementary symbols (transport, maps, etc.)
 * - Pictographs, flags
 * - Variation selectors
 */
const EMOJI_PATTERN =
  /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{E0020}-\u{E007F}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu;

/**
 * Common emoji prefixes used in callout headers
 */
const CALLOUT_EMOJI_PREFIXES = [
  '📋',
  '📌',
  '💡',
  '⚠️',
  '⚖️',
  '✅',
  '❌',
  '📝',
  '🔍',
  '📊',
  '⭐',
  '🎯',
  '📎',
  '🔔',
  '💼',
  '📁',
  '🗂️',
  '📑',
  '🔖',
  '⏰',
  '🚨',
  '❗',
  '❓',
  '💬',
  '📢',
  '🔒',
  '🔓',
  '⚙️',
  '🛠️',
  '📞',
];

// ============================================================================
// Roman Numeral Conversion
// ============================================================================

const ROMAN_TO_ARABIC: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
  XIII: 13,
  XIV: 14,
  XV: 15,
  XVI: 16,
  XVII: 17,
  XVIII: 18,
  XIX: 19,
  XX: 20,
};

/**
 * Convert Roman numeral to Arabic
 */
function romanToArabic(roman: string): number | null {
  const upper = roman.toUpperCase();
  return ROMAN_TO_ARABIC[upper] ?? null;
}

// ============================================================================
// Normalizer Class
// ============================================================================

export class HtmlNormalizer {
  /**
   * Normalize HTML content according to template rules
   */
  normalize(html: string, template: DocumentTemplate): string {
    const rules = template.normalizer;

    // Parse HTML
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Apply normalizations in order
    if (rules.stripEmojis) {
      this.stripEmojis(document);
    }

    if (rules.normalizeCallouts) {
      this.normalizeCallouts(document);
    }

    if (rules.normalizeHeadingNumbers !== 'keep') {
      this.normalizeHeadingNumbers(document, rules.normalizeHeadingNumbers);
    }

    if (rules.restartListNumbering) {
      this.restartListNumbering(document);
    }

    // Return normalized HTML
    return document.body.innerHTML;
  }

  /**
   * Strip all emoji characters from text content
   * Preserves the surrounding text
   */
  private stripEmojis(document: Document): void {
    const walker = document.createTreeWalker(
      document.body,
      4, // NodeFilter.SHOW_TEXT
      null
    );

    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      textNodes.push(node);
    }

    for (const textNode of textNodes) {
      if (textNode.textContent) {
        // Remove emojis and clean up extra spaces
        const cleaned = textNode.textContent
          .replace(EMOJI_PATTERN, '')
          .replace(/^\s+/, ' ') // Normalize leading space (emoji often followed by space)
          .replace(/\s{2,}/g, ' '); // Collapse multiple spaces

        if (cleaned !== textNode.textContent) {
          textNode.textContent = cleaned;
        }
      }
    }
  }

  /**
   * Normalize callout boxes
   * - Remove emoji prefixes from headers
   * - Ensure consistent class names
   */
  private normalizeCallouts(document: Document): void {
    // Find divs that look like callouts (have background or border styling)
    const divs = document.querySelectorAll('div');

    for (const div of divs) {
      const style = div.getAttribute('style') || '';
      const className = div.getAttribute('class') || '';

      const isCallout =
        className.includes('callout') || style.includes('background') || style.includes('border');

      if (isCallout) {
        // Find and clean header elements (strong, b, or first text)
        const header = div.querySelector('strong, b, p:first-child strong, p:first-child b');
        if (header && header.textContent) {
          // Remove emoji prefix from header
          let text = header.textContent;
          for (const emoji of CALLOUT_EMOJI_PREFIXES) {
            if (text.startsWith(emoji)) {
              text = text.slice(emoji.length).trim();
              break;
            }
          }
          // Also apply general emoji stripping
          text = text.replace(EMOJI_PATTERN, '').trim();
          header.textContent = text;
        }

        // Ensure callout has a class for consistent styling
        if (!className.includes('callout')) {
          div.setAttribute('class', (className + ' callout').trim());
        }
      }
    }
  }

  /**
   * Normalize heading numbers to consistent format
   * "I. Title" → "1. Title" (when normalizing to Arabic)
   * "1. Title" → "I. Title" (when normalizing to Roman)
   */
  private normalizeHeadingNumbers(document: Document, targetFormat: 'arabic' | 'roman'): void {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

    // Track section counters for each level
    const counters = [0, 0, 0, 0, 0, 0];

    for (const heading of headings) {
      const level = parseInt(heading.tagName[1], 10) - 1; // 0-indexed
      const text = heading.textContent?.trim() || '';

      // Match patterns like "I.", "II.", "1.", "1.2.", etc.
      const romanMatch = text.match(/^([IVXLCDM]+)\.\s*(.*)$/i);
      const arabicMatch = text.match(/^([\d.]+)\.\s*(.*)$/);

      let number: string | null = null;
      let title: string | null = null;

      if (romanMatch) {
        const arabicNum = romanToArabic(romanMatch[1]);
        if (arabicNum !== null) {
          // Update counter for this level
          counters[level] = arabicNum;
          // Reset lower level counters
          for (let i = level + 1; i < 6; i++) counters[i] = 0;

          number = this.formatNumber(counters, level, targetFormat);
          title = romanMatch[2];
        }
      } else if (arabicMatch) {
        // Parse the number (could be "1" or "1.2" or "1.2.3")
        const parts = arabicMatch[1].split('.').filter(Boolean).map(Number);
        if (parts.length > 0 && parts.every((n) => !isNaN(n))) {
          // Update counters based on the number
          for (let i = 0; i < parts.length && i < 6; i++) {
            counters[i] = parts[i];
          }
          // Reset lower level counters
          for (let i = parts.length; i < 6; i++) counters[i] = 0;

          number = this.formatNumber(counters, level, targetFormat);
          title = arabicMatch[2];
        }
      }

      // Update heading text if we parsed a number
      if (number !== null && title !== null) {
        heading.textContent = `${number} ${title}`;
      }
    }
  }

  /**
   * Format section number in target format
   */
  private formatNumber(counters: number[], level: number, format: 'arabic' | 'roman'): string {
    if (format === 'roman' && level === 0) {
      // Only use Roman for top-level (H1)
      return this.toRoman(counters[0]) + '.';
    }

    // Build hierarchical number: "1.2.3."
    const parts: number[] = [];
    for (let i = 0; i <= level; i++) {
      if (counters[i] > 0) {
        parts.push(counters[i]);
      }
    }

    return parts.join('.') + '.';
  }

  /**
   * Convert number to Roman numeral
   */
  private toRoman(num: number): string {
    const romanNumerals: [number, string][] = [
      [10, 'X'],
      [9, 'IX'],
      [5, 'V'],
      [4, 'IV'],
      [1, 'I'],
    ];

    let result = '';
    let remaining = num;

    for (const [value, symbol] of romanNumerals) {
      while (remaining >= value) {
        result += symbol;
        remaining -= value;
      }
    }

    return result;
  }

  /**
   * Restart list numbering for each new ordered list
   * Ensures each <ol> starts at 1
   */
  private restartListNumbering(document: Document): void {
    const orderedLists = document.querySelectorAll('ol');

    for (const ol of orderedLists) {
      // Check if this is a nested list (parent is an <li>)
      const isNested = ol.parentElement?.tagName.toLowerCase() === 'li';

      if (!isNested) {
        // Top-level list: always start at 1
        ol.setAttribute('start', '1');
      }
      // Nested lists: keep their natural numbering (a, b, c or i, ii, iii)
    }
  }
}

// ============================================================================
// Semantic HTML Normalizer
// ============================================================================

/**
 * Source definition from semantic HTML <sources> block.
 */
export interface ParsedSource {
  id: string;
  type: 'legislation' | 'jurisprudence' | 'doctrine' | 'comparative' | 'other';
  citation: string;
  author?: string;
  url?: string;
}

/**
 * Resolved footnote with order of appearance.
 */
interface ResolvedFootnote {
  number: number;
  sourceId: string;
  citation: string;
  author?: string;
  url?: string;
}

/**
 * SemanticHtmlNormalizer
 *
 * Transforms semantic HTML (from single-writer AI) into styled HTML for OOXML conversion.
 *
 * Input: Semantic elements (<ref>, <sources>, <aside>)
 * Output: Styled HTML with resolved footnotes
 *
 * Transformations:
 * 1. Parse <sources> block → extract source definitions
 * 2. Resolve <ref id="srcN"/> → footnote numbers (order of appearance)
 * 3. Number headings → "1.", "1.1.", "1.2."
 * 4. Transform <aside class="note|important|definition"> → styled divs
 * 5. Style tables with caption and headers
 * 6. Apply typography (fonts, sizes, colors)
 * 7. Generate footnote footer
 */
export class SemanticHtmlNormalizer {
  private styleConfig: DocumentStyleConfig;

  constructor(styleConfig: DocumentStyleConfig) {
    this.styleConfig = styleConfig;
  }

  /**
   * Main normalization entry point.
   * Orchestrates all transformations on semantic HTML.
   */
  normalize(html: string): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // 1. Parse sources block (must be done first)
    const sources = this.parseSourcesBlock(document);
    console.log('[SemanticNormalizer] Sources found:', sources.size);

    // 2. Resolve references → footnote markers (order of appearance)
    const refs = document.querySelectorAll('ref');
    console.log('[SemanticNormalizer] Ref tags found:', refs.length);
    const footnotes = this.resolveReferences(document, sources);
    console.log('[SemanticNormalizer] Footnotes created:', footnotes.length);

    // 3. Remove duplicate consecutive headings (AI sometimes outputs both numbered and unnumbered)
    this.removeDuplicateHeadings(document);

    // 4. Number headings
    this.numberHeadings(document);

    // 5. Transform callouts (aside elements)
    this.transformCallouts(document);

    // 6. Style tables
    this.styleTables(document);

    // 7. Style blockquotes
    this.styleBlockquotes(document);

    // 8. Apply typography to body elements
    this.applyTypography(document);

    // 9. Generate footnote footer
    this.generateFootnoteFooter(document, footnotes);

    return document.body.innerHTML;
  }

  /**
   * Remove duplicate consecutive headings.
   * AI sometimes outputs both unnumbered and numbered versions:
   *   <h2>Cadrul legislativ</h2>
   *   <h2>1. Cadrul legislativ</h2>
   * This method removes the first (unnumbered) one.
   */
  private removeDuplicateHeadings(document: Document): void {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));

    for (let i = 0; i < headings.length - 1; i++) {
      const current = headings[i];
      const next = headings[i + 1];

      // Get text content, stripping any numbering prefix
      const currentText = (current.textContent || '').trim();
      const nextText = (next.textContent || '').trim();

      // Normalize: remove numbering prefix like "1.", "1.1.", "I.", etc.
      const normalize = (text: string) =>
        text
          .replace(/^[\d.IVXLCDM]+\.\s*/i, '')
          .toLowerCase()
          .trim();

      const currentNorm = normalize(currentText);
      const nextNorm = normalize(nextText);

      // If they're the same (ignoring numbering), remove the first one
      if (currentNorm && nextNorm && currentNorm === nextNorm) {
        // Keep the one with numbering (usually the second)
        const currentHasNumber = /^[\d.IVXLCDM]+\.\s*/i.test(currentText);
        const nextHasNumber = /^[\d.IVXLCDM]+\.\s*/i.test(nextText);

        if (!currentHasNumber && nextHasNumber) {
          // Remove the unnumbered one (current)
          current.remove();
        } else if (currentHasNumber && !nextHasNumber) {
          // Remove the unnumbered one (next)
          next.remove();
        } else {
          // Both same - remove the first one
          current.remove();
        }
      }
    }
  }

  /**
   * Parse the <sources> block and extract source definitions.
   * Removes the <sources> element from the document.
   */
  private parseSourcesBlock(document: Document): Map<string, ParsedSource> {
    const sources = new Map<string, ParsedSource>();

    const sourcesElement = document.querySelector('sources');
    if (!sourcesElement) {
      console.log('[SemanticNormalizer] No <sources> block found');
      return sources;
    }

    // Debug: log raw sources HTML
    console.log('[SemanticNormalizer] Raw sources block:', sourcesElement.innerHTML.slice(0, 500));

    const sourceElements = sourcesElement.querySelectorAll('source');
    for (const el of sourceElements) {
      const id = el.getAttribute('id');
      const type = (el.getAttribute('type') || 'other') as ParsedSource['type'];
      const author = el.getAttribute('author') || undefined;
      const url = el.getAttribute('url') || undefined;
      let citation = el.textContent?.trim() || '';

      // Fallback: construct citation from attributes if content is empty
      if (!citation) {
        const parts: string[] = [];
        if (author) parts.push(author);
        if (type === 'legislation') parts.push('[Legislație]');
        else if (type === 'jurisprudence') parts.push('[Jurisprudență]');
        else if (type === 'doctrine' && !author) parts.push('[Doctrină]');
        else if (type === 'comparative') parts.push('[Drept comparat]');
        if (url) parts.push(url);
        citation = parts.join(' - ') || `[Sursa ${id}]`;
        console.log(`[SemanticNormalizer] Source ${id} empty, constructed: "${citation}"`);
      }

      if (id) {
        sources.set(id, { id, type, citation, author, url });
      }
    }

    // Remove the sources block from DOM (it's been extracted)
    sourcesElement.remove();

    return sources;
  }

  /**
   * Resolve <ref id="srcN"/> elements to footnote numbers.
   * Footnotes are numbered in order of first appearance.
   */
  private resolveReferences(
    document: Document,
    sources: Map<string, ParsedSource>
  ): ResolvedFootnote[] {
    const footnotes: ResolvedFootnote[] = [];
    const sourceToFootnoteNum = new Map<string, number>();
    let nextFootnoteNum = 1;

    // Find all <ref> elements
    const refs = document.querySelectorAll('ref');

    for (const ref of refs) {
      const sourceId = ref.getAttribute('id');
      if (!sourceId) {
        ref.replaceWith(document.createTextNode(''));
        continue;
      }

      // Assign footnote number (first appearance wins)
      let footnoteNum: number;
      if (sourceToFootnoteNum.has(sourceId)) {
        footnoteNum = sourceToFootnoteNum.get(sourceId)!;
      } else {
        footnoteNum = nextFootnoteNum++;
        sourceToFootnoteNum.set(sourceId, footnoteNum);

        // Add to footnotes list
        const source = sources.get(sourceId);
        if (source) {
          footnotes.push({
            number: footnoteNum,
            sourceId,
            citation: source.citation,
            author: source.author,
            url: source.url,
          });
        } else {
          // Source not found - still create footnote with placeholder
          footnotes.push({
            number: footnoteNum,
            sourceId,
            citation: `[Sursa ${sourceId} nedefinită]`,
          });
        }
      }

      // Replace <ref> with styled superscript link
      const sup = document.createElement('sup');
      const link = document.createElement('a');
      link.setAttribute('href', `#fn${footnoteNum}`);
      link.setAttribute('id', `fnref${footnoteNum}`);
      link.setAttribute('style', 'color: #0066cc; text-decoration: none;');
      link.textContent = String(footnoteNum);
      sup.appendChild(link);

      ref.replaceWith(sup);
    }

    return footnotes;
  }

  /**
   * Add decimal numbering to headings.
   * h1 → "1.", "2."
   * h2 → "1.1.", "1.2.", "2.1."
   * h3 → "1.1.1.", "1.1.2."
   */
  private numberHeadings(document: Document): void {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const counters = [0, 0, 0, 0, 0, 0];
    const startLevel = this.styleConfig.numbering.startLevel;

    for (const heading of headings) {
      const level = parseInt(heading.tagName[1], 10);
      const levelIndex = level - 1;

      // Skip if below start level
      if (level < startLevel) continue;

      // Increment counter at this level
      counters[levelIndex]++;

      // Reset all lower level counters
      for (let i = levelIndex + 1; i < 6; i++) {
        counters[i] = 0;
      }

      // Build number string
      const numberParts: number[] = [];
      for (let i = startLevel - 1; i <= levelIndex; i++) {
        if (counters[i] > 0) {
          numberParts.push(counters[i]);
        }
      }

      // Skip if heading already has a number
      const currentText = heading.textContent?.trim() || '';
      if (/^[\d.]+\s/.test(currentText) || /^[IVXLCDM]+\.\s/i.test(currentText)) {
        continue;
      }

      // Prepend number to heading text
      const numberStr = numberParts.join('.') + '.';
      heading.textContent = `${numberStr} ${currentText}`;
    }
  }

  /**
   * Transform <aside> elements to styled callout divs.
   * Supports: note, important, definition
   * Filters out empty or trivial callouts.
   */
  private transformCallouts(document: Document): void {
    const asides = document.querySelectorAll('aside');

    for (const aside of asides) {
      // Get text content to check if callout has meaningful content
      const textContent = aside.textContent?.trim() || '';

      // Filter out empty or trivial callouts (just header labels with no real content)
      // Matches patterns like "Important:", "Notă:", "Concluzie jurisprudențială:", etc.
      const trivialPatterns =
        /^(important|notă|note|definiție|definition|atenție|warning|concluzie|observație|observatie|remarc[aă]|mențiune|mentiune|preliminar[aă]?|jurisprudențial[aă]?|metodologic[aă]?)[:\s]*$/i;

      // Also filter patterns like "Notă preliminară:" or "Concluzie jurisprudențială:"
      const compoundTrivialPattern =
        /^(notă|observație|concluzie|remarcă)\s+(preliminară|jurisprudențială|metodologică|importantă)?[:\s]*$/i;

      if (
        !textContent ||
        textContent.length < 15 ||
        trivialPatterns.test(textContent) ||
        compoundTrivialPattern.test(textContent)
      ) {
        // Remove empty/trivial callout entirely
        aside.remove();
        continue;
      }

      const className = aside.getAttribute('class') || 'note';
      const calloutType = className.includes('important')
        ? 'important'
        : className.includes('definition')
          ? 'definition'
          : 'note';

      const config = this.styleConfig.callouts[calloutType];

      // Create styled div replacement
      const div = document.createElement('div');
      div.setAttribute(
        'style',
        `background-color: ${config.bgColor}; ` +
          `border-left: 4px solid ${config.borderColor}; ` +
          `padding: 15px; ` +
          `margin: 15px 0; ` +
          `border-radius: 4px;`
      );
      div.setAttribute('class', `callout callout-${calloutType}`);

      // Move content
      while (aside.firstChild) {
        div.appendChild(aside.firstChild);
      }

      aside.replaceWith(div);
    }
  }

  /**
   * Style tables with caption and header formatting.
   */
  private styleTables(document: Document): void {
    const tables = document.querySelectorAll('table');

    for (const table of tables) {
      // Add basic table styling
      const existingStyle = table.getAttribute('style') || '';
      table.setAttribute(
        'style',
        `${existingStyle}; ` + `border-collapse: collapse; ` + `width: 100%; ` + `margin: 15px 0;`
      );

      // Style header cells
      const ths = table.querySelectorAll('th');
      for (const th of ths) {
        th.setAttribute(
          'style',
          `background-color: ${this.styleConfig.table.headerBgColor}; ` +
            `padding: 10px; ` +
            `border: 1px solid #ccc; ` +
            `text-align: left; ` +
            `font-weight: bold;`
        );
      }

      // Style regular cells
      const tds = table.querySelectorAll('td');
      for (const td of tds) {
        td.setAttribute('style', `padding: 10px; border: 1px solid #ccc;`);
      }

      // Style caption
      const caption = table.querySelector('caption');
      if (caption) {
        caption.setAttribute(
          'style',
          `caption-side: ${this.styleConfig.table.captionPosition}; ` +
            `text-align: left; ` +
            `font-style: italic; ` +
            `padding: 8px 0; ` +
            `color: #666;`
        );
      }
    }
  }

  /**
   * Style blockquote elements.
   * Uses indentation and font-variant for a cleaner academic look.
   */
  private styleBlockquotes(document: Document): void {
    const quotes = document.querySelectorAll('blockquote');
    const config = this.styleConfig.blockquote;

    for (const quote of quotes) {
      quote.setAttribute(
        'style',
        `margin-left: ${config.indent}in; ` +
          `margin-right: ${config.indent}in; ` +
          `padding: 10px 0; ` +
          `font-style: italic; ` +
          `font-size: 10.5pt; ` +
          `color: #444;`
      );
    }
  }

  /**
   * Apply typography styles to body elements.
   */
  private applyTypography(document: Document): void {
    const typography = this.styleConfig.typography;

    // Style article wrapper (or body if no article)
    const article = document.querySelector('article') || document.body;
    const existingStyle = article.getAttribute('style') || '';
    article.setAttribute(
      'style',
      `${existingStyle}; ` +
        `font-family: ${typography.bodyFont}, serif; ` +
        `font-size: ${typography.bodySize}pt; ` +
        `line-height: ${typography.lineHeight}; ` +
        `color: #333;`
    );

    // Style headings
    const headingLevels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
    for (const level of headingLevels) {
      const headings = document.querySelectorAll(level);
      const size = typography.headingSizes[level];
      const color = typography.headingColors[level];

      for (const heading of headings) {
        const existingHeadingStyle = heading.getAttribute('style') || '';
        heading.setAttribute(
          'style',
          `${existingHeadingStyle}; ` +
            `font-family: ${typography.headingFont}, sans-serif; ` +
            `font-size: ${size}pt; ` +
            `color: ${color}; ` +
            `margin-top: 1.5em; ` +
            `margin-bottom: 0.5em;`
        );
      }
    }

    // Style paragraphs with first-line indent
    const paragraphs = document.querySelectorAll('p');
    for (const p of paragraphs) {
      const existingPStyle = p.getAttribute('style') || '';
      // Only add indent if not already styled and not inside special containers
      const parent = p.parentElement;
      const isInCallout = parent?.classList?.contains('callout');
      const isInBlockquote = parent?.tagName?.toLowerCase() === 'blockquote';

      if (!isInCallout && !isInBlockquote && !existingPStyle.includes('text-indent')) {
        p.setAttribute(
          'style',
          `${existingPStyle}; ` +
            `text-indent: ${typography.firstLineIndent}px; ` +
            `margin-bottom: 1em;`
        );
      }
    }
  }

  /**
   * Generate the footnote footer section.
   * Styled for academic documents with hanging indent.
   */
  private generateFootnoteFooter(document: Document, footnotes: ResolvedFootnote[]): void {
    if (footnotes.length === 0) return;

    const footer = document.createElement('footer');
    footer.setAttribute(
      'style',
      `margin-top: 50px; ` +
        `padding-top: 25px; ` +
        `font-size: ${this.styleConfig.footnotes.size}pt; ` +
        `line-height: 1.4;`
    );

    // Section title
    const title = document.createElement('h2');
    title.setAttribute(
      'style',
      `font-size: 12pt; ` +
        `font-weight: bold; ` +
        `margin-bottom: 15px; ` +
        `color: #333; ` +
        `text-transform: uppercase; ` +
        `letter-spacing: 0.5px;`
    );
    title.textContent = 'Note';
    footer.appendChild(title);

    for (const fn of footnotes) {
      const p = document.createElement('p');
      p.setAttribute('id', `fn${fn.number}`);
      // Hanging indent style: first line normal, subsequent lines indented
      p.setAttribute('style', `margin: 8px 0; ` + `padding-left: 20px; ` + `text-indent: -20px;`);

      // Superscript number
      const sup = document.createElement('sup');
      sup.setAttribute('style', 'font-size: 8pt; margin-right: 4px;');
      sup.textContent = String(fn.number);
      p.appendChild(sup);

      // Build footnote content using DOM elements to properly render HTML
      if (fn.author) {
        p.appendChild(document.createTextNode(`${fn.author}, ${fn.citation}`));
      } else {
        p.appendChild(document.createTextNode(fn.citation));
      }

      // Add URL as a proper anchor element
      if (fn.url) {
        p.appendChild(document.createTextNode(' Disponibil la: '));
        const urlLink = document.createElement('a');
        urlLink.setAttribute('href', fn.url);
        urlLink.setAttribute('style', 'color: #0066cc; word-break: break-all;');
        urlLink.textContent = fn.url;
        p.appendChild(urlLink);
      }

      footer.appendChild(p);
    }

    // Append footer to article or body
    const article = document.querySelector('article');
    if (article) {
      article.appendChild(footer);
    } else {
      document.body.appendChild(footer);
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const htmlNormalizer = new HtmlNormalizer();

/**
 * Create a semantic normalizer with the given style config.
 */
export function createSemanticNormalizer(styleConfig: DocumentStyleConfig): SemanticHtmlNormalizer {
  return new SemanticHtmlNormalizer(styleConfig);
}
