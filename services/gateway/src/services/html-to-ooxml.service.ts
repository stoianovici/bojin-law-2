/**
 * HTML to OOXML Converter Service
 * Converts styled HTML from AI output to OOXML fragments for Word insertion.
 *
 * This service replaces the markdown-based pipeline with a more expressive
 * HTML-based approach that better preserves visual formatting.
 *
 * Supported HTML elements:
 * - Headings (h1-h6) with inline style extraction
 * - Paragraphs with text-indent, line-height, color
 * - Inline formatting: strong/b, em/i, u, sup, sub, s/del
 * - Lists (ul, ol) with nested levels
 * - Tables with headers and styling
 * - Divs with background/border (callout boxes)
 * - Footnotes (sup > a[href="#fn..."]) with footer definitions
 * - Block quotes
 */

import { JSDOM, DOMWindow } from 'jsdom';

// Helper interface for DOM element access
// jsdom provides DOM types at runtime but TS doesn't know about them
interface DOMElement {
  tagName: string;
  textContent: string | null;
  children: ArrayLike<DOMElement>;
  childNodes: ArrayLike<DOMNode>;
  getAttribute(name: string): string | null;
  querySelector(selector: string): DOMElement | null;
  querySelectorAll(selector: string): ArrayLike<DOMElement>;
}

interface DOMNode {
  nodeType: number;
  textContent: string | null;
}

import { BOJIN_HEADER_PNG_BASE64, BOJIN_FOOTER_PNG_BASE64 } from '../assets/bojin-images';

// ============================================================================
// Types
// ============================================================================

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  fontSize?: number; // in half-points
  color?: string; // hex without #
  fontFamily?: string;
  footnoteId?: number;
  crossRefBookmark?: string; // Internal hyperlink to this bookmark name
}

interface Paragraph {
  runs: TextRun[];
  style?: string;
  alignment?: 'left' | 'center' | 'right' | 'both';
  indent?: number; // in twips
  firstLineIndent?: number; // in twips
  spacing?: { before?: number; after?: number; line?: number };
  shading?: string; // background color hex without #
  borderLeft?: { size: number; color: string };
  borderBox?: { size: number; color: string };
  keepNext?: boolean;
  keepLines?: boolean;
  numbering?: { id: number; level: number };
  outlineLevel?: number; // 0-8 for TOC inclusion (0 = Heading1, 1 = Heading2, etc.)
  headingStyle?: string; // Word built-in style name (Heading1, Heading2, etc.)
  pageBreakBefore?: boolean; // Insert page break before this paragraph
  bookmarkId?: string; // Bookmark name for cross-references (e.g., "section_1_2")
}

interface TableCell {
  paragraphs: Paragraph[];
  shading?: string;
  borderBottom?: { size: number; color: string };
}

interface TableRow {
  cells: TableCell[];
  isHeader?: boolean;
}

interface Table {
  rows: TableRow[];
}

interface FootnoteDefinition {
  id: number;
  content: string;
}

interface ParsedDocument {
  paragraphs: Paragraph[];
  tables: Array<{ index: number; table: Table }>;
  footnotes: FootnoteDefinition[];
  hasHeadings: boolean; // True if document has h1-h6 elements (for TOC)
  bookmarks: Map<string, string>; // bookmarkId -> heading text (for cross-ref resolution)
  headingNumbers: Map<string, string>; // bookmarkId -> "1.2.3" style number
  orderedListCount: number; // Count of top-level ordered lists (for unique numIds)
}

interface PaginationOptions {
  /** Add page breaks before h1 headings (except the first one after cover) */
  pageBreaksBeforeH1?: boolean;

  /** Minimum paragraphs to keep with heading (prevents orphaned headings) */
  minParagraphsAfterHeading?: number;

  /** Custom heading spacing (in twips: 20 twips = 1pt) */
  headingSpacing?: {
    h1?: { before: number; after: number };
    h2?: { before: number; after: number };
    h3?: { before: number; after: number };
    h4?: { before: number; after: number };
  };
}

interface ConvertOptions {
  /** Include a Table of Contents at the beginning of the document */
  includeTableOfContents?: boolean;

  /** Include a cover page at the beginning */
  coverPage?: {
    title: string;
    subtitle?: string;
    author?: string;
    client?: string;
    date?: string; // If not provided, uses current date
    documentType?: string; // e.g., "Notă de cercetare", "Memoriu juridic"
  };

  /** Add page breaks before h1 headings (except the first one) */
  pageBreaksBeforeH1?: boolean;

  /** Generate bookmarks for headings (enables cross-references) */
  generateBookmarks?: boolean;

  /** Include bibliography section at the end */
  bibliography?: BibliographyEntry[];

  /** Pagination rules for preventing orphaned headings */
  pagination?: PaginationOptions;
}

interface BibliographyEntry {
  id: string; // Reference ID used in text (e.g., "stoica2020")
  type: 'legislation' | 'jurisprudence' | 'doctrine' | 'other';
  citation: string; // Full formatted citation
  url?: string;
}

// ============================================================================
// Style Configuration (Bojin Brand)
// ============================================================================

const FONT_BODY = 'Source Serif Pro';
const FONT_BODY_FALLBACK = 'Georgia';
const FONT_HEADING = 'Inter';
const FONT_HEADING_FALLBACK = 'Arial';

// Default styles for elements when inline styles are missing
const DEFAULT_STYLES = {
  h1: { fontSize: 48, color: '333333', fontFamily: FONT_HEADING }, // 24pt
  h2: { fontSize: 36, color: '9B2335', fontFamily: FONT_HEADING }, // 18pt (Bojin red)
  h3: { fontSize: 28, color: '333333', fontFamily: FONT_HEADING }, // 14pt
  h4: { fontSize: 24, color: '666666', fontFamily: FONT_HEADING }, // 12pt
  h5: { fontSize: 22, color: '666666', fontFamily: FONT_HEADING }, // 11pt
  h6: { fontSize: 20, color: '666666', fontFamily: FONT_HEADING }, // 10pt
  p: { fontSize: 24, color: '333333', fontFamily: FONT_BODY }, // 12pt
  li: { fontSize: 24, color: '333333', fontFamily: FONT_BODY }, // 12pt
  blockquote: { fontSize: 24, color: '4A4A4A', fontFamily: FONT_BODY },
  footnote: { fontSize: 20, color: '666666', fontFamily: FONT_BODY }, // 10pt
};

// ============================================================================
// OOXML Templates
// ============================================================================

const ABSTRACT_NUMBERING_XML = `<w:abstractNum w:abstractNumId="1">
<w:multiLevelType w:val="hybridMultilevel"/>
<w:lvl w:ilvl="0">
<w:start w:val="1"/>
<w:numFmt w:val="bullet"/>
<w:lvlText w:val="&#x2022;"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:hint="default"/></w:rPr>
</w:lvl>
<w:lvl w:ilvl="1">
<w:start w:val="1"/>
<w:numFmt w:val="bullet"/>
<w:lvlText w:val="&#x25CB;"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:hint="default"/></w:rPr>
</w:lvl>
<w:lvl w:ilvl="2">
<w:start w:val="1"/>
<w:numFmt w:val="bullet"/>
<w:lvlText w:val="&#x25AA;"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="2160" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:hint="default"/></w:rPr>
</w:lvl>
</w:abstractNum>
<w:abstractNum w:abstractNumId="2">
<w:multiLevelType w:val="hybridMultilevel"/>
<w:lvl w:ilvl="0">
<w:start w:val="1"/>
<w:numFmt w:val="decimal"/>
<w:lvlText w:val="%1."/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
</w:lvl>
<w:lvl w:ilvl="1">
<w:start w:val="1"/>
<w:numFmt w:val="lowerLetter"/>
<w:lvlText w:val="%2)"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr>
</w:lvl>
<w:lvl w:ilvl="2">
<w:start w:val="1"/>
<w:numFmt w:val="lowerRoman"/>
<w:lvlText w:val="%3."/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="2160" w:hanging="360"/></w:pPr>
</w:lvl>
</w:abstractNum>`;

// Document relationships - only includes parts that work with insertOoxml()
// Note: Headers/footers/images are NOT supported by Word's insertOoxml API
const DOCUMENT_RELS_XML = `<pkg:part pkg:name="/word/_rels/document.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
<pkg:xmlData>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
</pkg:xmlData>
</pkg:part>`;

// ============================================================================
// Service
// ============================================================================

export class HtmlToOoxmlService {
  /**
   * Convert HTML content to OOXML fragment for Word's insertOoxml()
   * @param html - The HTML content to convert
   * @param options - Optional conversion settings
   */
  convert(html: string, options: ConvertOptions = {}): string {
    const parsed = this.parseHtml(html, options);
    return this.buildOoxmlPackage(parsed, options);
  }

  /**
   * Convert HTML and return result with metadata
   * Useful for detecting if content was actually HTML or markdown
   */
  convertWithMetadata(
    html: string,
    options: ConvertOptions = {}
  ): { ooxml: string; paragraphCount: number; hasContent: boolean; hasHeadings: boolean } {
    const parsed = this.parseHtml(html, options);

    // Process cross-references if bookmarks are generated
    if (options.generateBookmarks && parsed.headingNumbers.size > 0) {
      this.processCrossReferences(parsed);
    }

    return {
      ooxml: this.buildOoxmlPackage(parsed, options),
      paragraphCount: parsed.paragraphs.length,
      hasContent: parsed.paragraphs.length > 0 || parsed.tables.length > 0,
      hasHeadings: parsed.hasHeadings,
    };
  }

  /**
   * Parse HTML into structured document representation
   */
  private parseHtml(html: string, options: ConvertOptions = {}): ParsedDocument {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract body content (strip wrapper elements)
    const body = document.body as unknown as DOMElement;
    const articleEl = body.querySelector('article');
    const article = (articleEl || body) as DOMElement;

    const paragraphs: Paragraph[] = [];
    const tables: Array<{ index: number; table: Table }> = [];
    const footnotes: FootnoteDefinition[] = [];
    const bookmarks = new Map<string, string>();
    const headingNumbers = new Map<string, string>();
    let hasHeadings = false;

    // Track footnote references for later extraction
    const footnoteRefs: Set<number> = new Set();

    // Track heading counters for numbering (h1, h2, h3, h4, h5, h6)
    const headingCounters = [0, 0, 0, 0, 0, 0];
    let isFirstH1 = true;

    // Track ordered list counter for unique numIds (starts at 3, since 1=ul, 2=base ol definition)
    const listCounter = { orderedListCount: 0 };

    // Process each child element
    for (const child of Array.from(article.children)) {
      const element = child as DOMElement;
      const tagName = element.tagName.toLowerCase();

      switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6': {
          hasHeadings = true;
          const level = parseInt(tagName[1], 10);

          // Update heading counters
          headingCounters[level - 1]++;
          // Reset lower level counters
          for (let i = level; i < 6; i++) {
            headingCounters[i] = 0;
          }

          // Generate heading number (e.g., "1.2.3")
          const headingNumber = headingCounters.slice(0, level).join('.');

          // Generate bookmark ID from heading text
          const headingText = element.textContent?.trim() || '';
          const bookmarkId = options.generateBookmarks
            ? this.generateBookmarkId(headingText, headingNumber)
            : undefined;

          // Parse heading with context
          const para = this.parseHeading(element, footnoteRefs);

          // Add page break before h1 (except first one after cover/TOC)
          if (level === 1 && options.pageBreaksBeforeH1 && !isFirstH1) {
            para.pageBreakBefore = true;
          }
          if (level === 1) {
            isFirstH1 = false;
          }

          // Add bookmark
          if (bookmarkId) {
            para.bookmarkId = bookmarkId;
            bookmarks.set(bookmarkId, headingText);
            headingNumbers.set(bookmarkId, headingNumber);
          }

          paragraphs.push(para);
          break;
        }

        case 'p':
          paragraphs.push(this.parseParagraph(element, footnoteRefs));
          break;

        case 'div':
          paragraphs.push(...this.parseDiv(element, footnoteRefs));
          break;

        case 'section':
        case 'header':
        case 'main':
        case 'aside':
        case 'nav': {
          // Check if this is a footnotes section (by heading text)
          const sectionHeading = element.querySelector('h1, h2, h3, h4, h5, h6');
          const headingTextLower = sectionHeading?.textContent?.toLowerCase() || '';
          const isFootnoteSection =
            headingTextLower.includes('note') ||
            headingTextLower.includes('subsol') ||
            headingTextLower.includes('referinț') ||
            headingTextLower.includes('footnote') ||
            headingTextLower.includes('bibliografie');

          if (isFootnoteSection) {
            // Extract footnotes from this section
            footnotes.push(...this.extractFootnotesFromSection(element));
          } else {
            // Recursively process container elements
            this.processContainerElement(
              element,
              paragraphs,
              tables,
              footnotes,
              footnoteRefs,
              listCounter
            );
          }
          break;
        }

        case 'ul':
        case 'ol':
          paragraphs.push(
            ...this.parseList(element, tagName === 'ol', 0, footnoteRefs, listCounter)
          );
          break;

        case 'table':
          tables.push({ index: paragraphs.length, table: this.parseTable(element) });
          break;

        case 'blockquote':
          paragraphs.push(...this.parseBlockquote(element, footnoteRefs));
          break;

        case 'hr':
          paragraphs.push(this.parseHorizontalRule(element));
          break;

        case 'footer':
          // Extract footnote definitions from footer
          footnotes.push(...this.parseFooter(element));
          break;

        default:
          // Treat unknown elements as paragraphs
          if (element.textContent?.trim()) {
            paragraphs.push(this.parseParagraph(element, footnoteRefs));
          }
      }
    }

    return {
      paragraphs,
      tables,
      footnotes,
      hasHeadings,
      bookmarks,
      headingNumbers,
      orderedListCount: listCounter.orderedListCount,
    };
  }

  /**
   * Generate a bookmark ID from heading text and number
   * Creates a sanitized, unique identifier for cross-references
   */
  private generateBookmarkId(text: string, number: string): string {
    // Sanitize text: remove diacritics, lowercase, replace spaces with underscores
    const sanitized = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
      .replace(/^_+|_+$/g, '') // Trim underscores
      .substring(0, 30); // Limit length

    return `_Ref_${number.replace(/\./g, '_')}_${sanitized}`;
  }

  /**
   * Recursively process container elements (section, header, main, aside, nav)
   * These elements don't have their own formatting, they just group content
   */
  private processContainerElement(
    element: DOMElement,
    paragraphs: Paragraph[],
    tables: Array<{ index: number; table: Table }>,
    footnotes: FootnoteDefinition[],
    footnoteRefs: Set<number>,
    listCounter: { orderedListCount: number }
  ): void {
    for (const child of Array.from(element.children)) {
      const childElement = child as DOMElement;
      const tagName = childElement.tagName.toLowerCase();

      switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          paragraphs.push(this.parseHeading(childElement, footnoteRefs));
          break;

        case 'p':
          paragraphs.push(this.parseParagraph(childElement, footnoteRefs));
          break;

        case 'div':
          paragraphs.push(...this.parseDiv(childElement, footnoteRefs));
          break;

        case 'section':
        case 'header':
        case 'main':
        case 'aside':
        case 'nav':
          // Recursively process nested container elements
          this.processContainerElement(
            childElement,
            paragraphs,
            tables,
            footnotes,
            footnoteRefs,
            listCounter
          );
          break;

        case 'ul':
        case 'ol':
          paragraphs.push(
            ...this.parseList(childElement, tagName === 'ol', 0, footnoteRefs, listCounter)
          );
          break;

        case 'table':
          tables.push({ index: paragraphs.length, table: this.parseTable(childElement) });
          break;

        case 'blockquote':
          paragraphs.push(...this.parseBlockquote(childElement, footnoteRefs));
          break;

        case 'hr':
          paragraphs.push(this.parseHorizontalRule(childElement));
          break;

        case 'footer':
          // Extract footnote definitions from footer
          footnotes.push(...this.parseFooter(childElement));
          break;

        default:
          // Treat unknown elements as paragraphs
          if (childElement.textContent?.trim()) {
            paragraphs.push(this.parseParagraph(childElement, footnoteRefs));
          }
      }
    }
  }

  /**
   * Parse heading element (h1-h6)
   * Trusts Claude's inline styles, uses defaults only as fallback
   */
  private parseHeading(element: DOMElement, footnoteRefs: Set<number>): Paragraph {
    const level = parseInt(element.tagName[1], 10);
    const style = this.parseInlineStyle(element);
    const defaultStyle =
      DEFAULT_STYLES[`h${level}` as keyof typeof DEFAULT_STYLES] || DEFAULT_STYLES.h1;

    // Extract element-level styles from Claude's CSS to pass down to text runs
    const initialStyles: Partial<TextRun> = {
      bold: true, // Headings are bold by default
    };

    // Trust Claude's styles - parse them from the element
    if (style.fontSize) {
      initialStyles.fontSize = this.parseFontSize(style.fontSize);
    }
    if (style.color) {
      initialStyles.color = this.parseColor(style.color);
    }
    if (style.fontFamily) {
      initialStyles.fontFamily = this.parseFontFamily(style.fontFamily);
    }
    if (style.fontWeight === 'normal' || style.fontWeight === '400') {
      initialStyles.bold = false; // Allow Claude to override bold
    }

    // Parse runs with Claude's styles as initial inherited styles
    const runs = this.parseInlineContent(element, footnoteRefs, false, initialStyles);

    // Apply defaults only as final fallback (when Claude didn't specify)
    for (const run of runs) {
      if (!run.fontSize) run.fontSize = defaultStyle.fontSize;
      if (!run.color) run.color = defaultStyle.color;
      if (!run.fontFamily) run.fontFamily = defaultStyle.fontFamily;
    }

    // Parse spacing from Claude's margin/padding styles
    const spacingBefore =
      this.parseSpacingValue(style.marginTop) ?? (level === 1 ? 480 : level === 2 ? 360 : 240);
    const spacingAfter =
      this.parseSpacingValue(style.marginBottom) ?? (level === 1 ? 240 : level === 2 ? 180 : 120);
    const lineHeight = this.parseLineHeight(style.lineHeight) ?? 240;

    return {
      runs,
      alignment: this.getAlignment(style),
      spacing: {
        before: spacingBefore,
        after: spacingAfter,
        line: lineHeight,
      },
      keepNext: true,
      // For Table of Contents support
      outlineLevel: level - 1, // h1 = level 0, h2 = level 1, etc.
      headingStyle: `Heading${level}`, // Word's built-in style name
    };
  }

  /**
   * Parse paragraph element
   * Trusts Claude's inline styles, uses defaults only as fallback
   */
  private parseParagraph(element: DOMElement, footnoteRefs: Set<number>): Paragraph {
    const style = this.parseInlineStyle(element);

    // Extract element-level styles from Claude's CSS to pass down to text runs
    const initialStyles: Partial<TextRun> = {};

    // Trust Claude's styles - parse them from the element
    if (style.fontSize) {
      initialStyles.fontSize = this.parseFontSize(style.fontSize);
    }
    if (style.color) {
      initialStyles.color = this.parseColor(style.color);
    }
    if (style.fontFamily) {
      initialStyles.fontFamily = this.parseFontFamily(style.fontFamily);
    }
    if (style.fontWeight === 'bold' || parseInt(style.fontWeight || '400', 10) >= 700) {
      initialStyles.bold = true;
    }
    if (style.fontStyle === 'italic') {
      initialStyles.italic = true;
    }

    // Parse runs with Claude's styles as initial inherited styles
    const runs = this.parseInlineContent(element, footnoteRefs, false, initialStyles);

    // Apply defaults only as final fallback (when Claude didn't specify)
    for (const run of runs) {
      if (!run.fontSize) run.fontSize = DEFAULT_STYLES.p.fontSize;
      if (!run.color) run.color = DEFAULT_STYLES.p.color;
      if (!run.fontFamily) run.fontFamily = DEFAULT_STYLES.p.fontFamily;
    }

    // Parse first-line indent from Claude's text-indent, default to 0.5 inch if not specified
    const explicitIndent = this.parseIndent(style.textIndent);
    const firstLineIndent = explicitIndent !== undefined ? explicitIndent : 720;

    // Parse spacing from Claude's margin/padding styles
    const spacingAfter = this.parseSpacingValue(style.marginBottom) ?? 160; // Default 8pt
    const lineHeight = this.parseLineHeight(style.lineHeight) ?? 336; // Default 1.4

    return {
      runs,
      alignment: this.getAlignment(style) || 'both', // Justify by default
      firstLineIndent,
      spacing: {
        after: spacingAfter,
        line: lineHeight,
      },
      shading: this.parseBackgroundColor(style.background || style.backgroundColor),
    };
  }

  /**
   * Parse div element (callout boxes, etc.)
   * Supports both class-based callouts (class="callout", class="callout-warning")
   * and inline style callouts (background, border-left)
   */
  private parseDiv(element: DOMElement, footnoteRefs: Set<number>): Paragraph[] {
    const style = this.parseInlineStyle(element);
    const paragraphs: Paragraph[] = [];

    // Check for class-based callouts (semantic HTML approach)
    const className = element.getAttribute('class') || '';
    const isCallout = className.includes('callout');
    const isWarningCallout = className.includes('callout-warning');

    // Check if this is a callout box (has background, border, or callout class)
    const hasBackground = style.background || style.backgroundColor || isCallout;
    const hasBorder = style.border || style.borderLeft || isCallout;

    // Define default callout styles for class-based callouts
    const calloutBackground = isWarningCallout ? 'FDF2F2' : 'F5F5F5'; // Light red or light gray
    const calloutBorderColor = isWarningCallout ? '9B2335' : 'CCCCCC'; // Bojin red or gray

    // Parse children
    for (const child of Array.from(element.children)) {
      const childElement = child as DOMElement;
      const childTag = childElement.tagName.toLowerCase();

      let para: Paragraph;

      if (childTag === 'p' || childTag === 'strong' || childTag === 'span') {
        para = this.parseParagraph(childElement, footnoteRefs);
      } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(childTag)) {
        para = this.parseHeading(childElement, footnoteRefs);
      } else {
        // For other elements, extract Claude's styles and pass as initial styles
        const childStyle = this.parseInlineStyle(childElement);
        const initialStyles: Partial<TextRun> = {};

        if (childStyle.fontSize) {
          initialStyles.fontSize = this.parseFontSize(childStyle.fontSize);
        }
        if (childStyle.color) {
          initialStyles.color = this.parseColor(childStyle.color);
        }
        if (childStyle.fontFamily) {
          initialStyles.fontFamily = this.parseFontFamily(childStyle.fontFamily);
        }

        const runs = this.parseInlineContent(childElement, footnoteRefs, false, initialStyles);

        // Apply defaults as fallback
        for (const run of runs) {
          if (!run.fontSize) run.fontSize = DEFAULT_STYLES.p.fontSize;
          if (!run.color) run.color = DEFAULT_STYLES.p.color;
          if (!run.fontFamily) run.fontFamily = DEFAULT_STYLES.p.fontFamily;
        }

        para = {
          runs,
          spacing: { after: 120, line: 312 },
        };
      }

      // Apply callout styling
      if (hasBackground || hasBorder) {
        // Remove first-line indent for callout content
        para.firstLineIndent = 0;
        para.alignment = 'left'; // Don't justify callout text
      }

      if (hasBackground) {
        // Use class-based default or parse inline style
        if (isCallout && !style.background && !style.backgroundColor) {
          para.shading = calloutBackground;
        } else {
          para.shading = this.parseBackgroundColor(style.background || style.backgroundColor || '');
        }
        para.indent = 284; // Slight indent for callout content
      }

      if (hasBorder) {
        // Use class-based default or parse inline style
        if (isCallout && !style.border && !style.borderLeft) {
          // Class-based callout: use left border style
          if (isWarningCallout) {
            // Warning callout: box border in Bojin red
            para.borderBox = { size: 8, color: calloutBorderColor };
          } else {
            // Normal callout: left border in gray
            para.borderLeft = { size: 24, color: calloutBorderColor };
          }
        } else {
          const borderStyle = this.parseBorderStyle(style);
          if (borderStyle.type === 'left') {
            para.borderLeft = { size: borderStyle.size, color: borderStyle.color };
          } else if (borderStyle.type === 'box') {
            para.borderBox = { size: borderStyle.size, color: borderStyle.color };
          }
        }
      }

      // Keep callout paragraphs together
      para.keepLines = true;
      para.keepNext = true;

      paragraphs.push(para);
    }

    // Remove keepNext from last paragraph
    if (paragraphs.length > 0) {
      paragraphs[paragraphs.length - 1].keepNext = false;
    }

    // If div has no child elements but has text content
    if (paragraphs.length === 0 && element.textContent?.trim()) {
      // Extract Claude's styles from the div element
      const initialStyles: Partial<TextRun> = {};

      if (style.fontSize) {
        initialStyles.fontSize = this.parseFontSize(style.fontSize);
      }
      if (style.color) {
        initialStyles.color = this.parseColor(style.color);
      }
      if (style.fontFamily) {
        initialStyles.fontFamily = this.parseFontFamily(style.fontFamily);
      }

      const runs = this.parseInlineContent(element, footnoteRefs, false, initialStyles);

      // Apply defaults as fallback
      for (const run of runs) {
        if (!run.fontSize) run.fontSize = DEFAULT_STYLES.p.fontSize;
        if (!run.color) run.color = DEFAULT_STYLES.p.color;
        if (!run.fontFamily) run.fontFamily = DEFAULT_STYLES.p.fontFamily;
      }

      const para: Paragraph = {
        runs,
        spacing: { after: 120 },
      };

      if (hasBackground) {
        // Use class-based default or parse inline style
        if (isCallout && !style.background && !style.backgroundColor) {
          para.shading = calloutBackground;
        } else {
          para.shading = this.parseBackgroundColor(style.background || style.backgroundColor || '');
        }
      }

      paragraphs.push(para);
    }

    return paragraphs;
  }

  /**
   * Parse list (ul/ol) with nesting support
   * Trusts Claude's inline styles, uses defaults only as fallback
   *
   * For ordered lists, each top-level list gets a unique numId to restart numbering.
   * Nested lists inherit their parent's numId (Word handles nesting via ilvl).
   */
  private parseList(
    element: DOMElement,
    ordered: boolean,
    level: number,
    footnoteRefs: Set<number>,
    listCounter: { orderedListCount: number },
    parentNumId?: number
  ): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    // Determine numId for this list
    let numId: number;
    if (!ordered) {
      // Unordered lists always use numId 1
      numId = 1;
    } else if (level === 0) {
      // Top-level ordered list: get a new unique numId (starting at 3)
      // numId 1 = bullet list, numId 2 = base abstract definition
      // numId 3+ = each separate ordered list
      listCounter.orderedListCount++;
      numId = 2 + listCounter.orderedListCount;
    } else {
      // Nested ordered list: use parent's numId (Word uses ilvl for nesting)
      numId = parentNumId ?? 2;
    }

    // Get list-level styles from Claude
    const listStyle = this.parseInlineStyle(element);

    for (const child of Array.from(element.children)) {
      if (child.tagName.toLowerCase() === 'li') {
        const li = child as DOMElement;
        const liStyle = this.parseInlineStyle(li);

        // Check for nested lists
        const nestedUl = li.querySelector(':scope > ul');
        const nestedOl = li.querySelector(':scope > ol');

        // Get the text content (excluding nested lists)
        const textContent = Array.from(li.childNodes)
          .filter(
            (node) =>
              node.nodeType === 3 || // Text node
              (node.nodeType === 1 &&
                !['ul', 'ol'].includes((node as unknown as DOMElement).tagName.toLowerCase()))
          )
          .map((node) => {
            if (node.nodeType === 3) return node.textContent || '';
            return (node as unknown as DOMElement).textContent || '';
          })
          .join('')
          .trim();

        if (textContent) {
          // Extract element-level styles from Claude's CSS (inherit from list, then override with li)
          const initialStyles: Partial<TextRun> = {};

          // First apply list-level styles
          if (listStyle.fontSize) {
            initialStyles.fontSize = this.parseFontSize(listStyle.fontSize);
          }
          if (listStyle.color) {
            initialStyles.color = this.parseColor(listStyle.color);
          }
          if (listStyle.fontFamily) {
            initialStyles.fontFamily = this.parseFontFamily(listStyle.fontFamily);
          }

          // Then override with li-level styles
          if (liStyle.fontSize) {
            initialStyles.fontSize = this.parseFontSize(liStyle.fontSize);
          }
          if (liStyle.color) {
            initialStyles.color = this.parseColor(liStyle.color);
          }
          if (liStyle.fontFamily) {
            initialStyles.fontFamily = this.parseFontFamily(liStyle.fontFamily);
          }
          if (liStyle.fontWeight === 'bold' || parseInt(liStyle.fontWeight || '400', 10) >= 700) {
            initialStyles.bold = true;
          }
          if (liStyle.fontStyle === 'italic') {
            initialStyles.italic = true;
          }

          // Parse runs with Claude's styles as initial inherited styles
          const runs = this.parseInlineContent(li, footnoteRefs, true, initialStyles);

          // Apply defaults only as final fallback
          for (const run of runs) {
            if (!run.fontSize) run.fontSize = DEFAULT_STYLES.li.fontSize;
            if (!run.color) run.color = DEFAULT_STYLES.li.color;
            if (!run.fontFamily) run.fontFamily = DEFAULT_STYLES.li.fontFamily;
          }

          // Parse spacing from Claude's styles
          const spacingAfter = this.parseSpacingValue(liStyle.marginBottom) ?? 80;
          const lineHeight = this.parseLineHeight(liStyle.lineHeight) ?? 336;

          paragraphs.push({
            runs,
            numbering: { id: numId, level },
            spacing: { after: spacingAfter, line: lineHeight },
            firstLineIndent: 0, // No first-line indent for list items
          });
        }

        // Process nested lists (pass the current numId so they stay part of the same list)
        if (nestedUl) {
          paragraphs.push(
            ...this.parseList(
              nestedUl as DOMElement,
              false,
              level + 1,
              footnoteRefs,
              listCounter,
              numId
            )
          );
        }
        if (nestedOl) {
          paragraphs.push(
            ...this.parseList(
              nestedOl as DOMElement,
              true,
              level + 1,
              footnoteRefs,
              listCounter,
              numId
            )
          );
        }
      }
    }

    return paragraphs;
  }

  /**
   * Parse table element
   */
  private parseTable(element: DOMElement): Table {
    const rows: TableRow[] = [];

    // Process thead
    const thead = element.querySelector('thead');
    if (thead) {
      for (const tr of Array.from(thead.querySelectorAll('tr'))) {
        rows.push(this.parseTableRow(tr as DOMElement, true));
      }
    }

    // Process tbody
    const tbody = element.querySelector('tbody') || element;
    for (const tr of Array.from(tbody.querySelectorAll(':scope > tr'))) {
      rows.push(this.parseTableRow(tr as DOMElement, false));
    }

    return { rows };
  }

  /**
   * Parse table row
   * Trusts Claude's inline styles, uses defaults only as fallback
   */
  private parseTableRow(element: DOMElement, isHeader: boolean): TableRow {
    const cells: TableCell[] = [];

    for (const cell of Array.from(element.querySelectorAll('th, td'))) {
      const cellElement = cell as DOMElement;
      const style = this.parseInlineStyle(cellElement);

      // Extract element-level styles from Claude's CSS
      const initialStyles: Partial<TextRun> = {};

      if (style.fontSize) {
        initialStyles.fontSize = this.parseFontSize(style.fontSize);
      }
      if (style.color) {
        initialStyles.color = this.parseColor(style.color);
      }
      if (style.fontFamily) {
        initialStyles.fontFamily = this.parseFontFamily(style.fontFamily);
      }
      if (
        style.fontWeight === 'bold' ||
        parseInt(style.fontWeight || '400', 10) >= 700 ||
        isHeader
      ) {
        initialStyles.bold = true; // Headers are bold by default
      }
      if (style.fontStyle === 'italic') {
        initialStyles.italic = true;
      }

      // Parse cell content with Claude's styles as initial inherited styles
      const runs = this.parseInlineContent(cellElement, new Set(), false, initialStyles);

      // Apply defaults only as final fallback
      for (const run of runs) {
        if (!run.fontSize) run.fontSize = DEFAULT_STYLES.p.fontSize;
        if (!run.color) run.color = DEFAULT_STYLES.p.color;
        if (!run.fontFamily) run.fontFamily = DEFAULT_STYLES.p.fontFamily;
      }

      // Parse alignment from Claude's styles
      const alignment = this.getAlignment(style);

      cells.push({
        paragraphs: [
          {
            runs,
            alignment,
            spacing: { after: 0, line: 240 }, // Single-spacing in cells
          },
        ],
        shading: isHeader
          ? 'F9F9F9'
          : this.parseBackgroundColor(style.backgroundColor || style.background),
        borderBottom: isHeader ? { size: 8, color: 'DDDDDD' } : undefined,
      });
    }

    return { cells, isHeader };
  }

  /**
   * Parse blockquote element
   * Trusts Claude's inline styles, uses defaults only as fallback
   */
  private parseBlockquote(element: DOMElement, footnoteRefs: Set<number>): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const blockStyle = this.parseInlineStyle(element);

    // Parse border styling from Claude's CSS
    const borderStyle = this.parseBorderStyle(blockStyle);
    const borderLeft =
      borderStyle.type === 'left'
        ? { size: borderStyle.size || 16, color: borderStyle.color || 'CCCCCC' }
        : { size: 16, color: 'CCCCCC' }; // Default

    // Parse indent from Claude's padding/margin
    const indent = this.parseSpacingValue(blockStyle.paddingLeft || blockStyle.marginLeft) ?? 720;

    for (const child of Array.from(element.children)) {
      if (child.tagName.toLowerCase() === 'p') {
        const para = this.parseParagraph(child as DOMElement, footnoteRefs);
        para.indent = indent;
        para.firstLineIndent = 0; // No first-line indent for blockquotes
        para.borderLeft = borderLeft;
        para.alignment = 'left'; // Don't justify blockquotes
        paragraphs.push(para);
      }
    }

    // If no children, treat the whole blockquote as one paragraph
    if (paragraphs.length === 0 && element.textContent?.trim()) {
      // Extract element-level styles from Claude's CSS
      const initialStyles: Partial<TextRun> = {};

      if (blockStyle.fontSize) {
        initialStyles.fontSize = this.parseFontSize(blockStyle.fontSize);
      }
      if (blockStyle.color) {
        initialStyles.color = this.parseColor(blockStyle.color);
      }
      if (blockStyle.fontFamily) {
        initialStyles.fontFamily = this.parseFontFamily(blockStyle.fontFamily);
      }
      if (blockStyle.fontStyle === 'italic') {
        initialStyles.italic = true;
      }

      // Parse runs with Claude's styles as initial inherited styles
      const runs = this.parseInlineContent(element, footnoteRefs, false, initialStyles);

      // Apply defaults only as final fallback
      for (const run of runs) {
        if (!run.fontSize) run.fontSize = DEFAULT_STYLES.blockquote.fontSize;
        if (!run.color) run.color = DEFAULT_STYLES.blockquote.color;
        if (!run.fontFamily) run.fontFamily = DEFAULT_STYLES.blockquote.fontFamily;
      }

      paragraphs.push({
        runs,
        indent,
        firstLineIndent: 0,
        borderLeft,
        alignment: 'left',
      });
    }

    return paragraphs;
  }

  /**
   * Parse horizontal rule
   */
  private parseHorizontalRule(_element: DOMElement): Paragraph {
    return {
      runs: [],
      spacing: { before: 120, after: 120 },
      borderBox: { size: 4, color: 'CCCCCC' },
    };
  }

  /**
   * Parse footer element for footnote definitions.
   * Supports multiple formats:
   * 1. Standard: <p id="fn1"><sup>1</sup> Citation text</p>
   * 2. Numbered paragraphs: <p>1. Citation text</p>
   * 3. Plain numbered text: "1. Citation text" (within any container)
   */
  private parseFooter(element: DOMElement): FootnoteDefinition[] {
    const footnotes: FootnoteDefinition[] = [];

    // Format 1: Standard <p id="fn..."> format
    for (const p of Array.from(element.querySelectorAll('p[id^="fn"]'))) {
      const id = p.getAttribute('id');
      if (id) {
        const match = id.match(/fn(\d+)/);
        if (match) {
          const content = p.textContent?.replace(/^\d+\s*/, '').trim() || '';
          footnotes.push({ id: parseInt(match[1], 10), content });
        }
      }
    }

    // If we found footnotes with standard format, return them
    if (footnotes.length > 0) {
      return footnotes;
    }

    // Format 2 & 3: Try to parse numbered paragraphs/text
    // Look for patterns like "1. Text", "1 Text", or "<sup>1</sup> Text"
    const allParagraphs = element.querySelectorAll('p');
    for (const p of Array.from(allParagraphs)) {
      const text = p.textContent?.trim() || '';

      // Pattern: "1. Citation text" or "1 Citation text"
      const numberedMatch = text.match(/^(\d+)[.\s]+(.+)/);
      if (numberedMatch) {
        const id = parseInt(numberedMatch[1], 10);
        const content = numberedMatch[2].trim();
        // Avoid duplicates
        if (!footnotes.some((fn) => fn.id === id)) {
          footnotes.push({ id, content });
        }
      }
    }

    // Sort by ID to ensure consistent ordering
    footnotes.sort((a, b) => a.id - b.id);

    return footnotes;
  }

  /**
   * Extract footnotes from a section that might contain footnote definitions.
   * Called when we find a section/div with "NOTE", "SUBSOL", or "REFERINȚE" in heading.
   */
  private extractFootnotesFromSection(element: DOMElement): FootnoteDefinition[] {
    const footnotes: FootnoteDefinition[] = [];

    // Get all text content and try to parse numbered references
    const textContent = element.textContent || '';
    const lines = textContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Pattern: "1. Citation text" at start of line
      const match = trimmed.match(/^(\d+)[.\s]+(.+)/);
      if (match) {
        const id = parseInt(match[1], 10);
        const content = match[2].trim();
        // Only add if it looks like a citation (has some length)
        if (content.length > 10 && !footnotes.some((fn) => fn.id === id)) {
          footnotes.push({ id, content });
        }
      }
    }

    return footnotes;
  }

  /**
   * Parse inline content (text with formatting)
   * @param element - The DOM element to parse
   * @param footnoteRefs - Set to track footnote references
   * @param excludeNestedLists - Whether to skip nested ul/ol elements
   * @param initialStyles - Optional initial styles from parent element (Claude's inline styles)
   */
  private parseInlineContent(
    element: DOMElement,
    footnoteRefs: Set<number>,
    excludeNestedLists = false,
    initialStyles: Partial<TextRun> = {}
  ): TextRun[] {
    const runs: TextRun[] = [];

    const processNode = (node: DOMNode, inherited: Partial<TextRun> = {}) => {
      if (node.nodeType === 3) {
        // Text node
        const text = node.textContent || '';
        if (text) {
          runs.push({ text, ...inherited });
        }
      } else if (node.nodeType === 1) {
        const el = node as unknown as DOMElement;
        const tag = el.tagName.toLowerCase();

        // Skip nested lists if requested
        if (excludeNestedLists && ['ul', 'ol'].includes(tag)) {
          return;
        }

        // Check for footnote reference
        if (tag === 'sup' && el.querySelector('a[href^="#fn"]')) {
          const link = el.querySelector('a[href^="#fn"]');
          const href = link?.getAttribute('href');
          if (href) {
            const match = href.match(/#fn(\d+)/);
            if (match) {
              const fnId = parseInt(match[1], 10);
              footnoteRefs.add(fnId);
              runs.push({ text: '', footnoteId: fnId });
              return;
            }
          }
        }

        // Build inherited styles
        const newInherited: Partial<TextRun> = { ...inherited };
        const style = this.parseInlineStyle(el);

        switch (tag) {
          case 'strong':
          case 'b':
            newInherited.bold = true;
            break;
          case 'em':
          case 'i':
            newInherited.italic = true;
            break;
          case 'u':
            newInherited.underline = true;
            break;
          case 's':
          case 'del':
            newInherited.strikethrough = true;
            break;
          case 'sup':
            newInherited.superscript = true;
            break;
          case 'sub':
            newInherited.subscript = true;
            break;
        }

        // Apply inline style overrides (Claude's styles)
        if (style.fontWeight === 'bold' || parseInt(style.fontWeight || '400', 10) >= 700) {
          newInherited.bold = true;
        }
        if (style.fontStyle === 'italic') {
          newInherited.italic = true;
        }
        if (style.textDecoration?.includes('underline')) {
          newInherited.underline = true;
        }
        if (style.color) {
          newInherited.color = this.parseColor(style.color);
        }
        if (style.fontSize) {
          newInherited.fontSize = this.parseFontSize(style.fontSize);
        }
        if (style.fontFamily) {
          newInherited.fontFamily = this.parseFontFamily(style.fontFamily);
        }

        // Process children
        for (const child of Array.from(el.childNodes)) {
          processNode(child, newInherited);
        }
      }
    };

    // Start with initial styles from parent element (Claude's styles on the p/h1/etc)
    for (const child of Array.from(element.childNodes)) {
      processNode(child, initialStyles);
    }

    return this.mergeAdjacentRuns(runs);
  }

  /**
   * Parse font-family CSS value to a single font name
   * Handles font stacks like "Georgia, serif" → "Georgia"
   */
  private parseFontFamily(fontFamily: string): string {
    if (!fontFamily) return '';

    // Remove quotes and get first font in stack
    const firstFont = fontFamily
      .split(',')[0]
      .trim()
      .replace(/^["']|["']$/g, '');

    // Map common CSS fonts to Word-compatible names
    const fontMap: Record<string, string> = {
      georgia: 'Georgia',
      'times new roman': 'Times New Roman',
      times: 'Times New Roman',
      serif: 'Georgia',
      arial: 'Arial',
      helvetica: 'Arial',
      'sans-serif': 'Arial',
      'source serif pro': 'Source Serif Pro',
      inter: 'Inter',
      calibri: 'Calibri',
      cambria: 'Cambria',
    };

    return fontMap[firstFont.toLowerCase()] || firstFont;
  }

  /**
   * Parse inline style attribute into object
   */
  private parseInlineStyle(element: DOMElement): Record<string, string> {
    const style: Record<string, string> = {};
    const styleAttr = element.getAttribute('style');

    if (styleAttr) {
      for (const declaration of styleAttr.split(';')) {
        const [prop, value] = declaration.split(':').map((s) => s.trim());
        if (prop && value) {
          // Convert kebab-case to camelCase
          const camelProp = prop.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
          style[camelProp] = value;
        }
      }
    }

    return style;
  }

  /**
   * Parse color value to hex without #
   */
  private parseColor(color: string): string {
    if (!color) return '';

    // Already hex
    if (color.startsWith('#')) {
      return color.slice(1).toUpperCase();
    }

    // RGB format
    const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      return (
        r.toString(16).padStart(2, '0') +
        g.toString(16).padStart(2, '0') +
        b.toString(16).padStart(2, '0')
      ).toUpperCase();
    }

    // Named colors (common ones)
    const namedColors: Record<string, string> = {
      black: '000000',
      white: 'FFFFFF',
      red: 'FF0000',
      green: '00FF00',
      blue: '0000FF',
      gray: '808080',
      grey: '808080',
    };

    return namedColors[color.toLowerCase()] || '';
  }

  /**
   * Parse font size to half-points
   */
  private parseFontSize(size: string): number {
    if (!size) return 24; // Default 12pt

    // Handle pt values
    const ptMatch = size.match(/^([\d.]+)\s*pt$/i);
    if (ptMatch) {
      return Math.round(parseFloat(ptMatch[1]) * 2);
    }

    // Handle px values (approximate conversion: 1pt ≈ 1.333px)
    const pxMatch = size.match(/^([\d.]+)\s*px$/i);
    if (pxMatch) {
      return Math.round((parseFloat(pxMatch[1]) / 1.333) * 2);
    }

    return 24; // Default 12pt
  }

  /**
   * Parse indent value to twips
   */
  private parseIndent(indent: string | undefined): number | undefined {
    if (!indent) return undefined;

    // Handle 0 explicitly
    if (indent === '0' || indent === '0px' || indent === '0pt') {
      return 0;
    }

    // Handle in values
    const inMatch = indent.match(/^([\d.]+)\s*in$/i);
    if (inMatch) {
      return Math.round(parseFloat(inMatch[1]) * 1440);
    }

    // Handle pt values
    const ptMatch = indent.match(/^([\d.]+)\s*pt$/i);
    if (ptMatch) {
      return Math.round(parseFloat(ptMatch[1]) * 20);
    }

    // Handle px values (approximate: 1in = 96px)
    const pxMatch = indent.match(/^([\d.]+)\s*px$/i);
    if (pxMatch) {
      return Math.round((parseFloat(pxMatch[1]) / 96) * 1440);
    }

    // Handle em values (approximate: 1em = 12pt for body text)
    const emMatch = indent.match(/^([\d.]+)\s*em$/i);
    if (emMatch) {
      return Math.round(parseFloat(emMatch[1]) * 12 * 20); // 12pt per em, 20 twips per pt
    }

    return undefined;
  }

  /**
   * Parse spacing value (margin, padding) to twips
   * Used for margin-top, margin-bottom, etc.
   */
  private parseSpacingValue(spacing: string | undefined): number | undefined {
    if (!spacing) return undefined;

    // Handle 0 explicitly
    if (spacing === '0' || spacing === '0px' || spacing === '0pt') {
      return 0;
    }

    // Handle pt values (most common in Claude's output)
    const ptMatch = spacing.match(/^([\d.]+)\s*pt$/i);
    if (ptMatch) {
      return Math.round(parseFloat(ptMatch[1]) * 20);
    }

    // Handle px values
    const pxMatch = spacing.match(/^([\d.]+)\s*px$/i);
    if (pxMatch) {
      // 1px ≈ 0.75pt, 1pt = 20 twips
      return Math.round(parseFloat(pxMatch[1]) * 0.75 * 20);
    }

    // Handle em values
    const emMatch = spacing.match(/^([\d.]+)\s*em$/i);
    if (emMatch) {
      return Math.round(parseFloat(emMatch[1]) * 12 * 20);
    }

    return undefined;
  }

  /**
   * Parse line-height CSS value to OOXML line spacing (in 240ths of a line)
   * OOXML uses 240 = single line spacing
   */
  private parseLineHeight(lineHeight: string | undefined): number | undefined {
    if (!lineHeight) return undefined;

    // Handle unitless values (multipliers like 1.5, 1.4, etc.)
    const unitlessMatch = lineHeight.match(/^([\d.]+)$/);
    if (unitlessMatch) {
      // 1.0 = single spacing = 240, 1.5 = 360, etc.
      return Math.round(parseFloat(unitlessMatch[1]) * 240);
    }

    // Handle percentage values
    const percentMatch = lineHeight.match(/^([\d.]+)\s*%$/);
    if (percentMatch) {
      // 100% = 240, 150% = 360, etc.
      return Math.round((parseFloat(percentMatch[1]) / 100) * 240);
    }

    // Handle pt values (exact line height)
    const ptMatch = lineHeight.match(/^([\d.]+)\s*pt$/i);
    if (ptMatch) {
      // Convert pt to twips for exact mode - but OOXML uses 240ths for "auto" mode
      // For simplicity, treat pt as relative to 12pt base
      return Math.round((parseFloat(ptMatch[1]) / 12) * 240);
    }

    // Handle px values
    const pxMatch = lineHeight.match(/^([\d.]+)\s*px$/i);
    if (pxMatch) {
      // 16px is roughly single-spaced for 12pt text
      return Math.round((parseFloat(pxMatch[1]) / 16) * 240);
    }

    return undefined;
  }

  /**
   * Parse background color
   */
  private parseBackgroundColor(background: string | undefined): string | undefined {
    if (!background) return undefined;

    // Extract color from background property
    const colorMatch = background.match(/#([0-9a-fA-F]{3,6})/);
    if (colorMatch) {
      let hex = colorMatch[1];
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      return hex.toUpperCase();
    }

    const rgbMatch = background.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (rgbMatch) {
      return this.parseColor(rgbMatch[0]);
    }

    return undefined;
  }

  /**
   * Parse border style
   */
  private parseBorderStyle(style: Record<string, string>): {
    type: 'left' | 'box' | 'none';
    size: number;
    color: string;
  } {
    // Check for border-left
    if (style.borderLeft) {
      const match = style.borderLeft.match(
        /(\d+)px\s+(\w+)\s+(#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|\w+)/
      );
      if (match) {
        return {
          type: 'left',
          size: parseInt(match[1], 10) * 8, // Convert px to eighths of a point
          color: this.parseColor(match[3]),
        };
      }
    }

    // Check for full border
    if (style.border) {
      const match = style.border.match(/(\d+)px\s+(\w+)\s+(#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|\w+)/);
      if (match) {
        return {
          type: 'box',
          size: parseInt(match[1], 10) * 8,
          color: this.parseColor(match[3]),
        };
      }
    }

    return { type: 'none', size: 0, color: '' };
  }

  /**
   * Get alignment from style
   */
  private getAlignment(
    style: Record<string, string>
  ): 'left' | 'center' | 'right' | 'both' | undefined {
    const textAlign = style.textAlign;
    if (textAlign === 'center') return 'center';
    if (textAlign === 'right') return 'right';
    if (textAlign === 'justify') return 'both';
    return undefined;
  }

  /**
   * Merge adjacent runs with identical formatting
   */
  private mergeAdjacentRuns(runs: TextRun[]): TextRun[] {
    if (runs.length === 0) return runs;

    const merged: TextRun[] = [runs[0]];

    for (let i = 1; i < runs.length; i++) {
      const current = runs[i];
      const last = merged[merged.length - 1];

      if (
        last.bold === current.bold &&
        last.italic === current.italic &&
        last.underline === current.underline &&
        last.strikethrough === current.strikethrough &&
        last.superscript === current.superscript &&
        last.subscript === current.subscript &&
        last.fontSize === current.fontSize &&
        last.color === current.color &&
        !last.footnoteId &&
        !current.footnoteId
      ) {
        last.text += current.text;
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Process cross-references in document text
   * Detects patterns like "secțiunea 1.2", "a se vedea secțiunea 3", "Section 1"
   * and creates internal hyperlinks to the corresponding bookmarks.
   */
  private processCrossReferences(parsed: ParsedDocument): void {
    // Build a lookup from section number to bookmark ID
    const numberToBookmark = new Map<string, string>();
    for (const [bookmarkId, number] of parsed.headingNumbers) {
      numberToBookmark.set(number, bookmarkId);
    }

    if (numberToBookmark.size === 0) return;

    // Pattern to match cross-references:
    // - "secțiunea X" or "secțiunii X" or "secțiunile X"
    // - "Section X" (English)
    // - "capitolul X" or "capitolului X"
    // Where X is a number like "1", "2.1", "3.2.1"
    const crossRefPattern =
      /\b(secțiun(?:ea|ii|ile|ilor)|capitolul|capitolului|section)\s+(\d+(?:\.\d+)*)\b/gi;

    // Process all paragraphs
    for (const para of parsed.paragraphs) {
      const newRuns: TextRun[] = [];

      for (const run of para.runs) {
        // Skip runs that already have special properties
        if (run.footnoteId !== undefined || run.crossRefBookmark) {
          newRuns.push(run);
          continue;
        }

        // Search for cross-references in the text
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        const text = run.text;

        // Reset regex state
        crossRefPattern.lastIndex = 0;

        while ((match = crossRefPattern.exec(text)) !== null) {
          const sectionNumber = match[2];
          const bookmarkId = numberToBookmark.get(sectionNumber);

          if (!bookmarkId) {
            // No matching bookmark, skip this match
            continue;
          }

          // Add text before the match
          if (match.index > lastIndex) {
            newRuns.push({
              ...run,
              text: text.substring(lastIndex, match.index),
            });
          }

          // Add the cross-reference as a hyperlink
          newRuns.push({
            ...run,
            text: match[0], // Full match including "secțiunea X"
            crossRefBookmark: bookmarkId,
            color: '0066CC', // Blue color for links
            underline: true,
          });

          lastIndex = match.index + match[0].length;
        }

        // Add remaining text after last match
        if (lastIndex < text.length) {
          if (lastIndex === 0) {
            // No matches, keep original run
            newRuns.push(run);
          } else {
            newRuns.push({
              ...run,
              text: text.substring(lastIndex),
            });
          }
        }
      }

      para.runs = newRuns;
    }
  }

  // ============================================================================
  // OOXML Generation
  // ============================================================================

  /**
   * Apply orphan prevention by chaining keepNext through headings and following paragraphs
   * This ensures headings stay with their content and don't appear alone at page bottom
   */
  private applyOrphanPrevention(paragraphs: Paragraph[], options: ConvertOptions): Paragraph[] {
    const minParagraphs = options.pagination?.minParagraphsAfterHeading ?? 2;
    const pageBreaksBeforeH1 =
      options.pagination?.pageBreaksBeforeH1 ?? options.pageBreaksBeforeH1 ?? false;
    const headingSpacing = options.pagination?.headingSpacing;

    let isFirstH1 = true;
    let hasCoverPage = !!options.coverPage;

    return paragraphs.map((para, index) => {
      // Check if this is a heading
      const isHeading = para.headingStyle?.startsWith('Heading');
      if (!isHeading) return para;

      const level = parseInt(para.headingStyle?.replace('Heading', '') || '1', 10);

      // Apply custom heading spacing if provided
      if (headingSpacing) {
        const spacingKey = `h${level}` as keyof typeof headingSpacing;
        const customSpacing = headingSpacing[spacingKey];
        if (customSpacing) {
          para.spacing = {
            ...para.spacing,
            before: customSpacing.before,
            after: customSpacing.after,
          };
        }
      }

      // Apply page break before H1 (except first one after cover page)
      if (level === 1 && pageBreaksBeforeH1) {
        if (hasCoverPage && isFirstH1) {
          // First H1 after cover page doesn't need page break (cover already has one)
          isFirstH1 = false;
        } else if (!isFirstH1) {
          // Subsequent H1s get page break
          para.pageBreakBefore = true;
        } else {
          isFirstH1 = false;
        }
      }

      // Mark heading to keep with next paragraph
      para.keepNext = true;
      para.keepLines = true;

      // Chain keepNext through the next N non-heading paragraphs
      // This ensures the heading + content block moves together
      let chainedCount = 0;
      for (let i = index + 1; i < paragraphs.length && chainedCount < minParagraphs; i++) {
        const nextPara = paragraphs[i];

        // Stop at next heading - don't chain through it
        if (nextPara.headingStyle?.startsWith('Heading')) {
          break;
        }

        // Mark this paragraph to keep with next (except the last one in the chain)
        chainedCount++;
        if (chainedCount < minParagraphs) {
          nextPara.keepNext = true;
        }
      }

      return para;
    });
  }

  /**
   * Build complete OOXML package
   */
  private buildOoxmlPackage(parsed: ParsedDocument, options: ConvertOptions = {}): string {
    const { tables, footnotes, hasHeadings } = parsed;

    // Apply orphan prevention to paragraphs
    const paragraphs = this.applyOrphanPrevention(parsed.paragraphs, options);

    // Generate body content
    let bodyXml = '';

    // Add cover page if provided
    if (options.coverPage) {
      bodyXml += this.generateCoverPageXml(options.coverPage);
    }

    // Add Table of Contents if requested and document has headings
    if (options.includeTableOfContents && hasHeadings) {
      bodyXml += this.generateTocXml();
    }

    let tableIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      // Insert table if one belongs here
      while (tableIndex < tables.length && tables[tableIndex].index === i) {
        bodyXml += this.tableToOoxml(tables[tableIndex].table);
        tableIndex++;
      }

      bodyXml += this.paragraphToOoxml(paragraphs[i]);
    }

    // Insert remaining tables
    while (tableIndex < tables.length) {
      bodyXml += this.tableToOoxml(tables[tableIndex].table);
      tableIndex++;
    }

    // Add bibliography section if provided
    if (options.bibliography && options.bibliography.length > 0) {
      bodyXml += this.generateBibliographyXml(options.bibliography);
    }

    // Generate supporting parts (only those supported by insertOoxml API)
    // Note: Headers, footers, and images are NOT inserted by Word's insertOoxml()
    const numberingXml = this.generateNumberingXml(parsed.orderedListCount);
    const footnotesXml = this.generateFootnotesXml(footnotes);
    const stylesXml = this.generateStylesXml();
    const sectPr = this.generateSectionProperties();

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">
<pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
<pkg:xmlData>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
</pkg:xmlData>
</pkg:part>
${DOCUMENT_RELS_XML}
${numberingXml}
${footnotesXml}
${stylesXml}
<pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml">
<pkg:xmlData>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${bodyXml}
${sectPr}
</w:body>
</w:document>
</pkg:xmlData>
</pkg:part>
</pkg:package>`;
  }

  // Track bookmark IDs for unique numbering
  private bookmarkIdCounter = 0;

  /**
   * Convert paragraph to OOXML
   */
  private paragraphToOoxml(para: Paragraph): string {
    const pPr = this.buildParagraphProperties(para);
    const runs = para.runs.map((r) => this.runToOoxml(r)).join('');

    // Add bookmark start/end if this paragraph has a bookmark
    if (para.bookmarkId) {
      const bookmarkNum = this.bookmarkIdCounter++;
      const bookmarkStart = `<w:bookmarkStart w:id="${bookmarkNum}" w:name="${para.bookmarkId}"/>`;
      const bookmarkEnd = `<w:bookmarkEnd w:id="${bookmarkNum}"/>`;
      return `<w:p>${pPr}${bookmarkStart}${runs}${bookmarkEnd}</w:p>`;
    }

    return `<w:p>${pPr}${runs}</w:p>`;
  }

  /**
   * Build paragraph properties
   */
  private buildParagraphProperties(para: Paragraph): string {
    const parts: string[] = [];

    // Widow/orphan control
    parts.push('<w:widowControl/>');

    // Page break before paragraph
    if (para.pageBreakBefore) {
      parts.push('<w:pageBreakBefore/>');
    }

    // Pagination
    if (para.keepNext) parts.push('<w:keepNext/>');
    if (para.keepLines) parts.push('<w:keepLines/>');

    // Alignment
    if (para.alignment) {
      parts.push(`<w:jc w:val="${para.alignment}"/>`);
    }

    // Spacing
    if (para.spacing) {
      const spacingParts: string[] = [];
      if (para.spacing.before !== undefined) spacingParts.push(`w:before="${para.spacing.before}"`);
      if (para.spacing.after !== undefined) spacingParts.push(`w:after="${para.spacing.after}"`);
      if (para.spacing.line) spacingParts.push(`w:line="${para.spacing.line}" w:lineRule="auto"`);
      if (spacingParts.length > 0) {
        parts.push(`<w:spacing ${spacingParts.join(' ')}/>`);
      }
    }

    // Indentation
    if (para.indent || para.firstLineIndent) {
      const indentParts: string[] = [];
      if (para.indent) indentParts.push(`w:left="${para.indent}"`);
      if (para.firstLineIndent) indentParts.push(`w:firstLine="${para.firstLineIndent}"`);
      if (indentParts.length > 0) {
        parts.push(`<w:ind ${indentParts.join(' ')}/>`);
      }
    }

    // Borders
    if (para.borderLeft || para.borderBox) {
      const borderParts: string[] = [];
      if (para.borderBox) {
        borderParts.push(
          `<w:top w:val="single" w:sz="${para.borderBox.size}" w:space="4" w:color="${para.borderBox.color}"/>`,
          `<w:left w:val="single" w:sz="${para.borderBox.size}" w:space="4" w:color="${para.borderBox.color}"/>`,
          `<w:bottom w:val="single" w:sz="${para.borderBox.size}" w:space="4" w:color="${para.borderBox.color}"/>`,
          `<w:right w:val="single" w:sz="${para.borderBox.size}" w:space="4" w:color="${para.borderBox.color}"/>`
        );
      } else if (para.borderLeft) {
        borderParts.push(
          `<w:left w:val="single" w:sz="${para.borderLeft.size}" w:space="4" w:color="${para.borderLeft.color}"/>`
        );
      }
      parts.push(`<w:pBdr>${borderParts.join('')}</w:pBdr>`);
    }

    // Shading
    if (para.shading) {
      parts.push(`<w:shd w:val="clear" w:color="auto" w:fill="${para.shading}"/>`);
    }

    // Numbering
    if (para.numbering) {
      parts.push(
        `<w:numPr><w:ilvl w:val="${para.numbering.level}"/><w:numId w:val="${para.numbering.id}"/></w:numPr>`
      );
    }

    // Heading style (for TOC support)
    if (para.headingStyle) {
      parts.unshift(`<w:pStyle w:val="${para.headingStyle}"/>`);
    }

    // Outline level (for TOC - determines which headings appear in TOC)
    if (para.outlineLevel !== undefined) {
      parts.push(`<w:outlineLvl w:val="${para.outlineLevel}"/>`);
    }

    if (parts.length === 0) return '';
    return `<w:pPr>${parts.join('')}</w:pPr>`;
  }

  /**
   * Convert text run to OOXML
   */
  private runToOoxml(run: TextRun): string {
    // Handle footnote reference
    if (run.footnoteId !== undefined) {
      return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${run.footnoteId}"/></w:r>`;
    }

    const rPr = this.buildRunProperties(run);
    const escapedText = this.escapeXml(run.text);
    const needsPreserve = run.text.startsWith(' ') || run.text.endsWith(' ');
    const xmlSpace = needsPreserve ? ' xml:space="preserve"' : '';

    const runXml = `<w:r>${rPr}<w:t${xmlSpace}>${escapedText}</w:t></w:r>`;

    // Wrap in hyperlink if this is a cross-reference
    if (run.crossRefBookmark) {
      return `<w:hyperlink w:anchor="${run.crossRefBookmark}">${runXml}</w:hyperlink>`;
    }

    return runXml;
  }

  /**
   * Build run properties
   */
  private buildRunProperties(run: TextRun): string {
    const parts: string[] = [];

    // Font family
    const font = run.fontFamily || FONT_BODY;
    const fallback = font === FONT_HEADING ? FONT_HEADING_FALLBACK : FONT_BODY_FALLBACK;
    parts.push(
      `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${fallback}"/>`
    );

    // Formatting
    if (run.bold) parts.push('<w:b/>');
    if (run.italic) parts.push('<w:i/>');
    if (run.underline) parts.push('<w:u w:val="single"/>');
    if (run.strikethrough) parts.push('<w:strike/>');
    if (run.superscript) parts.push('<w:vertAlign w:val="superscript"/>');
    if (run.subscript) parts.push('<w:vertAlign w:val="subscript"/>');

    // Font size
    const fontSize = run.fontSize || 24;
    parts.push(`<w:sz w:val="${fontSize}"/>`);
    parts.push(`<w:szCs w:val="${fontSize}"/>`);

    // Color
    if (run.color) {
      parts.push(`<w:color w:val="${run.color}"/>`);
    }

    if (parts.length === 0) return '';
    return `<w:rPr>${parts.join('')}</w:rPr>`;
  }

  /**
   * Convert table to OOXML
   */
  private tableToOoxml(table: Table): string {
    const parts: string[] = ['<w:tbl>'];

    // Table properties
    parts.push('<w:tblPr>');
    parts.push('<w:tblStyle w:val="TableGrid"/>');
    parts.push('<w:tblW w:w="0" w:type="auto"/>');
    parts.push('<w:tblBorders>');
    parts.push('<w:top w:val="single" w:sz="8" w:color="DDDDDD"/>');
    parts.push('<w:left w:val="nil"/>');
    parts.push('<w:bottom w:val="single" w:sz="8" w:color="DDDDDD"/>');
    parts.push('<w:right w:val="nil"/>');
    parts.push('<w:insideH w:val="single" w:sz="4" w:color="EEEEEE"/>');
    parts.push('<w:insideV w:val="nil"/>');
    parts.push('</w:tblBorders>');
    parts.push('<w:tblCellMar>');
    parts.push('<w:top w:w="120" w:type="dxa"/>');
    parts.push('<w:left w:w="120" w:type="dxa"/>');
    parts.push('<w:bottom w:w="120" w:type="dxa"/>');
    parts.push('<w:right w:w="120" w:type="dxa"/>');
    parts.push('</w:tblCellMar>');
    parts.push('</w:tblPr>');

    // Table grid - REQUIRED for Word to render tables correctly
    // Calculate column count from first row, divide page width evenly
    const colCount = table.rows[0]?.cells.length || 1;
    const pageWidthTwips = 9360; // ~6.5 inches in twips (letter size minus margins)
    const colWidth = Math.floor(pageWidthTwips / colCount);
    parts.push('<w:tblGrid>');
    for (let i = 0; i < colCount; i++) {
      parts.push(`<w:gridCol w:w="${colWidth}"/>`);
    }
    parts.push('</w:tblGrid>');

    // Rows
    for (const row of table.rows) {
      parts.push('<w:tr>');

      // Row properties
      if (row.isHeader) {
        parts.push('<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>');
      } else {
        parts.push('<w:trPr><w:cantSplit/></w:trPr>');
      }

      // Cells
      for (const cell of row.cells) {
        parts.push('<w:tc>');

        // Cell properties
        const tcPrParts: string[] = [];
        if (cell.shading) {
          tcPrParts.push(`<w:shd w:val="clear" w:fill="${cell.shading}"/>`);
        }
        if (cell.borderBottom) {
          tcPrParts.push(
            `<w:tcBorders><w:bottom w:val="single" w:sz="${cell.borderBottom.size}" w:color="${cell.borderBottom.color}"/></w:tcBorders>`
          );
        }
        if (tcPrParts.length > 0) {
          parts.push(`<w:tcPr>${tcPrParts.join('')}</w:tcPr>`);
        }

        // Cell content
        for (const para of cell.paragraphs) {
          parts.push(this.paragraphToOoxml(para));
        }

        parts.push('</w:tc>');
      }

      parts.push('</w:tr>');
    }

    parts.push('</w:tbl>');
    return parts.join('');
  }

  // ============================================================================
  // Supporting OOXML Parts
  // ============================================================================

  /**
   * Generate numbering.xml with dynamic instances for each ordered list.
   * Each top-level ordered list gets a unique numId that restarts at 1.
   */
  private generateNumberingXml(orderedListCount: number): string {
    // Generate <w:num> entries for each ordered list
    // numId 1 = bullet list (abstractNumId 1)
    // numId 2 = base ordered list definition (not used directly)
    // numId 3+ = each separate ordered list (all reference abstractNumId 2)
    let numEntries = `<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>`;

    // Add a <w:num> for each ordered list that restarts at 1
    for (let i = 1; i <= orderedListCount; i++) {
      const numId = 2 + i; // 3, 4, 5, ...
      numEntries += `
<w:num w:numId="${numId}"><w:abstractNumId w:val="2"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`;
    }

    return `<pkg:part pkg:name="/word/numbering.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml">
<pkg:xmlData>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
${ABSTRACT_NUMBERING_XML}
${numEntries}
</w:numbering>
</pkg:xmlData>
</pkg:part>`;
  }

  private generateFootnotesXml(footnotes: FootnoteDefinition[]): string {
    let footnotesContent = `<w:footnote w:type="separator" w:id="-1">
<w:p><w:r><w:separator/></w:r></w:p>
</w:footnote>
<w:footnote w:type="continuationSeparator" w:id="0">
<w:p><w:r><w:continuationSeparator/></w:r></w:p>
</w:footnote>`;

    for (const fn of footnotes) {
      const escapedContent = this.escapeXml(fn.content);
      footnotesContent += `
<w:footnote w:id="${fn.id}">
<w:p>
<w:pPr>
<w:pStyle w:val="FootnoteText"/>
<w:spacing w:line="288" w:lineRule="auto"/>
</w:pPr>
<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:vertAlign w:val="superscript"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:footnoteRef/></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/></w:rPr><w:t xml:space="preserve"> ${escapedContent}</w:t></w:r>
</w:p>
</w:footnote>`;
    }

    return `<pkg:part pkg:name="/word/footnotes.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml">
<pkg:xmlData>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
${footnotesContent}
</w:footnotes>
</pkg:xmlData>
</pkg:part>`;
  }

  /**
   * Generate styles.xml with heading styles for TOC support
   */
  private generateStylesXml(): string {
    return `<pkg:part pkg:name="/word/styles.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml">
<pkg:xmlData>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults>
<w:rPrDefault>
<w:rPr>
<w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:eastAsia="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/>
<w:sz w:val="24"/>
<w:szCs w:val="24"/>
</w:rPr>
</w:rPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:styleId="Heading1">
<w:name w:val="heading 1"/>
<w:basedOn w:val="Normal"/>
<w:next w:val="Normal"/>
<w:qFormat/>
<w:pPr>
<w:keepNext/>
<w:keepLines/>
<w:spacing w:before="480" w:after="240"/>
<w:outlineLvl w:val="0"/>
</w:pPr>
<w:rPr>
<w:rFonts w:ascii="${FONT_HEADING}" w:hAnsi="${FONT_HEADING}" w:cs="${FONT_HEADING_FALLBACK}"/>
<w:b/>
<w:sz w:val="48"/>
<w:szCs w:val="48"/>
<w:color w:val="333333"/>
</w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading2">
<w:name w:val="heading 2"/>
<w:basedOn w:val="Normal"/>
<w:next w:val="Normal"/>
<w:qFormat/>
<w:pPr>
<w:keepNext/>
<w:keepLines/>
<w:spacing w:before="360" w:after="180"/>
<w:outlineLvl w:val="1"/>
</w:pPr>
<w:rPr>
<w:rFonts w:ascii="${FONT_HEADING}" w:hAnsi="${FONT_HEADING}" w:cs="${FONT_HEADING_FALLBACK}"/>
<w:b/>
<w:sz w:val="36"/>
<w:szCs w:val="36"/>
<w:color w:val="9B2335"/>
</w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading3">
<w:name w:val="heading 3"/>
<w:basedOn w:val="Normal"/>
<w:next w:val="Normal"/>
<w:qFormat/>
<w:pPr>
<w:keepNext/>
<w:keepLines/>
<w:spacing w:before="240" w:after="120"/>
<w:outlineLvl w:val="2"/>
</w:pPr>
<w:rPr>
<w:rFonts w:ascii="${FONT_HEADING}" w:hAnsi="${FONT_HEADING}" w:cs="${FONT_HEADING_FALLBACK}"/>
<w:b/>
<w:sz w:val="28"/>
<w:szCs w:val="28"/>
<w:color w:val="333333"/>
</w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading4">
<w:name w:val="heading 4"/>
<w:basedOn w:val="Normal"/>
<w:next w:val="Normal"/>
<w:qFormat/>
<w:pPr>
<w:keepNext/>
<w:keepLines/>
<w:spacing w:before="240" w:after="120"/>
<w:outlineLvl w:val="3"/>
</w:pPr>
<w:rPr>
<w:rFonts w:ascii="${FONT_HEADING}" w:hAnsi="${FONT_HEADING}" w:cs="${FONT_HEADING_FALLBACK}"/>
<w:b/>
<w:sz w:val="24"/>
<w:szCs w:val="24"/>
<w:color w:val="666666"/>
</w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading5">
<w:name w:val="heading 5"/>
<w:basedOn w:val="Normal"/>
<w:next w:val="Normal"/>
<w:qFormat/>
<w:pPr>
<w:keepNext/>
<w:keepLines/>
<w:spacing w:before="240" w:after="120"/>
<w:outlineLvl w:val="4"/>
</w:pPr>
<w:rPr>
<w:rFonts w:ascii="${FONT_HEADING}" w:hAnsi="${FONT_HEADING}" w:cs="${FONT_HEADING_FALLBACK}"/>
<w:b/>
<w:sz w:val="22"/>
<w:szCs w:val="22"/>
<w:color w:val="666666"/>
</w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading6">
<w:name w:val="heading 6"/>
<w:basedOn w:val="Normal"/>
<w:next w:val="Normal"/>
<w:qFormat/>
<w:pPr>
<w:keepNext/>
<w:keepLines/>
<w:spacing w:before="240" w:after="120"/>
<w:outlineLvl w:val="5"/>
</w:pPr>
<w:rPr>
<w:rFonts w:ascii="${FONT_HEADING}" w:hAnsi="${FONT_HEADING}" w:cs="${FONT_HEADING_FALLBACK}"/>
<w:b/>
<w:sz w:val="20"/>
<w:szCs w:val="20"/>
<w:color w:val="666666"/>
</w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="TOCHeading">
<w:name w:val="TOC Heading"/>
<w:basedOn w:val="Heading1"/>
<w:next w:val="Normal"/>
<w:qFormat/>
<w:pPr>
<w:outlineLvl w:val="9"/>
</w:pPr>
</w:style>
<w:style w:type="paragraph" w:styleId="TOC1">
<w:name w:val="toc 1"/>
<w:basedOn w:val="Normal"/>
<w:next w:val="Normal"/>
<w:pPr>
<w:spacing w:after="100"/>
</w:pPr>
</w:style>
<w:style w:type="paragraph" w:styleId="TOC2">
<w:name w:val="toc 2"/>
<w:basedOn w:val="Normal"/>
<w:next w:val="Normal"/>
<w:pPr>
<w:spacing w:after="100"/>
<w:ind w:left="240"/>
</w:pPr>
</w:style>
<w:style w:type="paragraph" w:styleId="TOC3">
<w:name w:val="toc 3"/>
<w:basedOn w:val="Normal"/>
<w:next w:val="Normal"/>
<w:pPr>
<w:spacing w:after="100"/>
<w:ind w:left="480"/>
</w:pPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Normal">
<w:name w:val="Normal"/>
<w:qFormat/>
</w:style>
<w:style w:type="paragraph" w:styleId="FootnoteText">
<w:name w:val="footnote text"/>
<w:basedOn w:val="Normal"/>
<w:pPr>
<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>
</w:pPr>
<w:rPr>
<w:sz w:val="20"/>
<w:szCs w:val="20"/>
</w:rPr>
</w:style>
<w:style w:type="character" w:styleId="FootnoteReference">
<w:name w:val="footnote reference"/>
<w:basedOn w:val="DefaultParagraphFont"/>
<w:rPr>
<w:vertAlign w:val="superscript"/>
</w:rPr>
</w:style>
<w:style w:type="character" w:styleId="Hyperlink">
<w:name w:val="Hyperlink"/>
<w:rPr>
<w:color w:val="0563C1"/>
<w:u w:val="single"/>
</w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Bibliography">
<w:name w:val="Bibliography"/>
<w:basedOn w:val="Normal"/>
<w:next w:val="Bibliography"/>
<w:pPr>
<w:spacing w:after="120"/>
<w:ind w:left="720" w:hanging="720"/>
</w:pPr>
<w:rPr>
<w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/>
<w:sz w:val="22"/>
<w:szCs w:val="22"/>
</w:rPr>
</w:style>
</w:styles>
</pkg:xmlData>
</pkg:part>`;
  }

  /**
   * Generate Table of Contents field
   * The TOC is a field code that Word will populate when the document is opened
   */
  private generateTocXml(): string {
    return `<w:sdt>
<w:sdtPr>
<w:docPartObj>
<w:docPartGallery w:val="Table of Contents"/>
<w:docPartUnique/>
</w:docPartObj>
</w:sdtPr>
<w:sdtContent>
<w:p>
<w:pPr>
<w:pStyle w:val="TOCHeading"/>
</w:pPr>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_HEADING}" w:hAnsi="${FONT_HEADING}" w:cs="${FONT_HEADING_FALLBACK}"/>
<w:b/>
<w:sz w:val="36"/>
<w:szCs w:val="36"/>
</w:rPr>
<w:t>Cuprins</w:t>
</w:r>
</w:p>
<w:p>
<w:pPr>
<w:pStyle w:val="TOC1"/>
<w:tabs>
<w:tab w:val="right" w:leader="dot" w:pos="9350"/>
</w:tabs>
</w:pPr>
<w:r>
<w:fldChar w:fldCharType="begin"/>
</w:r>
<w:r>
<w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText>
</w:r>
<w:r>
<w:fldChar w:fldCharType="separate"/>
</w:r>
<w:r>
<w:rPr>
<w:i/>
<w:color w:val="808080"/>
</w:rPr>
<w:t>Actualizați cuprinsul apăsând Ctrl+A apoi F9</w:t>
</w:r>
<w:r>
<w:fldChar w:fldCharType="end"/>
</w:r>
</w:p>
<w:p>
<w:pPr>
<w:spacing w:after="480"/>
</w:pPr>
</w:p>
</w:sdtContent>
</w:sdt>`;
  }

  /**
   * Generate cover page XML
   */
  private generateCoverPageXml(coverPage: NonNullable<ConvertOptions['coverPage']>): string {
    const date =
      coverPage.date ||
      new Date().toLocaleDateString('ro-RO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

    const documentType = coverPage.documentType || 'Document juridic';

    // Build cover page content
    let coverXml = '';

    // Add some vertical spacing at the top
    coverXml += `<w:p><w:pPr><w:spacing w:before="2400"/></w:pPr></w:p>`;

    // Document type (smaller, centered, gray)
    coverXml += `<w:p>
<w:pPr>
<w:jc w:val="center"/>
<w:spacing w:after="480"/>
</w:pPr>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_HEADING}" w:hAnsi="${FONT_HEADING}" w:cs="${FONT_HEADING_FALLBACK}"/>
<w:sz w:val="28"/>
<w:szCs w:val="28"/>
<w:color w:val="666666"/>
<w:caps/>
</w:rPr>
<w:t>${this.escapeXml(documentType)}</w:t>
</w:r>
</w:p>`;

    // Main title (large, bold, centered, Bojin red)
    coverXml += `<w:p>
<w:pPr>
<w:jc w:val="center"/>
<w:spacing w:after="360"/>
</w:pPr>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_HEADING}" w:hAnsi="${FONT_HEADING}" w:cs="${FONT_HEADING_FALLBACK}"/>
<w:b/>
<w:sz w:val="56"/>
<w:szCs w:val="56"/>
<w:color w:val="9B2335"/>
</w:rPr>
<w:t>${this.escapeXml(coverPage.title)}</w:t>
</w:r>
</w:p>`;

    // Subtitle if provided
    if (coverPage.subtitle) {
      coverXml += `<w:p>
<w:pPr>
<w:jc w:val="center"/>
<w:spacing w:after="720"/>
</w:pPr>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_HEADING}" w:hAnsi="${FONT_HEADING}" w:cs="${FONT_HEADING_FALLBACK}"/>
<w:sz w:val="32"/>
<w:szCs w:val="32"/>
<w:color w:val="4A4A4A"/>
</w:rPr>
<w:t>${this.escapeXml(coverPage.subtitle)}</w:t>
</w:r>
</w:p>`;
    }

    // Decorative line
    coverXml += `<w:p>
<w:pPr>
<w:jc w:val="center"/>
<w:pBdr>
<w:bottom w:val="single" w:sz="12" w:space="1" w:color="9B2335"/>
</w:pBdr>
<w:spacing w:after="720"/>
<w:ind w:left="2880" w:right="2880"/>
</w:pPr>
</w:p>`;

    // More vertical space
    coverXml += `<w:p><w:pPr><w:spacing w:before="1200"/></w:pPr></w:p>`;

    // Client (if provided)
    if (coverPage.client) {
      coverXml += `<w:p>
<w:pPr>
<w:jc w:val="center"/>
<w:spacing w:after="240"/>
</w:pPr>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/>
<w:sz w:val="24"/>
<w:szCs w:val="24"/>
<w:color w:val="666666"/>
</w:rPr>
<w:t>Întocmit pentru</w:t>
</w:r>
</w:p>
<w:p>
<w:pPr>
<w:jc w:val="center"/>
<w:spacing w:after="480"/>
</w:pPr>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/>
<w:b/>
<w:sz w:val="28"/>
<w:szCs w:val="28"/>
<w:color w:val="333333"/>
</w:rPr>
<w:t>${this.escapeXml(coverPage.client)}</w:t>
</w:r>
</w:p>`;
    }

    // Author (if provided)
    if (coverPage.author) {
      coverXml += `<w:p>
<w:pPr>
<w:jc w:val="center"/>
<w:spacing w:after="240"/>
</w:pPr>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/>
<w:sz w:val="24"/>
<w:szCs w:val="24"/>
<w:color w:val="666666"/>
</w:rPr>
<w:t>Autor</w:t>
</w:r>
</w:p>
<w:p>
<w:pPr>
<w:jc w:val="center"/>
<w:spacing w:after="480"/>
</w:pPr>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/>
<w:sz w:val="26"/>
<w:szCs w:val="26"/>
<w:color w:val="333333"/>
</w:rPr>
<w:t>${this.escapeXml(coverPage.author)}</w:t>
</w:r>
</w:p>`;
    }

    // Date
    coverXml += `<w:p>
<w:pPr>
<w:jc w:val="center"/>
<w:spacing w:before="960"/>
</w:pPr>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/>
<w:sz w:val="22"/>
<w:szCs w:val="22"/>
<w:color w:val="808080"/>
</w:rPr>
<w:t>${this.escapeXml(date)}</w:t>
</w:r>
</w:p>`;

    // Page break after cover
    coverXml += `<w:p>
<w:pPr>
<w:pageBreakBefore/>
</w:pPr>
</w:p>`;

    return coverXml;
  }

  /**
   * Generate bibliography section XML
   */
  private generateBibliographyXml(entries: BibliographyEntry[]): string {
    // Group entries by type
    const grouped = {
      legislation: entries.filter((e) => e.type === 'legislation'),
      jurisprudence: entries.filter((e) => e.type === 'jurisprudence'),
      doctrine: entries.filter((e) => e.type === 'doctrine'),
      other: entries.filter((e) => e.type === 'other'),
    };

    const typeLabels: Record<string, string> = {
      legislation: 'Legislație',
      jurisprudence: 'Jurisprudență',
      doctrine: 'Doctrină',
      other: 'Alte surse',
    };

    let bibXml = '';

    // Page break before bibliography
    bibXml += `<w:p>
<w:pPr>
<w:pageBreakBefore/>
</w:pPr>
</w:p>`;

    // Bibliography heading
    bibXml += `<w:p>
<w:pPr>
<w:pStyle w:val="Heading1"/>
<w:keepNext/>
<w:spacing w:after="360"/>
</w:pPr>
<w:bookmarkStart w:id="${this.bookmarkIdCounter}" w:name="_Ref_bibliografie"/>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_HEADING}" w:hAnsi="${FONT_HEADING}" w:cs="${FONT_HEADING_FALLBACK}"/>
<w:b/>
<w:sz w:val="40"/>
<w:szCs w:val="40"/>
<w:color w:val="333333"/>
</w:rPr>
<w:t>Bibliografie</w:t>
</w:r>
<w:bookmarkEnd w:id="${this.bookmarkIdCounter++}"/>
</w:p>`;

    // Generate each category
    for (const [type, label] of Object.entries(typeLabels)) {
      const typeEntries = grouped[type as keyof typeof grouped];
      if (typeEntries.length === 0) continue;

      // Category subheading
      bibXml += `<w:p>
<w:pPr>
<w:pStyle w:val="Heading2"/>
<w:keepNext/>
<w:spacing w:before="360" w:after="240"/>
</w:pPr>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_HEADING}" w:hAnsi="${FONT_HEADING}" w:cs="${FONT_HEADING_FALLBACK}"/>
<w:b/>
<w:sz w:val="28"/>
<w:szCs w:val="28"/>
<w:color w:val="9B2335"/>
</w:rPr>
<w:t>${label}</w:t>
</w:r>
</w:p>`;

      // Entries in this category
      for (const entry of typeEntries) {
        bibXml += `<w:p>
<w:pPr>
<w:pStyle w:val="Bibliography"/>
<w:spacing w:after="120"/>
<w:ind w:left="720" w:hanging="720"/>
</w:pPr>
<w:bookmarkStart w:id="${this.bookmarkIdCounter}" w:name="_Bib_${this.sanitizeBookmarkId(entry.id)}"/>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/>
<w:sz w:val="22"/>
<w:szCs w:val="22"/>
<w:color w:val="333333"/>
</w:rPr>
<w:t>${this.escapeXml(entry.citation)}</w:t>
</w:r>
<w:bookmarkEnd w:id="${this.bookmarkIdCounter++}"/>`;

        // Add URL if available (as hyperlink)
        if (entry.url) {
          bibXml += `
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/>
<w:sz w:val="22"/>
<w:szCs w:val="22"/>
<w:color w:val="808080"/>
</w:rPr>
<w:t xml:space="preserve"> [</w:t>
</w:r>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/>
<w:sz w:val="22"/>
<w:szCs w:val="22"/>
<w:color w:val="0066CC"/>
<w:u w:val="single"/>
</w:rPr>
<w:t>link</w:t>
</w:r>
<w:r>
<w:rPr>
<w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/>
<w:sz w:val="22"/>
<w:szCs w:val="22"/>
<w:color w:val="808080"/>
</w:rPr>
<w:t>]</w:t>
</w:r>`;
        }

        bibXml += `</w:p>`;
      }
    }

    return bibXml;
  }

  /**
   * Sanitize string for use as bookmark ID
   */
  private sanitizeBookmarkId(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 30);
  }

  private generateHeaderXml(): string {
    return `<pkg:part pkg:name="/word/header1.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml">
<pkg:xmlData>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:p>
<w:pPr><w:pStyle w:val="Header"/></w:pPr>
<w:r>
<w:rPr><w:noProof/></w:rPr>
<w:drawing>
<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251658240" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1">
<wp:simplePos x="0" y="0"/>
<wp:positionH relativeFrom="margin"><wp:posOffset>-966650</wp:posOffset></wp:positionH>
<wp:positionV relativeFrom="margin"><wp:posOffset>-940527</wp:posOffset></wp:positionV>
<wp:extent cx="7699556" cy="893135"/>
<wp:effectExtent l="0" t="0" r="0" b="0"/>
<wp:wrapNone/>
<wp:docPr id="1" name="Header Image"/>
<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
<a:graphic>
<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic>
<pic:nvPicPr><pic:cNvPr id="1" name="Header Image"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="7699556" cy="893135"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic>
</a:graphicData>
</a:graphic>
</wp:anchor>
</w:drawing>
</w:r>
</w:p>
</w:hdr>
</pkg:xmlData>
</pkg:part>`;
  }

  private generateFooterXml(): string {
    return `<pkg:part pkg:name="/word/footer1.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml">
<pkg:xmlData>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:p>
<w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="right"/></w:pPr>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/></w:rPr><w:t xml:space="preserve">Pagina </w:t></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:instrText>PAGE</w:instrText></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>1</w:t></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/></w:rPr><w:t xml:space="preserve"> din </w:t></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:instrText>NUMPAGES</w:instrText></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>1</w:t></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>
</w:p>
<w:p>
<w:pPr><w:pStyle w:val="Footer"/></w:pPr>
<w:r>
<w:rPr><w:noProof/></w:rPr>
<w:drawing>
<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251659264" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">
<wp:simplePos x="0" y="0"/>
<wp:positionH relativeFrom="margin"><wp:posOffset>-966443</wp:posOffset></wp:positionH>
<wp:positionV relativeFrom="margin"><wp:posOffset>9032875</wp:posOffset></wp:positionV>
<wp:extent cx="7756525" cy="899160"/>
<wp:effectExtent l="0" t="0" r="0" b="0"/>
<wp:wrapSquare wrapText="bothSides"/>
<wp:docPr id="2" name="Footer Image"/>
<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
<a:graphic>
<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic>
<pic:nvPicPr><pic:cNvPr id="2" name="Footer Image"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="7756525" cy="899160"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic>
</a:graphicData>
</a:graphic>
</wp:anchor>
</w:drawing>
</w:r>
</w:p>
</w:ftr>
</pkg:xmlData>
</pkg:part>`;
  }

  private generateHeaderRelsXml(): string {
    return `<pkg:part pkg:name="/word/_rels/header1.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
<pkg:xmlData>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>
</pkg:xmlData>
</pkg:part>`;
  }

  private generateFooterRelsXml(): string {
    return `<pkg:part pkg:name="/word/_rels/footer1.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
<pkg:xmlData>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.png"/>
</Relationships>
</pkg:xmlData>
</pkg:part>`;
  }

  private generateMediaParts(): string {
    return `<pkg:part pkg:name="/word/media/image1.png" pkg:contentType="image/png" pkg:compression="store">
<pkg:binaryData>${BOJIN_HEADER_PNG_BASE64}</pkg:binaryData>
</pkg:part>
<pkg:part pkg:name="/word/media/image2.png" pkg:contentType="image/png" pkg:compression="store">
<pkg:binaryData>${BOJIN_FOOTER_PNG_BASE64}</pkg:binaryData>
</pkg:part>`;
  }

  private generateSectionProperties(): string {
    // Note: Header/footer references removed - not supported by insertOoxml() API
    return `<w:sectPr>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="709" w:footer="709"/>
</w:sectPr>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// Export singleton instance
export const htmlToOoxmlService = new HtmlToOoxmlService();
