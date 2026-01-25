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

// pdf-parse v2.x types (class-based API)
interface PDFParseClassType {
  new (options: { data: Buffer | Uint8Array }): PDFParseInstance;
}

interface PDFParseInstance {
  getText(): Promise<{ text: string; pages: unknown[]; total: number }>;
  destroy(): Promise<void>;
}

// Lazy-loaded PDFParse class
let PDFParseClass: PDFParseClassType | null = null;

/**
 * Lazily load PDFParse class from pdf-parse v2.x
 */
async function getPDFParseClass(): Promise<PDFParseClassType> {
  if (PDFParseClass) return PDFParseClass;

  try {
    const module = require('pdf-parse');

    // pdf-parse v2.x exports PDFParse as a named export
    let ParseClass: unknown = module.PDFParse;

    // Handle CJS interop where it might be wrapped
    if (!ParseClass && module.default) {
      ParseClass = module.default.PDFParse;
    }

    if (typeof ParseClass !== 'function') {
      logger.error('[ContentExtraction] pdf-parse PDFParse class not found', {
        moduleType: typeof module,
        hasDefault: 'default' in module,
        hasPDFParse: 'PDFParse' in module,
        keys: Object.keys(module).slice(0, 10),
      });
      throw new Error(`PDFParse class not found in pdf-parse module`);
    }

    PDFParseClass = ParseClass as PDFParseClassType;
    logger.info('[ContentExtraction] pdf-parse v2.x PDFParse class loaded successfully');
    return PDFParseClass;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('pdf-parse library not available, PDF text extraction disabled', {
      error: errorMsg,
    });
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
 * Extract text from a PDF buffer using pdf-parse v2.x class-based API
 */
async function extractFromPDF(buffer: Buffer): Promise<string> {
  const PDFParse = await getPDFParseClass();
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text || '';
  } finally {
    // Always clean up the parser
    await parser.destroy().catch(() => {
      // Ignore destroy errors
    });
  }
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
