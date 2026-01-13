/**
 * DOCX Generator Service
 * OPS-256: AI Document Generation - Create .docx Files in SharePoint
 *
 * Converts markdown/HTML content to .docx format using the docx npm package.
 * Supports legal document formatting including headers, paragraphs, lists,
 * bold/italic text, and section breaks.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  TableOfContents,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx';
import logger from '../utils/logger';
import { ooxmlFragmentService } from './ooxml-fragment.service';

// ============================================================================
// Types
// ============================================================================

export interface DocxMetadata {
  title: string;
  author?: string;
  subject?: string;
  description?: string;
  creator?: string;
  lastModifiedBy?: string;
  revision?: number;
  createdAt?: Date;
}

export interface DocxGeneratorOptions {
  /** Include table of contents */
  includeToC?: boolean;
  /** Include page numbers in footer */
  includePageNumbers?: boolean;
  /** Header text (firm name) */
  headerText?: string;
  /** Footer text */
  footerText?: string;
}

// ============================================================================
// Service
// ============================================================================

export class DocxGeneratorService {
  /**
   * Convert markdown content to .docx Buffer
   *
   * Supports:
   * - # to ###### headings
   * - **bold** and *italic*
   * - Numbered lists (1. 2. 3.)
   * - Bullet lists (- or *)
   * - Paragraphs separated by blank lines
   * - Horizontal rules (---)
   */
  async markdownToDocx(
    markdownContent: string,
    metadata: DocxMetadata,
    options: DocxGeneratorOptions = {}
  ): Promise<Buffer> {
    const { includePageNumbers = true, headerText, footerText } = options;

    const sections = this.parseMarkdown(markdownContent);

    // Build document children
    const children: Paragraph[] = [];

    for (const section of sections) {
      if (section.type === 'heading') {
        children.push(this.createHeading(section.text!, section.level!));
      } else if (section.type === 'paragraph') {
        children.push(this.createParagraph(section.text!));
      } else if (section.type === 'list-item') {
        children.push(
          this.createListItem(section.text!, section.ordered ?? false, section.listIndent ?? 0)
        );
      } else if (section.type === 'horizontal-rule') {
        children.push(this.createHorizontalRule());
      }
    }

    // Build document
    const doc = new Document({
      creator: metadata.creator || 'Legal Platform',
      title: metadata.title,
      subject: metadata.subject,
      description: metadata.description,
      lastModifiedBy: metadata.lastModifiedBy,
      revision: metadata.revision || 1,
      sections: [
        {
          properties: {},
          headers: headerText
            ? {
                default: new Header({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: headerText,
                          size: 18, // 9pt
                          color: '666666',
                        }),
                      ],
                      alignment: AlignmentType.RIGHT,
                    }),
                  ],
                }),
              }
            : undefined,
          footers:
            includePageNumbers || footerText
              ? {
                  default: new Footer({
                    children: [
                      new Paragraph({
                        children: [
                          ...(footerText
                            ? [
                                new TextRun({
                                  text: footerText,
                                  size: 18, // 9pt
                                  color: '666666',
                                }),
                                new TextRun({ text: '    ' }),
                              ]
                            : []),
                          ...(includePageNumbers
                            ? [
                                new TextRun({
                                  children: [PageNumber.CURRENT],
                                  size: 18,
                                  color: '666666',
                                }),
                                new TextRun({
                                  text: ' / ',
                                  size: 18,
                                  color: '666666',
                                }),
                                new TextRun({
                                  children: [PageNumber.TOTAL_PAGES],
                                  size: 18,
                                  color: '666666',
                                }),
                              ]
                            : []),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                }
              : undefined,
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    logger.info('DOCX generated successfully', {
      title: metadata.title,
      paragraphCount: sections.filter((s) => s.type === 'paragraph').length,
      headingCount: sections.filter((s) => s.type === 'heading').length,
      bufferSize: buffer.length,
    });

    return buffer;
  }

  /**
   * Convert HTML content to .docx Buffer
   * Basic HTML support for AI-generated content
   */
  async htmlToDocx(
    htmlContent: string,
    metadata: DocxMetadata,
    options: DocxGeneratorOptions = {}
  ): Promise<Buffer> {
    // Convert HTML to markdown-like format for processing
    const markdown = this.htmlToMarkdown(htmlContent);
    return this.markdownToDocx(markdown, metadata, options);
  }

  /**
   * Convert extended markdown to OOXML fragment for Word insertion
   *
   * Generates an OOXML fragment that references Word's built-in styles
   * (Title, Heading1, Normal, etc.) and custom legal styles. When inserted
   * via Word's insertOoxml() API, content inherits the document's formatting.
   *
   * Supports 18 element types:
   * - Built-in (11): Title, Subtitle, Heading1-3, Normal, Quote, ListParagraph, FootnoteText, Indent L1/L2
   * - Custom Legal (7): DateLocation, PartyDefinition, PartyLabel, ArticleNumber, SignatureBlock, Citation, Conclusion
   *
   * @param markdown Extended markdown content
   * @returns OOXML fragment string for Word's insertOoxml() API
   */
  markdownToOoxmlFragment(markdown: string): string {
    logger.debug('Converting markdown to OOXML fragment', {
      inputLength: markdown.length,
    });

    const ooxml = ooxmlFragmentService.markdownToOoxmlFragment(markdown);

    logger.debug('OOXML fragment generated', {
      outputLength: ooxml.length,
    });

    return ooxml;
  }

  // ============================================================================
  // Private Methods - Markdown Parsing
  // ============================================================================

  private parseMarkdown(content: string): ParsedSection[] {
    const lines = content.split('\n');
    const sections: ParsedSection[] = [];

    let currentParagraph = '';
    let inList = false;
    let listOrdered = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Empty line - end paragraph
      if (!trimmedLine) {
        if (currentParagraph) {
          sections.push({ type: 'paragraph', text: currentParagraph.trim() });
          currentParagraph = '';
        }
        inList = false;
        continue;
      }

      // Horizontal rule
      if (/^[-*_]{3,}$/.test(trimmedLine)) {
        if (currentParagraph) {
          sections.push({ type: 'paragraph', text: currentParagraph.trim() });
          currentParagraph = '';
        }
        sections.push({ type: 'horizontal-rule' });
        continue;
      }

      // Heading
      const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        if (currentParagraph) {
          sections.push({ type: 'paragraph', text: currentParagraph.trim() });
          currentParagraph = '';
        }
        sections.push({
          type: 'heading',
          level: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
          text: headingMatch[2],
        });
        continue;
      }

      // Ordered list item (1. 2. 3. etc)
      const orderedListMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
      if (orderedListMatch) {
        if (currentParagraph) {
          sections.push({ type: 'paragraph', text: currentParagraph.trim() });
          currentParagraph = '';
        }
        sections.push({
          type: 'list-item',
          text: orderedListMatch[2],
          ordered: true,
          listIndent: 0,
        });
        inList = true;
        listOrdered = true;
        continue;
      }

      // Unordered list item (- or *)
      const unorderedListMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
      if (unorderedListMatch) {
        if (currentParagraph) {
          sections.push({ type: 'paragraph', text: currentParagraph.trim() });
          currentParagraph = '';
        }
        sections.push({
          type: 'list-item',
          text: unorderedListMatch[1],
          ordered: false,
          listIndent: 0,
        });
        inList = true;
        listOrdered = false;
        continue;
      }

      // Regular text - accumulate into paragraph
      if (currentParagraph) {
        currentParagraph += ' ' + trimmedLine;
      } else {
        currentParagraph = trimmedLine;
      }
    }

    // Don't forget the last paragraph
    if (currentParagraph) {
      sections.push({ type: 'paragraph', text: currentParagraph.trim() });
    }

    return sections;
  }

  // ============================================================================
  // Private Methods - DOCX Element Creation
  // ============================================================================

  private createHeading(text: string, level: 1 | 2 | 3 | 4 | 5 | 6): Paragraph {
    const headingLevelMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6,
    };

    return new Paragraph({
      children: this.parseInlineFormatting(text),
      heading: headingLevelMap[level],
      spacing: { before: 240, after: 120 },
    });
  }

  private createParagraph(text: string): Paragraph {
    return new Paragraph({
      children: this.parseInlineFormatting(text),
      spacing: { before: 120, after: 120 },
      alignment: AlignmentType.JUSTIFIED,
    });
  }

  private createListItem(text: string, ordered: boolean, listIndent: number = 0): Paragraph {
    // Create bullet or number prefix
    const prefix = ordered ? '' : '• ';
    const indentBase = 720; // 0.5 inch base indent
    const indentPerLevel = 360; // 0.25 inch per nesting level

    return new Paragraph({
      children: [new TextRun({ text: prefix }), ...this.parseInlineFormatting(text)],
      indent: { left: indentBase + listIndent * indentPerLevel, hanging: 360 },
      spacing: { before: 60, after: 60 },
    });
  }

  private createHorizontalRule(): Paragraph {
    return new Paragraph({
      border: {
        bottom: {
          color: 'CCCCCC',
          size: 6,
          style: BorderStyle.SINGLE,
        },
      },
      spacing: { before: 240, after: 240 },
    });
  }

  /**
   * Parse inline formatting (**bold**, *italic*, ***both***)
   */
  private parseInlineFormatting(text: string): TextRun[] {
    const runs: TextRun[] = [];

    // Pattern to match **bold**, *italic*, or ***both***
    const pattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0];

      if (match[2]) {
        // ***bold italic***
        runs.push(new TextRun({ text: match[2], bold: true, italics: true }));
      } else if (match[3]) {
        // **bold**
        runs.push(new TextRun({ text: match[3], bold: true }));
      } else if (match[4]) {
        // *italic*
        runs.push(new TextRun({ text: match[4], italics: true }));
      } else if (match[5]) {
        // Plain text
        runs.push(new TextRun({ text: match[5] }));
      }
    }

    // If no matches, return plain text
    if (runs.length === 0) {
      runs.push(new TextRun({ text }));
    }

    return runs;
  }

  /**
   * Convert basic HTML to markdown for processing
   */
  private htmlToMarkdown(html: string): string {
    let md = html;

    // Remove HTML comments
    md = md.replace(/<!--[\s\S]*?-->/g, '');

    // Headers
    md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
    md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
    md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');
    md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n');
    md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n');

    // Formatting
    md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
    md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

    // Lists
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
    md = md.replace(/<\/?[ou]l[^>]*>/gi, '\n');

    // Paragraphs and breaks
    md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

    // Remove remaining tags
    md = md.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&quot;/g, '"');
    md = md.replace(/&#39;/g, "'");

    // Clean up whitespace
    md = md.replace(/\n{3,}/g, '\n\n');
    md = md.trim();

    return md;
  }
}

// ============================================================================
// Types (internal)
// ============================================================================

interface ParsedSection {
  type: 'heading' | 'paragraph' | 'list-item' | 'horizontal-rule';
  text?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  ordered?: boolean;
  listIndent?: number; // 0-based indent level for list items
}

// Export singleton instance
export const docxGeneratorService = new DocxGeneratorService();
