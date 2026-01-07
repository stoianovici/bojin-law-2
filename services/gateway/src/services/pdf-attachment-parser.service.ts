/**
 * PDF Attachment Parser Service
 * Task 4.2: Create PDF attachment parser service
 *
 * Extracts text content and court file numbers from PDF email attachments.
 * Uses pdf-parse for text extraction and reference-extractor for identifying
 * Romanian legal reference numbers.
 *
 * Features:
 * - Text extraction from PDF buffers
 * - Court file number extraction (e.g., "1234/3/2024")
 * - Timeout protection (30 seconds)
 * - Size limit enforcement (50MB)
 * - Graceful error handling
 */

import logger from '../utils/logger';
import { extractCourtFileNumbers } from '../utils/reference-extractor';

// ============================================================================
// Types
// ============================================================================

// pdf-parse type - using dynamic import for optional dependency
type PdfParseResult = {
  numpages: number;
  numrender: number;
  info: Record<string, unknown>;
  metadata: unknown;
  text: string;
  version: string;
};

type PdfParseModule = (buffer: Buffer) => Promise<PdfParseResult>;

// ============================================================================
// Constants
// ============================================================================

/** Maximum PDF file size (50MB) */
const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024;

/** Timeout for PDF parsing operations (30 seconds) */
const PDF_PARSE_TIMEOUT_MS = 30 * 1000;

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * PDF Attachment Parser Service
 *
 * Provides methods to extract text and court file numbers from PDF attachments.
 * Designed for use with email attachment processing.
 */
export class PdfAttachmentParserService {
  private pdfParse: PdfParseModule | null = null;

  /**
   * Lazily load pdf-parse module
   * This allows graceful degradation if pdf-parse is not installed
   */
  private async getPdfParse(): Promise<PdfParseModule | null> {
    if (this.pdfParse) return this.pdfParse;

    try {
      // Dynamic import of pdf-parse
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParseModule = require('pdf-parse');
      this.pdfParse = pdfParseModule as PdfParseModule;
      return this.pdfParse;
    } catch (error) {
      logger.warn('pdf-parse library not available, PDF text extraction disabled', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Extract text content from a PDF buffer
   *
   * @param buffer - PDF file buffer
   * @returns Extracted text content, or empty string on failure
   *
   * @example
   * ```typescript
   * const text = await pdfParser.extractText(pdfBuffer);
   * console.log(text); // "This is the PDF content..."
   * ```
   */
  async extractText(buffer: Buffer): Promise<string> {
    // Validate buffer
    if (!buffer || buffer.length === 0) {
      logger.debug('Empty buffer provided for PDF extraction');
      return '';
    }

    // Check size limit
    if (buffer.length > MAX_PDF_SIZE_BYTES) {
      logger.warn('PDF exceeds size limit', {
        size: buffer.length,
        limit: MAX_PDF_SIZE_BYTES,
        sizeMB: (buffer.length / (1024 * 1024)).toFixed(2),
        limitMB: (MAX_PDF_SIZE_BYTES / (1024 * 1024)).toFixed(2),
      });
      return '';
    }

    // Get pdf-parse module
    const pdfParse = await this.getPdfParse();
    if (!pdfParse) {
      logger.warn('PDF parsing unavailable - pdf-parse not loaded');
      return '';
    }

    try {
      // Parse with timeout protection
      const text = await this.parseWithTimeout(buffer, pdfParse);

      logger.debug('PDF text extracted', {
        textLength: text.length,
        bufferSize: buffer.length,
      });

      return text;
    } catch (error) {
      logger.error('Failed to extract text from PDF', {
        error: error instanceof Error ? error.message : 'Unknown error',
        bufferSize: buffer.length,
      });
      return '';
    }
  }

  /**
   * Extract court file numbers from a PDF buffer
   *
   * Uses reference-extractor to identify Romanian court file numbers
   * in formats like "1234/3/2024" or "dosar nr. 1234/3/2024"
   *
   * @param buffer - PDF file buffer
   * @returns Array of normalized court file numbers (e.g., ["1234/3/2024"])
   *
   * @example
   * ```typescript
   * const courtFiles = await pdfParser.extractCourtFileNumbers(pdfBuffer);
   * console.log(courtFiles); // ["1234/3/2024", "5678/2/2023"]
   * ```
   */
  async extractCourtFileNumbers(buffer: Buffer): Promise<string[]> {
    // First extract the text
    const text = await this.extractText(buffer);

    if (!text) {
      return [];
    }

    try {
      // Use reference-extractor to find court file numbers
      const courtFileNumbers = extractCourtFileNumbers(text);

      logger.debug('Court file numbers extracted from PDF', {
        count: courtFileNumbers.length,
        numbers: courtFileNumbers,
      });

      return courtFileNumbers;
    } catch (error) {
      logger.error('Failed to extract court file numbers from PDF', {
        error: error instanceof Error ? error.message : 'Unknown error',
        textLength: text.length,
      });
      return [];
    }
  }

  /**
   * Parse PDF with timeout protection
   *
   * @param buffer - PDF buffer to parse
   * @param pdfParse - pdf-parse module
   * @returns Extracted text
   */
  private async parseWithTimeout(buffer: Buffer, pdfParse: PdfParseModule): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`PDF parsing timed out after ${PDF_PARSE_TIMEOUT_MS / 1000} seconds`));
      }, PDF_PARSE_TIMEOUT_MS);

      pdfParse(buffer)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result.text || '');
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Check if a buffer appears to be a valid PDF
   *
   * @param buffer - File buffer to check
   * @returns True if buffer starts with PDF magic bytes
   */
  isPdf(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 4) {
      return false;
    }

    // Check for PDF magic bytes: %PDF
    return (
      buffer[0] === 0x25 && // %
      buffer[1] === 0x50 && // P
      buffer[2] === 0x44 && // D
      buffer[3] === 0x46 // F
    );
  }

  /**
   * Get service configuration
   *
   * @returns Current configuration values
   */
  getConfig(): { maxSizeBytes: number; timeoutMs: number } {
    return {
      maxSizeBytes: MAX_PDF_SIZE_BYTES,
      timeoutMs: PDF_PARSE_TIMEOUT_MS,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Singleton instance of PdfAttachmentParserService */
export const pdfAttachmentParserService = new PdfAttachmentParserService();
