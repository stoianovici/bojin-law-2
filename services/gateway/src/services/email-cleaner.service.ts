/**
 * Email Cleaner Service
 * OPS-090: Email Content Cleaning for Readability
 *
 * Uses Claude Haiku to extract "new content only" from email bodies,
 * removing signatures, quoted replies, and forward headers.
 *
 * Cost estimate: ~$0.15-0.30/week at 200 emails/week
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// Types
// ============================================================================

export interface CleanEmailResult {
  cleanContent: string;
  success: boolean;
  tokensUsed?: {
    input: number;
    output: number;
  };
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const EXTRACTION_PROMPT = `Extract only the new message content from this email. Remove:
- Email signatures (contact info, disclaimers, "Sent from iPhone", "Trimis de pe iPhone", etc.)
- Quoted replies (text after "On X wrote:", "De la:", "La data de...", or similar patterns)
- Forwarded message headers ("---------- Forwarded message ----------", "---------- Mesaj redirecționat ----------")
- Reply header blocks (From:/Sent:/To:/Subject: or De la:/Trimis:/Către:/Subiect:)
- Automatic replies ("This is an automatic reply", "Răspuns automat")

Return ONLY the actual new message text in plain text format (no HTML tags).

CRITICAL - WHITESPACE FORMATTING:
- Preserve ALL paragraph breaks as DOUBLE newlines (blank line between paragraphs)
- Preserve single line breaks within addresses, lists, or structured content
- Do NOT collapse multiple paragraphs into a single block of text
- Each distinct paragraph/thought should be separated by a blank line

IMPORTANT: Răspunde DOAR în limba română. NU include explicații, raționamente sau comentarii în engleză.
Returnează DOAR textul extras, fără meta-comentarii.

If the email is entirely quoted/forwarded with no new content, return "[Mesaj redirecționat fără conținut nou]".
If the email contains only an attachment notice with no text, return "[Doar atașament]".
If the email is a newsletter or informative bulletin with no personal message, return "[Newsletter informativ]".
If you cannot extract meaningful content, return the original text cleaned of HTML.`;

// ============================================================================
// Service
// ============================================================================

export class EmailCleanerService {
  private anthropic: Anthropic | null = null;

  constructor() {
    // Lazy init - only create client when needed
  }

  private getClient(): Anthropic {
    if (!this.anthropic) {
      this.anthropic = new Anthropic();
    }
    return this.anthropic;
  }

  /**
   * Extract clean content from an email body.
   * Removes signatures, quoted replies, and forward headers.
   *
   * @param bodyContent - The raw email body content
   * @param bodyContentType - 'html' or 'text'
   * @returns Cleaned plain text content
   */
  async extractCleanContent(
    bodyContent: string,
    bodyContentType: string
  ): Promise<CleanEmailResult> {
    try {
      // Skip if content is too short or empty
      if (!bodyContent || bodyContent.trim().length < 10) {
        return {
          cleanContent: bodyContent || '',
          success: true,
        };
      }

      // For very short emails (likely just a few words), skip AI processing
      const strippedLength = this.stripHtml(bodyContent).trim().length;
      if (strippedLength < 50) {
        return {
          cleanContent: this.stripHtml(bodyContent).trim(),
          success: true,
        };
      }

      // Prepare content for extraction
      const contentToProcess =
        bodyContentType === 'html' ? this.preprocessHtml(bodyContent) : bodyContent;

      // Call Claude Haiku for extraction
      const client = this.getClient();
      const response = await client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `${EXTRACTION_PROMPT}\n\n---\n\nEmail content:\n\n${contentToProcess}`,
          },
        ],
      });

      // Extract text from response
      const textBlock = response.content.find((block) => block.type === 'text');
      const cleanContent = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

      return {
        cleanContent: cleanContent || this.stripHtml(bodyContent).trim(),
        success: true,
        tokensUsed: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      };
    } catch (error) {
      console.error('[EmailCleanerService] Error extracting clean content:', error);

      // Fallback to basic HTML stripping on error
      return {
        cleanContent: this.stripHtml(bodyContent).trim(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Preprocess HTML content before sending to Claude.
   * Simplifies HTML to reduce token usage while preserving structure.
   */
  private preprocessHtml(html: string): string {
    let processed = html;

    // Remove style and script tags with their content
    processed = processed.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    processed = processed.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Remove HTML comments
    processed = processed.replace(/<!--[\s\S]*?-->/g, '');

    // Replace common block elements with newlines
    processed = processed.replace(/<\/?(div|p|br|hr|tr|li|h[1-6])[^>]*>/gi, '\n');

    // Remove remaining HTML tags
    processed = processed.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    processed = this.decodeHtmlEntities(processed);

    // Normalize whitespace
    processed = processed.replace(/\n\s*\n/g, '\n\n');
    processed = processed.replace(/[ \t]+/g, ' ');

    return processed.trim();
  }

  /**
   * Simple HTML stripping for fallback.
   */
  private stripHtml(html: string): string {
    let text = html;

    // Remove style and script tags
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Replace block elements with newlines
    text = text.replace(/<\/?(div|p|br|hr|tr|li|h[1-6])[^>]*>/gi, '\n');

    // Remove all other tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = this.decodeHtmlEntities(text);

    // Normalize whitespace
    text = text.replace(/\n\s*\n/g, '\n\n');
    text = text.replace(/[ \t]+/g, ' ');

    return text.trim();
  }

  /**
   * Decode common HTML entities.
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&ndash;': '–',
      '&mdash;': '—',
      '&lsquo;': '\u2018',
      '&rsquo;': '\u2019',
      '&ldquo;': '\u201c',
      '&rdquo;': '\u201d',
      '&hellip;': '…',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™',
    };

    let decoded = text;
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'gi'), char);
    }

    // Decode numeric entities
    decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
    decoded = decoded.replace(/&#x([a-fA-F0-9]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

    return decoded;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const emailCleanerService = new EmailCleanerService();
