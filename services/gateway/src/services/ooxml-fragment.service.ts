/**
 * OOXML Fragment Service
 * Generates OOXML fragments from extended markdown for Word insertion.
 *
 * Pagination Control:
 * - Headings use keepNext to stay with following content (no orphan headings)
 * - Callout boxes, signatures, conclusions use keepLines + keepNext to stay together
 * - Table rows use cantSplit to prevent row splitting across pages
 * - Table headers repeat on each page via tblHeader
 *
 * Supports 35 element types:
 * - Structure (6): Title, Subtitle, Heading1-3, Normal
 * - Inline (7): Bold, Italic, Underline, Bold+Italic, Small Caps, Strikethrough, Highlight
 * - Lists (4): Bullet, Numbered, Nested L2 (letter), Nested L3 (roman)
 * - Block (4): Quote, Indent L1-L4
 * - Callouts (7): Note, Warning, Important, Example, Definition, Summary, PullQuote
 * - Dividers (3): Simple (---), Decorative (***), Section Break (===)
 * - Layout (3): PageBreak, Centered, Columns
 * - Legal (7): DateLocation, PartyDefinition, PartyLabel, ArticleNumber,
 *   SignatureBlock, Citation, Conclusion
 *
 * Extended Markdown Syntax:
 * - # Title                    -> Title style
 * - ## Subtitle                -> Subtitle style
 * - ### Heading                -> Heading1 style
 * - #### Heading               -> Heading2 style
 * - ##### Heading              -> Heading3 style
 * - Plain text                 -> Normal style
 * - > text                     -> Quote style
 * - - item / 1. item           -> ListParagraph style
 * - text[^1]                   -> FootnoteReference
 * - >> text                    -> Normal + indent L1 (720 twips)
 * - >>> text                   -> Normal + indent L2 (1440 twips)
 * - >>>> text                  -> Normal + indent L3 (2160 twips)
 * - >>>>> text                 -> Normal + indent L4 (2880 twips)
 * - ---                        -> Simple horizontal rule
 * - ***                        -> Decorative divider (• • •)
 * - ===                        -> Heavy section break
 *
 * Inline Formatting:
 * - **text**                   -> Bold
 * - *text*                     -> Italic
 * - _text_                     -> Underline
 * - ***text***                 -> Bold + Italic
 * - ^^TEXT^^                   -> Small Caps
 * - ~~text~~                   -> Strikethrough
 * - ==text==                   -> Highlight (yellow)
 *
 * Custom Blocks (:::type ... :::):
 * - :::date-location           -> DateLocation style
 * - :::party                   -> PartyDefinition style
 * - :::article N               -> ArticleNumber style
 * - :::signature               -> SignatureBlock style
 * - :::citation                -> Citation style
 * - :::conclusion              -> Conclusion style
 * - :::columns                 -> Two-column layout
 * - :::note                    -> Blue info callout box
 * - :::warning                 -> Orange warning callout box
 * - :::important               -> Red critical callout box
 * - :::example                 -> Gray example callout box
 * - :::definition              -> Purple definition callout box
 * - :::summary                 -> Green summary callout box
 * - :::pullquote               -> Large centered quote with borders
 * - :::table                   -> Simple table
 * - :::pagebreak               -> Page break
 * - :::centered                -> Centered text block
 */

// ============================================================================
// Types
// ============================================================================

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  smallCaps?: boolean;
  strikethrough?: boolean;
  highlight?: string; // Highlight color (e.g., 'yellow')
  style?: string; // For custom run styles like PartyLabel
  footnoteId?: number; // For actual Word footnote references
}

interface Paragraph {
  style: string;
  runs: TextRun[];
  indent?: number; // in twips (1/20th of a point), 720 = 0.5 inch
  numbering?: {
    id: number;
    level: number;
  };
  // Callout box formatting
  shading?: string; // Background color hex (e.g., 'E8F4FD')
  borderLeft?: { size: number; color: string }; // Left border only
  borderBox?: { size: number; color: string }; // All sides border
  borderTopBottom?: { size: number; color: string }; // Top and bottom borders
  // Layout
  alignment?: 'left' | 'center' | 'right' | 'both';
  spacing?: { before?: number; after?: number }; // in twips
  // Pagination control
  keepNext?: boolean; // Keep with next paragraph (prevents orphan headings)
  keepLines?: boolean; // Keep all lines together (prevents mid-paragraph breaks)
  pageBreakBefore?: boolean; // Force page break before this paragraph
  // Special paragraph types
  paragraphType?: 'divider' | 'pageBreak' | 'table';
  tableData?: TableData;
}

interface TableData {
  headers: string[];
  rows: string[][];
  style?: 'plain' | 'striped' | 'bordered';
}

interface FootnoteDefinition {
  id: number;
  content: string;
}

interface ParseState {
  inBlock: boolean;
  blockType: string | null;
  blockArgs: string | null;
  blockContent: string[];
}

// ============================================================================
// OOXML Templates
// ============================================================================

// Abstract numbering definitions (templates for bullet and numbered lists)
// These define the format; actual numIds are generated dynamically to allow restart
const ABSTRACT_NUMBERING_XML = `<w:abstractNum w:abstractNumId="1">
<w:multiLevelType w:val="hybridMultilevel"/>
<w:lvl w:ilvl="0">
<w:start w:val="1"/>
<w:numFmt w:val="bullet"/>
<w:lvlText w:val="•"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>
</w:lvl>
<w:lvl w:ilvl="1">
<w:start w:val="1"/>
<w:numFmt w:val="bullet"/>
<w:lvlText w:val="○"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:hint="default"/></w:rPr>
</w:lvl>
<w:lvl w:ilvl="2">
<w:start w:val="1"/>
<w:numFmt w:val="bullet"/>
<w:lvlText w:val="▪"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="2160" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Wingdings" w:hAnsi="Wingdings" w:hint="default"/></w:rPr>
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

/**
 * Generate numbering.xml with dynamic numIds for list restart support
 * Each distinct list sequence gets its own numId to restart numbering
 * @param bulletNumIds - Array of numIds used for bullet lists
 * @param decimalNumIds - Array of numIds used for numbered lists
 */
function generateNumberingXml(bulletNumIds: number[], decimalNumIds: number[]): string {
  // Generate numId entries for each list sequence
  // Bullets reference abstractNumId 1, decimals reference abstractNumId 2
  let numEntries = '';

  for (const numId of bulletNumIds) {
    numEntries += `<w:num w:numId="${numId}"><w:abstractNumId w:val="1"/></w:num>\n`;
  }

  for (const numId of decimalNumIds) {
    numEntries += `<w:num w:numId="${numId}"><w:abstractNumId w:val="2"/></w:num>\n`;
  }

  // Default numIds if no lists exist (prevents Word errors)
  if (bulletNumIds.length === 0 && decimalNumIds.length === 0) {
    numEntries = `<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>`;
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

// Document relationships including numbering.xml and footnotes.xml
const DOCUMENT_RELS_XML = `<pkg:part pkg:name="/word/_rels/document.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
<pkg:xmlData>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
</Relationships>
</pkg:xmlData>
</pkg:part>`;

/**
 * Generate footnotes.xml part for Word footnotes
 * Footnotes appear at the bottom of the page where referenced
 */
function generateFootnotesXml(footnotes: FootnoteDefinition[]): string {
  // Word requires separator and continuation separator footnotes (ids -1 and 0)
  let footnotesContent = `<w:footnote w:type="separator" w:id="-1">
<w:p><w:r><w:separator/></w:r></w:p>
</w:footnote>
<w:footnote w:type="continuationSeparator" w:id="0">
<w:p><w:r><w:continuationSeparator/></w:r></w:p>
</w:footnote>`;

  // Add user-defined footnotes
  for (const fn of footnotes) {
    const escapedContent = fn.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    footnotesContent += `
<w:footnote w:id="${fn.id}">
<w:p>
<w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr>
<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteRef/></w:r>
<w:r><w:t xml:space="preserve"> ${escapedContent}</w:t></w:r>
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
 * Build OOXML package wrapper with optional footnotes and dynamic numbering
 * @param bodyXml - The document body XML
 * @param footnotes - Footnote definitions
 * @param bulletNumIds - Array of numIds used for bullet lists
 * @param decimalNumIds - Array of numIds used for numbered lists
 */
function buildOoxmlWrapper(
  bodyXml: string,
  footnotes: FootnoteDefinition[],
  bulletNumIds: number[],
  decimalNumIds: number[]
): string {
  const footnotesXml = footnotes.length > 0 ? generateFootnotesXml(footnotes) : '';
  const numberingXml = generateNumberingXml(bulletNumIds, decimalNumIds);

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
<pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml">
<pkg:xmlData>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${bodyXml}
</w:body>
</w:document>
</pkg:xmlData>
</pkg:part>
</pkg:package>`;
}

// Style mappings from markdown elements to Word styles
const STYLE_MAP: Record<string, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  heading1: 'Heading1',
  heading2: 'Heading2',
  heading3: 'Heading3',
  normal: 'Normal',
  quote: 'Quote',
  listParagraph: 'ListParagraph',
  dateLocation: 'DateLocation',
  partyDefinition: 'PartyDefinition',
  partyLabel: 'PartyLabel',
  articleNumber: 'ArticleNumber',
  signatureBlock: 'SignatureBlock',
  citation: 'Citation',
  conclusion: 'Conclusion',
};

// Indent values in twips (1 inch = 1440 twips)
const INDENT_L1 = 720; // 0.5 inch
const INDENT_L2 = 1440; // 1 inch
const INDENT_L3 = 2160; // 1.5 inch
const INDENT_L4 = 2880; // 2 inch

// Callout box styles with colors matching the design spec
const CALLOUT_STYLES = {
  note: {
    shading: 'E8F4FD', // Light blue
    borderColor: '2196F3', // Blue
    borderType: 'left' as const,
  },
  warning: {
    shading: 'FFF8E1', // Light amber
    borderColor: 'FF9800', // Orange
    borderType: 'left' as const,
  },
  important: {
    shading: 'FFEBEE', // Light red
    borderColor: 'F44336', // Red
    borderType: 'box' as const,
  },
  example: {
    shading: 'F5F5F5', // Light gray
    borderColor: '9E9E9E', // Gray
    borderType: 'left' as const,
  },
  definition: {
    shading: 'F3E5F5', // Light purple
    borderColor: '9C27B0', // Purple
    borderType: 'box' as const,
  },
  summary: {
    shading: 'E8F5E9', // Light green
    borderColor: '4CAF50', // Green
    borderType: 'box' as const,
  },
};

// ============================================================================
// Service
// ============================================================================

export class OoxmlFragmentService {
  /**
   * Convert extended markdown to OOXML fragment for Word's insertOoxml()
   * Supports real Word footnotes that appear at the bottom of each page
   * Handles list numbering restart - each distinct list sequence gets its own numId
   */
  markdownToOoxmlFragment(markdown: string): string {
    const { paragraphs, footnotes } = this.parseMarkdown(markdown);

    // Post-process paragraphs to assign unique numIds to each list sequence
    // A new sequence starts when a non-list paragraph appears between lists
    const { processedParagraphs, bulletNumIds, decimalNumIds } =
      this.assignListNumberingIds(paragraphs);

    const bodyXml = processedParagraphs.map((p) => this.paragraphToOoxml(p)).join('');
    return buildOoxmlWrapper(bodyXml, footnotes, bulletNumIds, decimalNumIds);
  }

  /**
   * Assign unique numbering IDs to list sequences for proper restart behavior
   * When a non-list paragraph separates two lists, each list gets its own numId
   * This causes Word to restart numbering for each distinct list sequence
   */
  private assignListNumberingIds(paragraphs: Paragraph[]): {
    processedParagraphs: Paragraph[];
    bulletNumIds: number[];
    decimalNumIds: number[];
  } {
    const bulletNumIds: Set<number> = new Set();
    const decimalNumIds: Set<number> = new Set();

    // Track current list type and whether we're in a list
    let currentBulletNumId = 1; // Start at 1 for bullets
    let currentDecimalNumId = 101; // Start at 101 for decimals (to avoid overlap)
    let wasInBulletList = false;
    let wasInDecimalList = false;

    const processed = paragraphs.map((para) => {
      if (!para.numbering) {
        // Non-list paragraph breaks the list sequence
        // Next list item should start a new sequence
        if (wasInBulletList) {
          currentBulletNumId++;
          wasInBulletList = false;
        }
        if (wasInDecimalList) {
          currentDecimalNumId++;
          wasInDecimalList = false;
        }
        return para;
      }

      // This is a list paragraph - determine if bullet (id=1) or decimal (id=2)
      const isBullet = para.numbering.id === 1;

      if (isBullet) {
        // Switching from decimal to bullet also breaks the sequence
        if (wasInDecimalList) {
          currentDecimalNumId++;
          wasInDecimalList = false;
        }

        bulletNumIds.add(currentBulletNumId);
        wasInBulletList = true;

        return {
          ...para,
          numbering: {
            ...para.numbering,
            id: currentBulletNumId,
          },
        };
      } else {
        // Switching from bullet to decimal also breaks the sequence
        if (wasInBulletList) {
          currentBulletNumId++;
          wasInBulletList = false;
        }

        decimalNumIds.add(currentDecimalNumId);
        wasInDecimalList = true;

        return {
          ...para,
          numbering: {
            ...para.numbering,
            id: currentDecimalNumId,
          },
        };
      }
    });

    return {
      processedParagraphs: processed,
      bulletNumIds: Array.from(bulletNumIds),
      decimalNumIds: Array.from(decimalNumIds),
    };
  }

  /**
   * Parse extended markdown into paragraphs with styles and footnotes
   */
  private parseMarkdown(markdown: string): {
    paragraphs: Paragraph[];
    footnotes: FootnoteDefinition[];
  } {
    const lines = markdown.split('\n');
    const paragraphs: Paragraph[] = [];
    const footnotes: FootnoteDefinition[] = [];
    const state: ParseState = {
      inBlock: false,
      blockType: null,
      blockArgs: null,
      blockContent: [],
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for block start (:::type)
      const blockStartMatch = line.match(/^:::(\w+[-\w]*)\s*(.*)$/);
      if (blockStartMatch && !state.inBlock) {
        state.inBlock = true;
        state.blockType = blockStartMatch[1].toLowerCase();
        state.blockArgs = blockStartMatch[2] || null;
        state.blockContent = [];
        continue;
      }

      // Check for block end (:::)
      if (line.trim() === ':::' && state.inBlock) {
        const blockParagraphs = this.processBlock(
          state.blockType!,
          state.blockArgs,
          state.blockContent
        );
        paragraphs.push(...blockParagraphs);
        state.inBlock = false;
        state.blockType = null;
        state.blockArgs = null;
        state.blockContent = [];
        continue;
      }

      // Accumulate block content
      if (state.inBlock) {
        state.blockContent.push(line);
        continue;
      }

      // Check for footnote definitions [^N]: content
      const footnoteDefMatch = line.match(/^\[\^(\d+)\]:\s*(.+)$/);
      if (footnoteDefMatch) {
        footnotes.push({
          id: parseInt(footnoteDefMatch[1], 10),
          content: footnoteDefMatch[2],
        });
        continue;
      }

      // Skip empty lines
      if (!line.trim()) {
        continue;
      }

      // Parse regular line
      const paragraph = this.parseLine(line);
      if (paragraph) {
        paragraphs.push(paragraph);
      }
    }

    // Handle unclosed block (shouldn't happen in well-formed input)
    if (state.inBlock && state.blockContent.length > 0) {
      const blockParagraphs = this.processBlock(
        state.blockType!,
        state.blockArgs,
        state.blockContent
      );
      paragraphs.push(...blockParagraphs);
    }

    return { paragraphs, footnotes };
  }

  /**
   * Parse a single line into a paragraph
   */
  private parseLine(line: string): Paragraph | null {
    // Title: # Title
    const titleMatch = line.match(/^#\s+(.+)$/);
    if (titleMatch) {
      return {
        style: STYLE_MAP.title,
        runs: this.parseInlineFormatting(titleMatch[1]),
        keepNext: true, // Keep title with following content
      };
    }

    // Subtitle: ## Subtitle
    const subtitleMatch = line.match(/^##\s+(.+)$/);
    if (subtitleMatch) {
      return {
        style: STYLE_MAP.subtitle,
        runs: this.parseInlineFormatting(subtitleMatch[1]),
        keepNext: true, // Keep subtitle with following content
      };
    }

    // Heading 1: ### Heading
    const h1Match = line.match(/^###\s+(.+)$/);
    if (h1Match) {
      return {
        style: STYLE_MAP.heading1,
        runs: this.parseInlineFormatting(h1Match[1]),
        keepNext: true, // Keep heading with following content
      };
    }

    // Heading 2: #### Heading
    const h2Match = line.match(/^####\s+(.+)$/);
    if (h2Match) {
      return {
        style: STYLE_MAP.heading2,
        runs: this.parseInlineFormatting(h2Match[1]),
        keepNext: true, // Keep heading with following content
      };
    }

    // Heading 3: ##### Heading
    const h3Match = line.match(/^#####\s+(.+)$/);
    if (h3Match) {
      return {
        style: STYLE_MAP.heading3,
        runs: this.parseInlineFormatting(h3Match[1]),
        keepNext: true, // Keep heading with following content
      };
    }

    // Heavy section break: ===
    if (line.trim() === '===') {
      return {
        style: STYLE_MAP.normal,
        runs: [],
        paragraphType: 'divider',
        borderTopBottom: { size: 12, color: '333333' },
        spacing: { before: 360, after: 360 },
      };
    }

    // Decorative divider: ***
    if (line.trim() === '***') {
      return {
        style: STYLE_MAP.normal,
        runs: [{ text: '• • •' }],
        paragraphType: 'divider',
        alignment: 'center',
        spacing: { before: 240, after: 240 },
      };
    }

    // Simple horizontal rule: ---
    if (line.trim() === '---') {
      return {
        style: STYLE_MAP.normal,
        runs: [],
        paragraphType: 'divider',
        borderTopBottom: { size: 4, color: 'CCCCCC' },
        spacing: { before: 120, after: 120 },
      };
    }

    // Indent L4: >>>>> text (5 >)
    const indentL4Match = line.match(/^>>>>>\s*(.+)$/);
    if (indentL4Match) {
      return {
        style: STYLE_MAP.normal,
        runs: this.parseInlineFormatting(indentL4Match[1]),
        indent: INDENT_L4,
      };
    }

    // Indent L3: >>>> text (4 >)
    const indentL3Match = line.match(/^>>>>\s*(.+)$/);
    if (indentL3Match) {
      return {
        style: STYLE_MAP.normal,
        runs: this.parseInlineFormatting(indentL3Match[1]),
        indent: INDENT_L3,
      };
    }

    // Indent L2: >>> text
    const indentL2Match = line.match(/^>>>\s*(.+)$/);
    if (indentL2Match) {
      return {
        style: STYLE_MAP.normal,
        runs: this.parseInlineFormatting(indentL2Match[1]),
        indent: INDENT_L2,
      };
    }

    // Indent L1: >> text
    const indentL1Match = line.match(/^>>\s*(.+)$/);
    if (indentL1Match) {
      return {
        style: STYLE_MAP.normal,
        runs: this.parseInlineFormatting(indentL1Match[1]),
        indent: INDENT_L1,
      };
    }

    // Quote: > text (single >)
    const quoteMatch = line.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      return {
        style: STYLE_MAP.quote,
        runs: this.parseInlineFormatting(quoteMatch[1]),
      };
    }

    // Nested list level 3 (roman numerals): spaces + i. or ii. etc
    const nestedL3Match = line.match(/^\s{6,}([ivxlcdm]+)\.\s+(.+)$/i);
    if (nestedL3Match) {
      return {
        style: STYLE_MAP.listParagraph,
        runs: this.parseInlineFormatting(nestedL3Match[2]),
        numbering: { id: 2, level: 2 },
      };
    }

    // Nested list level 2 (letters): spaces + a. or b. etc
    const nestedL2Match = line.match(/^\s{3,5}([a-z])\.\s+(.+)$/i);
    if (nestedL2Match) {
      return {
        style: STYLE_MAP.listParagraph,
        runs: this.parseInlineFormatting(nestedL2Match[2]),
        numbering: { id: 2, level: 1 },
      };
    }

    // Unordered list: - item
    const ulMatch = line.match(/^-\s+(.+)$/);
    if (ulMatch) {
      return {
        style: STYLE_MAP.listParagraph,
        runs: this.parseInlineFormatting(ulMatch[1]),
        numbering: { id: 1, level: 0 },
      };
    }

    // Ordered list: 1. item
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      return {
        style: STYLE_MAP.listParagraph,
        runs: this.parseInlineFormatting(olMatch[1]),
        numbering: { id: 2, level: 0 },
      };
    }

    // Default: Normal paragraph
    return {
      style: STYLE_MAP.normal,
      runs: this.parseInlineFormatting(line),
    };
  }

  /**
   * Process a custom block (:::type ... :::)
   */
  private processBlock(
    blockType: string,
    blockArgs: string | null,
    content: string[]
  ): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    switch (blockType) {
      case 'date-location': {
        // DateLocation block - each line is a paragraph with DateLocation style
        for (const line of content) {
          if (line.trim()) {
            paragraphs.push({
              style: STYLE_MAP.dateLocation,
              runs: this.parseInlineFormatting(line.trim()),
            });
          }
        }
        break;
      }

      case 'party': {
        // Party block - paragraphs with PartyDefinition style
        // Lines with **NAME:** pattern get PartyLabel run style
        // Keep entire party block together on same page
        const partyLines = content.filter((line) => line.trim());
        for (let i = 0; i < partyLines.length; i++) {
          const line = partyLines[i];
          const isLast = i === partyLines.length - 1;

          const partyLabelMatch = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
          if (partyLabelMatch) {
            // Party label line: **NAME:** followed by description
            const runs: TextRun[] = [
              { text: partyLabelMatch[1] + ':', bold: true, style: STYLE_MAP.partyLabel },
            ];
            if (partyLabelMatch[2]) {
              runs.push({ text: ' ' + partyLabelMatch[2] });
            }
            paragraphs.push({
              style: STYLE_MAP.partyDefinition,
              runs,
              keepLines: true,
              keepNext: !isLast, // Keep all party lines together
            });
          } else {
            paragraphs.push({
              style: STYLE_MAP.partyDefinition,
              runs: this.parseInlineFormatting(line.trim()),
              keepLines: true,
              keepNext: !isLast,
            });
          }
        }
        break;
      }

      case 'article': {
        // Article block - first paragraph is ArticleNumber with the number
        const articleNumber = blockArgs?.trim() || '';
        if (articleNumber) {
          paragraphs.push({
            style: STYLE_MAP.articleNumber,
            runs: [{ text: `Art. ${articleNumber}`, bold: true }],
          });
        }
        // Content follows as normal paragraphs
        for (const line of content) {
          if (line.trim()) {
            paragraphs.push({
              style: STYLE_MAP.normal,
              runs: this.parseInlineFormatting(line.trim()),
            });
          }
        }
        break;
      }

      case 'signature': {
        // Signature block - each line as SignatureBlock style
        // Keep entire signature block together on same page
        const sigLines = content.filter((line) => line.trim());
        for (let i = 0; i < sigLines.length; i++) {
          const isLast = i === sigLines.length - 1;
          paragraphs.push({
            style: STYLE_MAP.signatureBlock,
            runs: this.parseInlineFormatting(sigLines[i].trim()),
            keepLines: true,
            keepNext: !isLast, // Keep all signature lines together
          });
        }
        break;
      }

      case 'citation': {
        // Citation block - each line as Citation style
        for (const line of content) {
          if (line.trim()) {
            paragraphs.push({
              style: STYLE_MAP.citation,
              runs: this.parseInlineFormatting(line.trim()),
            });
          }
        }
        break;
      }

      case 'conclusion': {
        // Conclusion block - each line as Conclusion style
        // Keep entire conclusion together on same page
        const conclusionLines = content.filter((line) => line.trim());
        for (let i = 0; i < conclusionLines.length; i++) {
          const isLast = i === conclusionLines.length - 1;
          paragraphs.push({
            style: STYLE_MAP.conclusion,
            runs: this.parseInlineFormatting(conclusionLines[i].trim()),
            keepLines: true,
            keepNext: !isLast, // Keep all conclusion lines together
          });
        }
        break;
      }

      case 'columns': {
        // Two-column layout - handled specially in OOXML generation
        // For now, treat as normal paragraphs
        // TODO: Implement proper column section break
        for (const line of content) {
          if (line.trim()) {
            paragraphs.push({
              style: STYLE_MAP.normal,
              runs: this.parseInlineFormatting(line.trim()),
            });
          }
        }
        break;
      }

      // Callout boxes
      case 'note':
      case 'warning':
      case 'important':
      case 'example':
      case 'definition':
      case 'summary': {
        const calloutStyle = CALLOUT_STYLES[blockType as keyof typeof CALLOUT_STYLES];
        const contentLines = content.filter((line) => line.trim());
        for (let i = 0; i < contentLines.length; i++) {
          const line = contentLines[i];
          const isLast = i === contentLines.length - 1;
          const para: Paragraph = {
            style: STYLE_MAP.normal,
            runs: this.parseInlineFormatting(line.trim()),
            shading: calloutStyle.shading,
            indent: 284, // Slight indent for callout content
            spacing: { before: 120, after: 120 },
            keepLines: true, // Keep each callout paragraph together
            keepNext: !isLast, // Keep all callout paragraphs together as a unit
          };
          if (calloutStyle.borderType === 'left') {
            para.borderLeft = { size: 24, color: calloutStyle.borderColor };
          } else {
            para.borderBox = { size: 4, color: calloutStyle.borderColor };
          }
          paragraphs.push(para);
        }
        break;
      }

      case 'pullquote': {
        // Pull quote - large centered text with top/bottom borders
        // Keep entire pull quote together on same page
        const quoteLines = content.filter((line) => line.trim());
        for (let i = 0; i < quoteLines.length; i++) {
          const isLast = i === quoteLines.length - 1;
          paragraphs.push({
            style: STYLE_MAP.normal,
            runs: this.parseInlineFormatting(quoteLines[i].trim()),
            alignment: 'center',
            indent: 720, // Indent from both sides
            borderTopBottom: { size: 4, color: '9B2335' }, // Bojin brand color
            spacing: { before: 240, after: 240 },
            keepLines: true,
            keepNext: !isLast, // Keep all pull quote lines together
          });
        }
        break;
      }

      case 'table': {
        // Parse table markdown into structured data
        const tableData = this.parseTableContent(content, blockArgs);
        if (tableData) {
          paragraphs.push({
            style: STYLE_MAP.normal,
            runs: [],
            paragraphType: 'table',
            tableData,
          });
        }
        break;
      }

      case 'pagebreak': {
        paragraphs.push({
          style: STYLE_MAP.normal,
          runs: [],
          paragraphType: 'pageBreak',
        });
        break;
      }

      case 'centered': {
        for (const line of content) {
          if (line.trim()) {
            paragraphs.push({
              style: STYLE_MAP.normal,
              runs: this.parseInlineFormatting(line.trim()),
              alignment: 'center',
            });
          }
        }
        break;
      }

      default: {
        // Unknown block type - treat as normal paragraphs
        for (const line of content) {
          if (line.trim()) {
            paragraphs.push({
              style: STYLE_MAP.normal,
              runs: this.parseInlineFormatting(line.trim()),
            });
          }
        }
      }
    }

    return paragraphs;
  }

  /**
   * Parse table content from markdown table syntax
   */
  private parseTableContent(content: string[], style: string | null): TableData | null {
    const rows: string[][] = [];
    let headers: string[] = [];
    let headerParsed = false;

    for (const line of content) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip separator lines (|---|---|)
      if (/^\|[-:\s|]+\|$/.test(trimmed)) {
        headerParsed = true;
        continue;
      }

      // Parse table row
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed
          .slice(1, -1)
          .split('|')
          .map((cell) => cell.trim());

        if (!headerParsed && headers.length === 0) {
          headers = cells;
        } else {
          rows.push(cells);
        }
      }
    }

    if (headers.length === 0 && rows.length === 0) {
      return null;
    }

    return {
      headers,
      rows,
      style: (style as TableData['style']) || 'plain',
    };
  }

  /**
   * Parse inline formatting (**bold**, *italic*, ^^small caps^^, ~~strikethrough~~, ==highlight==, [^N] footnotes)
   */
  private parseInlineFormatting(text: string): TextRun[] {
    const runs: TextRun[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      // Check for small caps ^^TEXT^^
      const smallCapsMatch = remaining.match(/^\^\^([^^]+)\^\^/);
      if (smallCapsMatch) {
        runs.push({ text: smallCapsMatch[1], smallCaps: true });
        remaining = remaining.slice(smallCapsMatch[0].length);
        continue;
      }

      // Check for highlight ==text==
      const highlightMatch = remaining.match(/^==([^=]+)==/);
      if (highlightMatch) {
        runs.push({ text: highlightMatch[1], highlight: 'yellow' });
        remaining = remaining.slice(highlightMatch[0].length);
        continue;
      }

      // Check for strikethrough ~~text~~
      const strikeMatch = remaining.match(/^~~([^~]+)~~/);
      if (strikeMatch) {
        runs.push({ text: strikeMatch[1], strikethrough: true });
        remaining = remaining.slice(strikeMatch[0].length);
        continue;
      }

      // Check for bold+italic ***text***
      const boldItalicMatch = remaining.match(/^\*\*\*([^*]+)\*\*\*/);
      if (boldItalicMatch) {
        runs.push({ text: boldItalicMatch[1], bold: true, italic: true });
        remaining = remaining.slice(boldItalicMatch[0].length);
        continue;
      }

      // Check for bold **text**
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        runs.push({ text: boldMatch[1], bold: true });
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Check for italic *text*
      const italicMatch = remaining.match(/^\*([^*]+)\*/);
      if (italicMatch) {
        runs.push({ text: italicMatch[1], italic: true });
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Check for underline _text_
      const underlineMatch = remaining.match(/^_([^_]+)_/);
      if (underlineMatch) {
        runs.push({ text: underlineMatch[1], underline: true });
        remaining = remaining.slice(underlineMatch[0].length);
        continue;
      }

      // Check for footnote reference [^N]
      const footnoteMatch = remaining.match(/^\[\^(\d+)\]/);
      if (footnoteMatch) {
        // Generate actual Word footnote reference (number is auto-generated by Word)
        runs.push({
          text: '', // Word generates the footnote number automatically
          footnoteId: parseInt(footnoteMatch[1], 10),
        });
        remaining = remaining.slice(footnoteMatch[0].length);
        continue;
      }

      // Find the next special character or take all remaining
      const nextSpecialIndex = remaining.search(/\*|_|\[\^|\^{2}|~{2}|={2}/);
      if (nextSpecialIndex === -1) {
        // No more special characters
        runs.push({ text: remaining });
        break;
      } else if (nextSpecialIndex === 0) {
        // Special char at start but not matched - take one char and continue
        runs.push({ text: remaining[0] });
        remaining = remaining.slice(1);
      } else {
        // Take plain text up to the next special character
        runs.push({ text: remaining.slice(0, nextSpecialIndex) });
        remaining = remaining.slice(nextSpecialIndex);
      }
    }

    // Merge adjacent runs with same formatting
    return this.mergeAdjacentRuns(runs);
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
        last.smallCaps === current.smallCaps &&
        last.strikethrough === current.strikethrough &&
        last.highlight === current.highlight &&
        last.style === current.style
      ) {
        // Same formatting - merge
        last.text += current.text;
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Convert a paragraph to OOXML
   */
  private paragraphToOoxml(para: Paragraph): string {
    // Handle special paragraph types
    if (para.paragraphType === 'pageBreak') {
      return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    }

    if (para.paragraphType === 'table' && para.tableData) {
      return this.tableToOoxml(para.tableData);
    }

    const pPr = this.buildParagraphProperties(para);
    // Pass paragraph style to runs for direct formatting fallback
    const runs = para.runs.map((r) => this.runToOoxml(r, para.style)).join('');

    return `<w:p>${pPr}${runs}</w:p>`;
  }

  /**
   * Convert table data to OOXML
   */
  private tableToOoxml(table: TableData): string {
    const parts: string[] = [];

    // Table properties
    parts.push('<w:tbl>');
    parts.push('<w:tblPr>');
    parts.push('<w:tblStyle w:val="TableGrid"/>');
    parts.push('<w:tblW w:w="0" w:type="auto"/>');
    parts.push('<w:tblBorders>');
    parts.push('<w:top w:val="single" w:sz="4" w:color="auto"/>');
    parts.push('<w:left w:val="single" w:sz="4" w:color="auto"/>');
    parts.push('<w:bottom w:val="single" w:sz="4" w:color="auto"/>');
    parts.push('<w:right w:val="single" w:sz="4" w:color="auto"/>');
    parts.push('<w:insideH w:val="single" w:sz="4" w:color="auto"/>');
    parts.push('<w:insideV w:val="single" w:sz="4" w:color="auto"/>');
    parts.push('</w:tblBorders>');
    parts.push('</w:tblPr>');

    // Header row
    if (table.headers.length > 0) {
      parts.push('<w:tr>');
      // Row properties: repeat header on each page + don't split row
      parts.push('<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>');
      for (const header of table.headers) {
        parts.push('<w:tc>');
        parts.push('<w:tcPr><w:shd w:val="clear" w:fill="F5F5F5"/></w:tcPr>');
        parts.push(
          `<w:p><w:pPr><w:keepNext/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${this.escapeXml(header)}</w:t></w:r></w:p>`
        );
        parts.push('</w:tc>');
      }
      parts.push('</w:tr>');
    }

    // Data rows
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
      const row = table.rows[rowIndex];
      parts.push('<w:tr>');
      // Prevent row from splitting across pages
      parts.push('<w:trPr><w:cantSplit/></w:trPr>');
      for (const cell of row) {
        parts.push('<w:tc>');
        // Striped style: alternate row shading
        if (table.style === 'striped' && rowIndex % 2 === 1) {
          parts.push('<w:tcPr><w:shd w:val="clear" w:fill="F9F9F9"/></w:tcPr>');
        }
        parts.push(`<w:p><w:r><w:t>${this.escapeXml(cell)}</w:t></w:r></w:p>`);
        parts.push('</w:tc>');
      }
      parts.push('</w:tr>');
    }

    parts.push('</w:tbl>');
    return parts.join('');
  }

  /**
   * Build paragraph properties XML
   */
  private buildParagraphProperties(para: Paragraph): string {
    const parts: string[] = [];

    // Style reference
    parts.push(`<w:pStyle w:val="${this.escapeXml(para.style)}"/>`);

    // Pagination control - must come early in pPr
    if (para.keepNext) {
      parts.push('<w:keepNext/>');
    }
    if (para.keepLines) {
      parts.push('<w:keepLines/>');
    }
    if (para.pageBreakBefore) {
      parts.push('<w:pageBreakBefore/>');
    }

    // Alignment
    if (para.alignment) {
      const alignMap = { left: 'left', center: 'center', right: 'right', both: 'both' };
      parts.push(`<w:jc w:val="${alignMap[para.alignment]}"/>`);
    }

    // Spacing
    if (para.spacing) {
      const spacingParts: string[] = [];
      if (para.spacing.before !== undefined) {
        spacingParts.push(`w:before="${para.spacing.before}"`);
      }
      if (para.spacing.after !== undefined) {
        spacingParts.push(`w:after="${para.spacing.after}"`);
      }
      if (spacingParts.length > 0) {
        parts.push(`<w:spacing ${spacingParts.join(' ')}/>`);
      }
    }

    // Borders
    if (para.borderLeft || para.borderBox || para.borderTopBottom) {
      const borderParts: string[] = [];
      if (para.borderBox) {
        borderParts.push(
          `<w:top w:val="single" w:sz="${para.borderBox.size}" w:space="4" w:color="${para.borderBox.color}"/>`
        );
        borderParts.push(
          `<w:left w:val="single" w:sz="${para.borderBox.size}" w:space="4" w:color="${para.borderBox.color}"/>`
        );
        borderParts.push(
          `<w:bottom w:val="single" w:sz="${para.borderBox.size}" w:space="4" w:color="${para.borderBox.color}"/>`
        );
        borderParts.push(
          `<w:right w:val="single" w:sz="${para.borderBox.size}" w:space="4" w:color="${para.borderBox.color}"/>`
        );
      } else if (para.borderLeft) {
        borderParts.push(
          `<w:left w:val="single" w:sz="${para.borderLeft.size}" w:space="4" w:color="${para.borderLeft.color}"/>`
        );
      } else if (para.borderTopBottom) {
        borderParts.push(
          `<w:top w:val="single" w:sz="${para.borderTopBottom.size}" w:space="1" w:color="${para.borderTopBottom.color}"/>`
        );
        borderParts.push(
          `<w:bottom w:val="single" w:sz="${para.borderTopBottom.size}" w:space="1" w:color="${para.borderTopBottom.color}"/>`
        );
      }
      if (borderParts.length > 0) {
        parts.push(`<w:pBdr>${borderParts.join('')}</w:pBdr>`);
      }
    }

    // Shading (background color)
    if (para.shading) {
      parts.push(`<w:shd w:val="clear" w:color="auto" w:fill="${para.shading}"/>`);
    }

    // Indentation
    if (para.indent) {
      // For callouts with right indent too, use both left and right
      if (para.shading) {
        parts.push(`<w:ind w:left="${para.indent}" w:right="${para.indent}"/>`);
      } else {
        parts.push(`<w:ind w:left="${para.indent}"/>`);
      }
    }

    // Numbering for lists
    if (para.numbering) {
      parts.push(
        `<w:numPr><w:ilvl w:val="${para.numbering.level}"/><w:numId w:val="${para.numbering.id}"/></w:numPr>`
      );
    }

    if (parts.length === 0) return '';
    return `<w:pPr>${parts.join('')}</w:pPr>`;
  }

  /**
   * Convert a text run to OOXML
   * @param run - The text run to convert
   * @param paragraphStyle - Parent paragraph style for direct formatting fallback
   */
  private runToOoxml(run: TextRun, paragraphStyle?: string): string {
    // Handle footnote reference - generates actual Word footnote
    if (run.footnoteId !== undefined) {
      return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${run.footnoteId}"/></w:r>`;
    }

    const rPr = this.buildRunProperties(run, paragraphStyle);
    const escapedText = this.escapeXml(run.text);

    // Handle text with spaces at beginning/end
    const needsPreserve = run.text.startsWith(' ') || run.text.endsWith(' ');
    const xmlSpace = needsPreserve ? ' xml:space="preserve"' : '';

    return `<w:r>${rPr}<w:t${xmlSpace}>${escapedText}</w:t></w:r>`;
  }

  /**
   * Build run properties XML
   * Includes direct formatting fallback for headings/titles to ensure rendering
   * even when styles don't exist in the target document.
   * @param run - The text run
   * @param paragraphStyle - Parent paragraph style for direct formatting
   */
  private buildRunProperties(run: TextRun, paragraphStyle?: string): string {
    const parts: string[] = [];

    // Run style (e.g., FootnoteReference, PartyLabel)
    if (run.style) {
      parts.push(`<w:rStyle w:val="${this.escapeXml(run.style)}"/>`);
    }

    // Direct formatting fallback based on paragraph style
    // Font sizes in half-points (24 = 12pt, 28 = 14pt, 32 = 16pt, 56 = 28pt)
    const styleFormatting = this.getStyleFormatting(paragraphStyle);

    // Bold - from run or from style
    if (run.bold || styleFormatting.bold) {
      parts.push('<w:b/>');
    }

    // Italic - from run or from style
    if (run.italic || styleFormatting.italic) {
      parts.push('<w:i/>');
    }

    // Underline
    if (run.underline) {
      parts.push('<w:u w:val="single"/>');
    }

    // Small caps
    if (run.smallCaps) {
      parts.push('<w:smallCaps/>');
    }

    // Strikethrough
    if (run.strikethrough) {
      parts.push('<w:strike/>');
    }

    // Highlight
    if (run.highlight) {
      parts.push(`<w:highlight w:val="${run.highlight}"/>`);
    }

    // Font size (half-points)
    if (styleFormatting.fontSize) {
      parts.push(`<w:sz w:val="${styleFormatting.fontSize}"/>`);
      parts.push(`<w:szCs w:val="${styleFormatting.fontSize}"/>`);
    }

    // Color
    if (styleFormatting.color) {
      parts.push(`<w:color w:val="${styleFormatting.color}"/>`);
    }

    if (parts.length === 0) return '';
    return `<w:rPr>${parts.join('')}</w:rPr>`;
  }

  /**
   * Get direct formatting for a paragraph style
   * This provides fallback formatting when styles don't exist.
   * Values are synced with Bojin-Master-Template.docx styles.
   */
  private getStyleFormatting(style?: string): {
    bold?: boolean;
    italic?: boolean;
    fontSize?: number;
    color?: string;
  } {
    if (!style) return {};

    // Font sizes in half-points (24 = 12pt)
    // Colors and sizes match Bojin-Master-Template.docx
    switch (style) {
      // Built-in styles
      case 'Title':
        return { fontSize: 52, color: '333333' }; // 26pt
      case 'Subtitle':
        return { fontSize: 26, color: '666666' }; // 13pt
      case 'Heading1':
        return { fontSize: 36, color: '9B2335' }; // 18pt, Bojin brand red
      case 'Heading2':
        return { fontSize: 28, color: '333333' }; // 14pt
      case 'Heading3':
        return { fontSize: 24, color: '666666' }; // 12pt
      case 'Quote':
        return { italic: true, color: '4A4A4A' };
      // Custom legal styles
      case 'DateLocation':
        return { color: '4A4A4A' }; // Right-aligned in template
      case 'PartyDefinition':
        return {}; // Inherits normal, justified
      case 'PartyLabel':
        return { bold: true, color: '9B2335' }; // Bojin brand red
      case 'ArticleNumber':
        return { bold: true, fontSize: 24, color: '333333' }; // 12pt bold
      case 'Citation':
        return { italic: true, fontSize: 20, color: '4A4A4A' }; // 10pt italic
      case 'SignatureBlock':
        return { bold: true, fontSize: 20, color: '333333' }; // 10pt bold, centered
      case 'Conclusion':
        return { color: '333333' };
      default:
        return {};
    }
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
export const ooxmlFragmentService = new OoxmlFragmentService();
