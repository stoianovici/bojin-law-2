/**
 * Schema Normalizer
 *
 * Unified HTML normalization service driven by document schemas.
 * Consolidates functionality from:
 * - html-normalizer.ts (basic normalization)
 * - semantic-html-normalizer.ts (footnotes, callouts, styling)
 *
 * Normalization is applied based on schema configuration, ensuring
 * consistent formatting across all document types.
 */

import { JSDOM } from 'jsdom';
import type { DocumentSchema, FormattingConfig } from './document-schema.types';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed source from <sources> block.
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

// ============================================================================
// Constants
// ============================================================================

/**
 * Emoji pattern for stripping.
 */
const EMOJI_PATTERN =
  /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{E0020}-\u{E007F}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu;

/**
 * Roman numeral mapping.
 */
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

// ============================================================================
// Schema Normalizer Class
// ============================================================================

export class SchemaNormalizer {
  private schema: DocumentSchema;
  private formatting: FormattingConfig;

  constructor(schema: DocumentSchema) {
    this.schema = schema;
    this.formatting = schema.formatting;
  }

  /**
   * Normalize HTML content according to schema rules.
   *
   * @param html - Raw HTML from AI generation
   * @returns Normalized HTML ready for OOXML conversion
   */
  normalize(html: string): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const rules = this.schema.normalization.standardRules;

    // Track footnotes for generation
    let footnotes: ResolvedFootnote[] = [];

    // Parse sources block first (if citations are expected)
    let sources = new Map<string, ParsedSource>();
    if (
      this.schema.structure.citations.required ||
      this.schema.structure.citations.requireSourcesBlock
    ) {
      sources = this.parseSourcesBlock(document);
      footnotes = this.resolveReferences(document, sources);
    }

    // Apply normalization rules in order
    for (const rule of rules) {
      switch (rule) {
        case 'strip-emojis':
          this.stripEmojis(document);
          break;

        case 'normalize-callouts':
          this.normalizeCallouts(document);
          break;

        case 'normalize-heading-numbers':
          this.normalizeHeadingNumbers(document);
          break;

        case 'restart-list-numbering':
          this.restartListNumbering(document);
          break;

        case 'fix-quote-marks':
          this.fixQuoteMarks(document);
          break;

        case 'remove-empty-callouts':
          this.removeEmptyCallouts(document);
          break;

        case 'collapse-whitespace':
          this.collapseWhitespace(document);
          break;

        case 'remove-duplicate-headings':
          this.removeDuplicateHeadings(document);
          break;
      }
    }

    // Apply typography styling
    this.applyTypography(document);

    // Generate footnote footer if we have footnotes
    if (footnotes.length > 0) {
      this.generateFootnoteFooter(document, footnotes);
    }

    logger.debug('Schema normalization completed', {
      schemaId: this.schema.id,
      rulesApplied: rules,
      footnotesGenerated: footnotes.length,
    });

    return document.body.innerHTML;
  }

  // ==========================================================================
  // Sources and References
  // ==========================================================================

  /**
   * Parse <sources> block and extract source definitions.
   */
  private parseSourcesBlock(document: Document): Map<string, ParsedSource> {
    const sources = new Map<string, ParsedSource>();
    const sourcesElement = document.querySelector('sources');

    if (!sourcesElement) {
      return sources;
    }

    const sourceElements = sourcesElement.querySelectorAll('source');
    for (const el of sourceElements) {
      const id = el.getAttribute('id');
      const type = (el.getAttribute('type') || 'other') as ParsedSource['type'];
      const author = el.getAttribute('author') || undefined;
      const url = el.getAttribute('url') || undefined;
      let citation = el.textContent?.trim() || '';

      // Construct citation if empty
      if (!citation) {
        const parts: string[] = [];
        if (author) parts.push(author);
        if (type === 'legislation') parts.push('[Legislație]');
        else if (type === 'jurisprudence') parts.push('[Jurisprudență]');
        else if (type === 'doctrine' && !author) parts.push('[Doctrină]');
        else if (type === 'comparative') parts.push('[Drept comparat]');
        if (url) parts.push(url);
        citation = parts.join(' - ') || `[Sursa ${id}]`;
      }

      if (id) {
        sources.set(id, { id, type, citation, author, url });
      }
    }

    // Remove sources block from DOM
    sourcesElement.remove();

    return sources;
  }

  /**
   * Resolve <ref> elements to footnote markers.
   */
  private resolveReferences(
    document: Document,
    sources: Map<string, ParsedSource>
  ): ResolvedFootnote[] {
    const footnotes: ResolvedFootnote[] = [];
    const sourceToFootnoteNum = new Map<string, number>();
    let nextFootnoteNum = 1;

    const refs = document.querySelectorAll('ref');

    for (const ref of refs) {
      const sourceId = ref.getAttribute('id');
      if (!sourceId) {
        ref.replaceWith(document.createTextNode(''));
        continue;
      }

      let footnoteNum: number;
      if (sourceToFootnoteNum.has(sourceId)) {
        footnoteNum = sourceToFootnoteNum.get(sourceId)!;
      } else {
        footnoteNum = nextFootnoteNum++;
        sourceToFootnoteNum.set(sourceId, footnoteNum);

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
          footnotes.push({
            number: footnoteNum,
            sourceId,
            citation: `[Sursa ${sourceId} nedefinită]`,
          });
        }
      }

      // Replace <ref> with styled superscript
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

  // ==========================================================================
  // Standard Normalization Rules
  // ==========================================================================

  /**
   * Strip all emoji characters.
   */
  private stripEmojis(document: Document): void {
    const walker = document.createTreeWalker(document.body, 4 /* NodeFilter.SHOW_TEXT */, null);

    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      textNodes.push(node);
    }

    for (const textNode of textNodes) {
      if (textNode.textContent) {
        const cleaned = textNode.textContent
          .replace(EMOJI_PATTERN, '')
          .replace(/^\s+/, ' ')
          .replace(/\s{2,}/g, ' ');

        if (cleaned !== textNode.textContent) {
          textNode.textContent = cleaned;
        }
      }
    }
  }

  /**
   * Normalize callout boxes (transform <aside> to styled divs).
   */
  private normalizeCallouts(document: Document): void {
    const asides = document.querySelectorAll('aside');
    const calloutConfig = this.formatting.callouts;

    for (const aside of asides) {
      const className = aside.getAttribute('class') || 'note';
      const calloutType = className.includes('important')
        ? 'important'
        : className.includes('definition')
          ? 'definition'
          : 'note';

      const config = calloutConfig[calloutType];

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

      while (aside.firstChild) {
        div.appendChild(aside.firstChild);
      }

      aside.replaceWith(div);
    }

    // Also handle existing divs that look like callouts
    const divs = document.querySelectorAll('div');
    for (const div of divs) {
      const style = div.getAttribute('style') || '';
      const className = div.getAttribute('class') || '';

      const isCallout =
        className.includes('callout') || style.includes('background') || style.includes('border');

      if (isCallout && !className.includes('callout')) {
        div.setAttribute('class', (className + ' callout').trim());
      }
    }
  }

  /**
   * Normalize heading numbers to consistent format.
   */
  private normalizeHeadingNumbers(document: Document): void {
    const targetFormat = this.schema.normalization.headingNumberFormat;
    if (!targetFormat || targetFormat === 'keep') return;

    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const counters = [0, 0, 0, 0, 0, 0];
    const startLevel = this.schema.structure.headingHierarchy.numberingStartLevel || 1;

    for (const heading of headings) {
      const level = parseInt(heading.tagName[1], 10);
      const levelIndex = level - 1;
      const text = heading.textContent?.trim() || '';

      // Skip if below start level
      if (level < startLevel) continue;

      // Check if heading already has a number
      const romanMatch = text.match(/^([IVXLCDM]+)\.\s*(.*)$/i);
      const arabicMatch = text.match(/^([\d.]+)\.\s*(.*)$/);

      let title = text;

      if (romanMatch) {
        const arabicNum = ROMAN_TO_ARABIC[romanMatch[1].toUpperCase()];
        if (arabicNum !== null) {
          counters[levelIndex] = arabicNum;
          for (let i = levelIndex + 1; i < 6; i++) counters[i] = 0;
          title = romanMatch[2];
        }
      } else if (arabicMatch) {
        const parts = arabicMatch[1].split('.').filter(Boolean).map(Number);
        if (parts.length > 0 && parts.every((n) => !isNaN(n))) {
          for (let i = 0; i < parts.length && i < 6; i++) {
            counters[i] = parts[i];
          }
          for (let i = parts.length; i < 6; i++) counters[i] = 0;
          title = arabicMatch[2];
        }
      } else {
        // No existing number - add one
        counters[levelIndex]++;
        for (let i = levelIndex + 1; i < 6; i++) counters[i] = 0;
      }

      // Format the number
      const number = this.formatHeadingNumber(counters, levelIndex, startLevel, targetFormat);

      if (number && title) {
        heading.textContent = `${number} ${title}`;
      }
    }
  }

  /**
   * Format a heading number.
   */
  private formatHeadingNumber(
    counters: number[],
    levelIndex: number,
    startLevel: number,
    format: 'arabic' | 'roman'
  ): string {
    if (format === 'roman' && levelIndex === startLevel - 1) {
      return this.toRoman(counters[levelIndex]) + '.';
    }

    const parts: number[] = [];
    for (let i = startLevel - 1; i <= levelIndex; i++) {
      if (counters[i] > 0) {
        parts.push(counters[i]);
      }
    }

    return parts.join('.') + '.';
  }

  /**
   * Convert number to Roman numeral.
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
   * Restart list numbering for each new list.
   */
  private restartListNumbering(document: Document): void {
    const orderedLists = document.querySelectorAll('ol');

    for (const ol of orderedLists) {
      const isNested = ol.parentElement?.tagName.toLowerCase() === 'li';
      if (!isNested) {
        ol.setAttribute('start', '1');
      }
    }
  }

  /**
   * Fix quote marks (straight to Romanian curly).
   */
  private fixQuoteMarks(document: Document): void {
    const walker = document.createTreeWalker(document.body, 4 /* NodeFilter.SHOW_TEXT */, null);

    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      textNodes.push(node);
    }

    for (const textNode of textNodes) {
      if (textNode.textContent) {
        // Romanian uses „ for opening and " for closing
        // Simple heuristic: " after space or start = opening, " before space or end = closing
        const text = textNode.textContent;
        let result = '';
        let inQuote = false;

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (char === '"') {
            if (!inQuote) {
              result += '„';
              inQuote = true;
            } else {
              result += '"';
              inQuote = false;
            }
          } else {
            result += char;
          }
        }

        if (result !== text) {
          textNode.textContent = result;
        }
      }
    }
  }

  /**
   * Remove empty or trivial callouts.
   */
  private removeEmptyCallouts(document: Document): void {
    const callouts = document.querySelectorAll('.callout, aside');

    for (const callout of callouts) {
      const text = callout.textContent?.trim() || '';

      // Trivial patterns (just headers with no content)
      const trivialPatterns =
        /^(important|notă|note|definiție|definition|atenție|warning|concluzie|observație)[:\s]*$/i;

      if (!text || text.length < 15 || trivialPatterns.test(text)) {
        callout.remove();
      }
    }
  }

  /**
   * Collapse excessive whitespace.
   */
  private collapseWhitespace(document: Document): void {
    const walker = document.createTreeWalker(document.body, 4 /* NodeFilter.SHOW_TEXT */, null);

    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      textNodes.push(node);
    }

    for (const textNode of textNodes) {
      if (textNode.textContent) {
        const cleaned = textNode.textContent
          .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
          .replace(/[ \t]+/g, ' '); // Collapse spaces

        if (cleaned !== textNode.textContent) {
          textNode.textContent = cleaned;
        }
      }
    }
  }

  /**
   * Remove duplicate consecutive headings.
   */
  private removeDuplicateHeadings(document: Document): void {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));

    for (let i = 0; i < headings.length - 1; i++) {
      const current = headings[i];
      const next = headings[i + 1];

      const currentText = (current.textContent || '').trim();
      const nextText = (next.textContent || '').trim();

      // Normalize: remove numbering prefix
      const normalize = (text: string) =>
        text
          .replace(/^[\d.IVXLCDM]+\.\s*/i, '')
          .toLowerCase()
          .trim();

      const currentNorm = normalize(currentText);
      const nextNorm = normalize(nextText);

      if (currentNorm && nextNorm && currentNorm === nextNorm) {
        const currentHasNumber = /^[\d.IVXLCDM]+\.\s*/i.test(currentText);
        const nextHasNumber = /^[\d.IVXLCDM]+\.\s*/i.test(nextText);

        if (!currentHasNumber && nextHasNumber) {
          current.remove();
        } else if (currentHasNumber && !nextHasNumber) {
          next.remove();
        } else {
          current.remove();
        }
      }
    }
  }

  // ==========================================================================
  // Typography and Styling
  // ==========================================================================

  /**
   * Apply typography styles to elements.
   */
  private applyTypography(document: Document): void {
    const typography = this.formatting.typography;

    // Style article wrapper
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

    // Style paragraphs
    const paragraphs = document.querySelectorAll('p');
    for (const p of paragraphs) {
      const existingPStyle = p.getAttribute('style') || '';
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

    // Style blockquotes
    const quotes = document.querySelectorAll('blockquote');
    const bqConfig = this.formatting.blockquote;

    for (const quote of quotes) {
      quote.setAttribute(
        'style',
        `margin-left: ${bqConfig.indent}in; ` +
          `margin-right: ${bqConfig.indent}in; ` +
          `padding: 10px 0; ` +
          `font-style: italic; ` +
          `font-size: 10.5pt; ` +
          `color: #444;`
      );
    }

    // Style tables
    const tables = document.querySelectorAll('table');
    const tableConfig = this.formatting.table;

    for (const table of tables) {
      const existingTableStyle = table.getAttribute('style') || '';
      table.setAttribute(
        'style',
        `${existingTableStyle}; ` +
          `border-collapse: collapse; ` +
          `width: 100%; ` +
          `margin: 15px 0;`
      );

      const ths = table.querySelectorAll('th');
      for (const th of ths) {
        th.setAttribute(
          'style',
          `background-color: ${tableConfig.headerBgColor}; ` +
            `padding: 10px; ` +
            `border: 1px solid #ccc; ` +
            `text-align: left; ` +
            `font-weight: bold;`
        );
      }

      const tds = table.querySelectorAll('td');
      for (const td of tds) {
        td.setAttribute('style', `padding: 10px; border: 1px solid #ccc;`);
      }
    }
  }

  /**
   * Generate footnote footer section.
   */
  private generateFootnoteFooter(document: Document, footnotes: ResolvedFootnote[]): void {
    if (footnotes.length === 0) return;

    const footer = document.createElement('footer');
    footer.setAttribute(
      'style',
      `margin-top: 50px; ` +
        `padding-top: 25px; ` +
        `font-size: ${this.formatting.footnotes.size}pt; ` +
        `line-height: 1.4;`
    );

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
      p.setAttribute('style', `margin: 8px 0; padding-left: 20px; text-indent: -20px;`);

      const sup = document.createElement('sup');
      sup.setAttribute('style', 'font-size: 8pt; margin-right: 4px;');
      sup.textContent = String(fn.number);
      p.appendChild(sup);

      if (fn.author) {
        p.appendChild(document.createTextNode(`${fn.author}, ${fn.citation}`));
      } else {
        p.appendChild(document.createTextNode(fn.citation));
      }

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

    const article = document.querySelector('article');
    if (article) {
      article.appendChild(footer);
    } else {
      document.body.appendChild(footer);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a normalizer for a specific schema.
 *
 * @param schema - The document schema to use
 * @returns Configured normalizer instance
 */
export function createSchemaNormalizer(schema: DocumentSchema): SchemaNormalizer {
  return new SchemaNormalizer(schema);
}
