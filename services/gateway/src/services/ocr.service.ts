/**
 * OCR Service
 * Extracts text from scanned documents and images using Claude Vision API.
 *
 * Used as a fallback when standard text extraction fails (scanned PDFs, photos).
 */

import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger';
import { aiClient, type AICallOptions } from './ai-client.service';

// ============================================================================
// Configuration
// ============================================================================

// Maximum pages to process per document (cost control)
const MAX_PAGES = 20;

// Model for OCR - Haiku is cost-effective and handles OCR well
const OCR_MODEL = 'claude-haiku-4-5-20251001';

// Maximum content length (same as content-extraction.service.ts)
const MAX_CONTENT_LENGTH = 500 * 1024;

// Supported image MIME types
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// ============================================================================
// Types
// ============================================================================

export interface OCRResult {
  success: boolean;
  content: string;
  error?: string;
  pageCount: number;
  truncated: boolean;
}

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

// ============================================================================
// OCR Prompt
// ============================================================================

const OCR_SYSTEM_PROMPT = `Ești un expert în extragerea textului din documente scanate și fotografii.

TASK: Extrage TODO textul vizibil din imagine(i), păstrând structura originală.

REGULI:
- Extrage textul EXACT cum apare, fără interpretare sau rezumare
- Păstrează formatarea: paragrafe, liste, tabele (ca text)
- Pentru tabele, folosește | pentru separare coloane
- Include antetele, subsolurile, ștampilele, semnăturile (ca [Semnătură], [Ștampilă])
- Pentru text ilizibil, marchează cu [ilizibil]
- Pentru mai multe pagini, separă cu --- Pagina N ---
- NU adăuga comentarii sau explicații
- Limba textului este de obicei română, dar poate fi și altă limbă

OUTPUT: Doar textul extras, nimic altceva.`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert PDF buffer to array of PNG images using pdf-to-img
 */
async function pdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  // Dynamic import for pdf-to-img (ESM module)
  const { pdf } = await import('pdf-to-img');

  const images: Buffer[] = [];
  let pageNum = 0;

  // pdf-to-img returns a Promise<AsyncIterable> - need to await first, then iterate
  const pdfDocument = await pdf(pdfBuffer, { scale: 2.0 });

  for await (const image of pdfDocument) {
    pageNum++;
    if (pageNum > MAX_PAGES) {
      logger.warn('[OCR] Reached max page limit', { maxPages: MAX_PAGES, totalPages: 'unknown' });
      break;
    }
    images.push(image);
  }

  return images;
}

/**
 * Check if a MIME type is a supported image format
 */
export function isImageFormat(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

/**
 * Check if a MIME type is PDF
 */
export function isPdfFormat(mimeType: string): boolean {
  return mimeType.toLowerCase() === 'application/pdf';
}

/**
 * Truncate content to max length with indicator
 */
function truncateContent(content: string): { text: string; truncated: boolean } {
  if (content.length <= MAX_CONTENT_LENGTH) {
    return { text: content, truncated: false };
  }
  return {
    text: content.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... conținut trunchiat la 500KB ...]',
    truncated: true,
  };
}

// ============================================================================
// Main OCR Function
// ============================================================================

/**
 * Extract text from a scanned document or image using Claude Vision.
 *
 * @param buffer - The file buffer (PDF or image)
 * @param mimeType - MIME type of the file
 * @param fileName - Original file name (for logging)
 * @param aiOptions - AI call options for usage tracking
 * @returns OCR result with extracted text
 */
export async function extractWithOCR(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  aiOptions: AICallOptions
): Promise<OCRResult> {
  const startTime = Date.now();

  logger.info('[OCR] Starting OCR extraction', {
    fileName,
    mimeType,
    bufferSize: buffer.length,
  });

  try {
    let images: Buffer[];
    let imageMediaType: ImageMediaType;

    // Convert to images based on file type
    if (isPdfFormat(mimeType)) {
      // Convert PDF pages to PNG images
      images = await pdfToImages(buffer);
      imageMediaType = 'image/png';

      if (images.length === 0) {
        return {
          success: false,
          content: '',
          error: 'Nu s-au putut extrage pagini din PDF',
          pageCount: 0,
          truncated: false,
        };
      }

      logger.info('[OCR] PDF converted to images', {
        fileName,
        pageCount: images.length,
      });
    } else if (isImageFormat(mimeType)) {
      // Single image - use directly
      images = [buffer];
      imageMediaType = mimeType.toLowerCase() as ImageMediaType;
    } else {
      return {
        success: false,
        content: '',
        error: `Format nesuportat pentru OCR: ${mimeType}`,
        pageCount: 0,
        truncated: false,
      };
    }

    // Build message content with all images
    const imageBlocks: Anthropic.ImageBlockParam[] = images.map((img, index) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: imageMediaType,
        data: img.toString('base64'),
      },
    }));

    // Add text prompt after images
    const contentBlocks: Anthropic.ContentBlockParam[] = [
      ...imageBlocks,
      {
        type: 'text' as const,
        text:
          images.length > 1
            ? `Extrage textul din toate cele ${images.length} pagini ale documentului.`
            : 'Extrage textul din acest document.',
      },
    ];

    // Call Claude Vision
    const response = await aiClient.chat(
      [{ role: 'user', content: contentBlocks }],
      {
        ...aiOptions,
        feature: 'ocr_extraction',
        entityType: 'document',
      },
      {
        model: OCR_MODEL,
        system: OCR_SYSTEM_PROMPT,
        maxTokens: 16000, // Allow long documents
        temperature: 0, // Deterministic extraction
      }
    );

    // Extract text from response
    const extractedText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    if (!extractedText || extractedText.trim().length === 0) {
      return {
        success: false,
        content: '',
        error: 'Nu s-a putut extrage text din document',
        pageCount: images.length,
        truncated: false,
      };
    }

    // Clean up and truncate
    const cleanedText = extractedText.trim().replace(/\n{3,}/g, '\n\n');
    const { text, truncated } = truncateContent(cleanedText);

    const durationMs = Date.now() - startTime;

    logger.info('[OCR] Extraction successful', {
      fileName,
      pageCount: images.length,
      contentLength: text.length,
      truncated,
      durationMs,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costEur: response.costEur,
    });

    return {
      success: true,
      content: text,
      pageCount: images.length,
      truncated,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const durationMs = Date.now() - startTime;

    logger.error('[OCR] Extraction failed', {
      fileName,
      mimeType,
      error: errorMessage,
      durationMs,
    });

    return {
      success: false,
      content: '',
      error: errorMessage,
      pageCount: 0,
      truncated: false,
    };
  }
}

// ============================================================================
// Export
// ============================================================================

export const ocrService = {
  extractWithOCR,
  isImageFormat,
  isPdfFormat,
};
