/**
 * Content Extraction Service
 * Extracts text from documents (PDF, DOCX, DOC, RTF, Excel, PowerPoint) for AI processing.
 * Ported from apps/legacy-import/src/services/text-extraction.service.ts
 */

import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import logger from '../utils/logger';

// Create a singleton extractor instance for DOC files
const wordExtractor = new WordExtractor();

// pdf-parse module type
type PdfParseModule = (buffer: Buffer) => Promise<{ text: string }>;

// Lazy-loaded pdf-parse module
let pdfParseModule: PdfParseModule | null = null;

/**
 * Lazily load pdf-parse module
 */
async function getPdfParse(): Promise<PdfParseModule | null> {
  if (pdfParseModule) return pdfParseModule;

  try {
    const module = require('pdf-parse');

    // Handle various module export patterns
    let pdfFn: unknown = module;

    // Check if it's wrapped in a default export
    if (module && typeof module === 'object' && 'default' in module) {
      pdfFn = module.default;
      // Handle nested default (e.g., { default: { default: fn } })
      if (pdfFn && typeof pdfFn === 'object' && 'default' in pdfFn) {
        pdfFn = (pdfFn as { default: unknown }).default;
      }
    }

    // Verify we have a function
    if (typeof pdfFn !== 'function') {
      logger.error('[ContentExtraction] pdf-parse module structure unexpected', {
        moduleType: typeof module,
        hasDefault: module && typeof module === 'object' && 'default' in module,
        defaultType: module?.default ? typeof module.default : 'undefined',
        keys: module && typeof module === 'object' ? Object.keys(module).slice(0, 5) : [],
      });
      throw new Error(`pdf-parse did not export a function, got ${typeof pdfFn}`);
    }

    pdfParseModule = pdfFn as PdfParseModule;
    logger.info('[ContentExtraction] pdf-parse module loaded successfully');
    return pdfParseModule;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('pdf-parse library not available, PDF text extraction disabled', {
      error: errorMsg,
    });
    // Store the actual error for debugging - this will appear in extraction_error
    throw new Error(`pdf-parse load failed: ${errorMsg}`);
  }
}

// ============================================================================
// Configuration
// ============================================================================

// Maximum content length to store (500KB)
const MAX_CONTENT_LENGTH = 500 * 1024;

// Extraction timeout (60 seconds)
const EXTRACTION_TIMEOUT = 60000;

// ============================================================================
// Types
// ============================================================================

export interface ExtractionResult {
  success: boolean;
  content: string;
  error?: string;
  truncated: boolean;
}

// Map MIME types to extraction type
type ExtractionType = 'pdf' | 'docx' | 'doc' | 'rtf' | 'xlsx' | 'xls' | 'pptx' | 'ppt';

// ============================================================================
// MIME Type Mapping
// ============================================================================

const MIME_TYPE_MAP: Record<string, ExtractionType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a MIME type supports content extraction
 */
export function isSupportedFormat(mimeType: string): boolean {
  return MIME_TYPE_MAP[mimeType.toLowerCase()] !== undefined;
}

/**
 * Get extraction type from MIME type
 */
function getExtractionType(mimeType: string): ExtractionType | null {
  return MIME_TYPE_MAP[mimeType.toLowerCase()] || null;
}

/**
 * Truncate content to max length with indicator
 */
function truncateContent(content: string): { text: string; truncated: boolean } {
  if (content.length <= MAX_CONTENT_LENGTH) {
    return { text: content, truncated: false };
  }
  return {
    text: content.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... content truncated at 500KB ...]',
    truncated: true,
  };
}

/**
 * Wrap extraction in a timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// ============================================================================
// Extraction Functions
// ============================================================================

/**
 * Extract text from a PDF buffer
 */
async function extractFromPDF(buffer: Buffer): Promise<string> {
  const pdfParse = await getPdfParse();
  if (!pdfParse) {
    throw new Error('PDF parsing unavailable - pdf-parse not loaded');
  }
  const data = await pdfParse(buffer);
  return data.text || '';
}

/**
 * Extract text from a DOCX buffer
 */
async function extractFromDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

/**
 * Extract text from a DOC buffer (legacy Word format)
 * Uses word-extractor for proper binary DOC parsing
 */
async function extractFromDOC(buffer: Buffer): Promise<string> {
  try {
    // First try word-extractor (proper DOC parser)
    const document = await wordExtractor.extract(buffer);
    const text = document.getBody();

    if (text && text.trim().length > 20) {
      return text.trim();
    }

    // Fallback: try mammoth (works for some .doc files that are actually .docx)
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.length > 50) {
        return result.value;
      }
    } catch {
      // Mammoth failed, continue
    }

    return '';
  } catch (error) {
    // Try mammoth as last resort
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.length > 50) {
        return result.value;
      }
    } catch {
      // Mammoth also failed
    }
    throw error;
  }
}

/**
 * Extract text from an RTF buffer
 * Uses mammoth which can handle some RTF files
 */
async function extractFromRTF(buffer: Buffer): Promise<string> {
  // mammoth can handle some RTF files
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

/**
 * Extract text from an Excel file (XLSX/XLS)
 * Extracts all cell values from all sheets
 */
async function extractFromExcel(buffer: Buffer): Promise<string> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error - Buffer type mismatch between Node versions
  await workbook.xlsx.load(buffer);

  const lines: string[] = [];

  workbook.eachSheet((worksheet) => {
    lines.push(`=== ${worksheet.name} ===`);

    worksheet.eachRow((row) => {
      const values: string[] = [];
      row.eachCell((cell) => {
        const value = cell.value;
        if (value !== null && value !== undefined) {
          // Handle rich text, formulas, etc.
          if (typeof value === 'object' && 'richText' in value) {
            values.push(
              (value as { richText: { text: string }[] }).richText
                .map((rt: { text: string }) => rt.text)
                .join('')
            );
          } else if (typeof value === 'object' && 'result' in value) {
            // Formula - use the result
            values.push(String((value as { result: unknown }).result || ''));
          } else {
            values.push(String(value));
          }
        }
      });
      if (values.length > 0) {
        lines.push(values.join('\t'));
      }
    });

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Extract text from a PowerPoint file (PPTX/PPT)
 * Uses officeparser for reliable extraction
 */
async function extractFromPowerPoint(buffer: Buffer): Promise<string> {
  const officeParser = await import('officeparser');
  const text = await officeParser.parseOfficeAsync(buffer);
  return text || '';
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract content from a document buffer
 *
 * @param buffer - The file buffer
 * @param fileType - MIME type of the file
 * @param fileName - Original file name (for logging)
 * @returns Extraction result with content or error
 */
export async function extractContent(
  buffer: Buffer,
  fileType: string,
  fileName: string
): Promise<ExtractionResult> {
  const extractionType = getExtractionType(fileType);

  if (!extractionType) {
    return {
      success: false,
      content: '',
      error: `Unsupported file type: ${fileType}`,
      truncated: false,
    };
  }

  logger.info('[ContentExtraction] Starting extraction', {
    fileName,
    fileType,
    extractionType,
    bufferSize: buffer.length,
  });

  try {
    let rawContent: string;

    const extractionPromise = (async () => {
      switch (extractionType) {
        case 'pdf':
          return extractFromPDF(buffer);
        case 'docx':
          return extractFromDOCX(buffer);
        case 'doc':
          return extractFromDOC(buffer);
        case 'rtf':
          return extractFromRTF(buffer);
        case 'xlsx':
        case 'xls':
          return extractFromExcel(buffer);
        case 'pptx':
        case 'ppt':
          return extractFromPowerPoint(buffer);
        default:
          throw new Error(`No extractor for type: ${extractionType}`);
      }
    })();

    rawContent = await withTimeout(
      extractionPromise,
      EXTRACTION_TIMEOUT,
      `Extraction timeout after ${EXTRACTION_TIMEOUT / 1000}s`
    );

    // Clean up whitespace
    rawContent = rawContent.trim().replace(/\n{3,}/g, '\n\n');

    if (!rawContent) {
      return {
        success: false,
        content: '',
        error: 'No text content could be extracted',
        truncated: false,
      };
    }

    const { text, truncated } = truncateContent(rawContent);

    logger.info('[ContentExtraction] Extraction successful', {
      fileName,
      originalLength: rawContent.length,
      truncatedLength: text.length,
      truncated,
    });

    return {
      success: true,
      content: text,
      truncated,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('[ContentExtraction] Extraction failed', {
      fileName,
      fileType,
      error: errorMessage,
    });

    return {
      success: false,
      content: '',
      error: errorMessage,
      truncated: false,
    };
  }
}

// ============================================================================
// Export
// ============================================================================

export const contentExtractionService = {
  extractContent,
  isSupportedFormat,
};
