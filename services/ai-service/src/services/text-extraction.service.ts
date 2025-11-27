/**
 * Text Extraction Service
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 *
 * Extracts text from PDF and DOCX files for AI training
 */

import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { franc } from 'franc';
import type { ExtractTextInput, ExtractTextOutput } from '@legal-platform/types';
import logger from '../lib/logger';

/**
 * Text Extraction Service Class
 * Handles extraction of text from PDF and Word documents
 */
export class TextExtractionService {
  /**
   * Extract text from document
   * @param input - Extraction input with file buffer and metadata
   * @param fileBuffer - File content as Buffer
   * @returns Extracted text with metadata
   */
  async extractText(
    input: ExtractTextInput,
    fileBuffer: Buffer
  ): Promise<ExtractTextOutput> {
    const startTime = Date.now();

    try {
      let text: string;

      // Extract based on file type
      if (input.fileType === 'pdf') {
        text = await this.extractFromPDF(fileBuffer);
      } else if (input.fileType === 'docx' || input.fileType === 'doc') {
        text = await this.extractFromDOCX(fileBuffer);
      } else {
        throw new Error(`Unsupported file type: ${input.fileType}`);
      }

      // Clean extracted text
      const cleanedText = this.cleanText(text);

      // Detect language
      const language = this.detectLanguage(cleanedText);

      // Count words
      const wordCount = this.countWords(cleanedText);

      const duration = Date.now() - startTime;

      logger.info('Text extracted successfully', {
        fileName: input.fileName,
        fileType: input.fileType,
        wordCount,
        language,
        durationMs: duration,
      });

      return {
        text: cleanedText,
        wordCount,
        language,
        extractionDurationMs: duration,
      };
    } catch (error) {
      logger.error('Text extraction failed', {
        fileName: input.fileName,
        fileType: input.fileType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Extract text from PDF file
   * @param buffer - PDF file buffer
   * @returns Extracted text
   */
  private async extractFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await (pdfParse as any)(buffer);
      return data.text;
    } catch (error) {
      logger.error('PDF extraction failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * Extract text from DOCX file
   * @param buffer - DOCX file buffer
   * @returns Extracted text
   */
  private async extractFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      logger.error('DOCX extraction failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to extract text from DOCX');
    }
  }

  /**
   * Clean extracted text
   * Removes extra whitespace and normalizes encoding
   * @param text - Raw extracted text
   * @returns Cleaned text
   */
  private cleanText(text: string): string {
    return text
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove control characters except newlines and tabs
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize quotes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // Trim
      .trim();
  }

  /**
   * Detect document language
   * Uses franc library for language detection
   * @param text - Document text
   * @returns Language code ('ro' or 'en')
   */
  private detectLanguage(text: string): 'ro' | 'en' {
    try {
      // Use first 500 characters for language detection
      const sample = text.substring(0, 500);
      const detectedLang = franc(sample);

      // Map franc codes to our language codes
      if (detectedLang === 'ron') return 'ro';
      if (detectedLang === 'eng') return 'en';

      // Default to Romanian if uncertain
      logger.warn('Language detection uncertain, defaulting to Romanian', {
        detectedLang,
      });
      return 'ro';
    } catch (error) {
      logger.error('Language detection failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 'ro'; // Default to Romanian
    }
  }

  /**
   * Count words in text
   * @param text - Document text
   * @returns Word count
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Validate file can be processed
   * @param fileType - File extension
   * @param fileSize - File size in bytes
   * @returns True if valid
   */
  validateFile(fileType: string, fileSize: number): boolean {
    const supportedTypes = new Set(['pdf', 'docx', 'doc']);
    const maxSize = 100 * 1024 * 1024; // 100MB

    if (!supportedTypes.has(fileType.toLowerCase())) {
      logger.warn('Unsupported file type', { fileType });
      return false;
    }

    if (fileSize > maxSize) {
      logger.warn('File too large', { fileSize, maxSize });
      return false;
    }

    return true;
  }
}

export const textExtractionService = new TextExtractionService();
