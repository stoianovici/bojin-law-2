/**
 * Text Extraction Service
 * Extracts text from PDF and DOCX files for language detection
 * Part of Story 3.2.5 - Legacy Document Import
 */

import mammoth from 'mammoth';
// @ts-expect-error - pdf-parse has ESM issues with TypeScript
import pdfParse from 'pdf-parse';
import { francAll } from 'franc-min';

// Language type matching Prisma enum
export type SupportedLanguage = 'Romanian' | 'English' | 'Italian' | 'French' | 'Mixed';

// Map franc ISO 639-3 codes to our supported languages
const FRANC_LANG_MAP: Record<string, SupportedLanguage> = {
  ron: 'Romanian',
  eng: 'English',
  ita: 'Italian',
  fra: 'French',
};

// Romanian-specific patterns for better detection
const ROMANIAN_PATTERNS = [
  /\b(și|sau|pentru|este|sunt|care|mai|acest|această|aceste|acestea|prin|din|către)\b/gi,
  /\b(contract|articol|obligații|părți|drepturile|executare|reziliere|societate)\b/gi,
  /[ăâîșț]/gi, // Romanian diacritics
];

// English-specific patterns
const ENGLISH_PATTERNS = [
  /\b(the|and|for|that|with|this|from|have|will|shall|between|under)\b/gi,
  /\b(agreement|contract|party|parties|obligations|rights|termination|company)\b/gi,
];

// Italian-specific patterns
const ITALIAN_PATTERNS = [
  /\b(il|lo|la|gli|le|che|per|con|una|sono|della|questo|tra|fra)\b/gi,
  /\b(contratto|articolo|obblighi|parti|diritti|esecuzione|risoluzione|società)\b/gi,
];

// French-specific patterns
const FRENCH_PATTERNS = [
  /\b(le|la|les|et|pour|que|qui|avec|dans|sont|cette|ces|entre|sous)\b/gi,
  /\b(contrat|article|obligations|parties|droits|exécution|résiliation|société)\b/gi,
  /[éèêëàâùûôîç]/gi, // French diacritics
];

export interface TextExtractionResult {
  text: string;
  success: boolean;
  error?: string;
}

export interface LanguageDetectionResult {
  primaryLanguage: SupportedLanguage;
  confidence: number;
}

/**
 * Extract text from a PDF buffer
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<TextExtractionResult> {
  try {
    const data = await pdfParse(buffer);
    return {
      text: data.text || '',
      success: true,
    };
  } catch (error) {
    return {
      text: '',
      success: false,
      error: error instanceof Error ? error.message : 'PDF extraction failed',
    };
  }
}

/**
 * Extract text from a DOCX buffer
 */
export async function extractTextFromDOCX(buffer: Buffer): Promise<TextExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value || '',
      success: true,
    };
  } catch (error) {
    return {
      text: '',
      success: false,
      error: error instanceof Error ? error.message : 'DOCX extraction failed',
    };
  }
}

/**
 * Extract text from a DOC buffer (legacy Word format)
 * Note: mammoth doesn't support .doc, so we try to extract what we can
 */
export async function extractTextFromDOC(buffer: Buffer): Promise<TextExtractionResult> {
  try {
    // Try mammoth first (works for some .doc files that are actually .docx)
    const result = await mammoth.extractRawText({ buffer });
    if (result.value && result.value.length > 50) {
      return {
        text: result.value,
        success: true,
      };
    }

    // Fallback: try to extract readable ASCII text from the binary
    const text = extractReadableText(buffer);
    if (text.length > 50) {
      return {
        text,
        success: true,
      };
    }

    return {
      text: '',
      success: false,
      error: 'Could not extract text from legacy DOC format',
    };
  } catch (error) {
    // Try raw text extraction as fallback
    const text = extractReadableText(buffer);
    if (text.length > 50) {
      return {
        text,
        success: true,
      };
    }

    return {
      text: '',
      success: false,
      error: error instanceof Error ? error.message : 'DOC extraction failed',
    };
  }
}

/**
 * Extract readable ASCII/UTF-8 text from a binary buffer
 * Used as fallback for legacy .doc files
 */
function extractReadableText(buffer: Buffer): string {
  const text = buffer.toString('utf-8');
  // Filter to mostly printable characters and common whitespace
  const readable = text.replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, ' ');
  // Collapse multiple spaces
  const collapsed = readable.replace(/\s+/g, ' ').trim();
  // Only return if we have meaningful content
  return collapsed.length > 100 ? collapsed : '';
}

/**
 * Extract text from a document buffer based on file extension
 */
export async function extractText(
  buffer: Buffer,
  fileExtension: string
): Promise<TextExtractionResult> {
  const ext = fileExtension.toLowerCase().replace('.', '');

  switch (ext) {
    case 'pdf':
      return extractTextFromPDF(buffer);
    case 'docx':
      return extractTextFromDOCX(buffer);
    case 'doc':
      return extractTextFromDOC(buffer);
    default:
      return {
        text: '',
        success: false,
        error: `Unsupported file extension: ${fileExtension}`,
      };
  }
}

/**
 * Detect language using pattern matching
 */
function detectLanguageWithPatterns(text: string): LanguageDetectionResult {
  const scores: Record<SupportedLanguage, number> = {
    Romanian: 0,
    English: 0,
    Italian: 0,
    French: 0,
    Mixed: 0,
  };

  // Count pattern matches for each language
  for (const pattern of ROMANIAN_PATTERNS) {
    const matches = text.match(pattern);
    scores.Romanian += matches ? matches.length : 0;
  }
  for (const pattern of ENGLISH_PATTERNS) {
    const matches = text.match(pattern);
    scores.English += matches ? matches.length : 0;
  }
  for (const pattern of ITALIAN_PATTERNS) {
    const matches = text.match(pattern);
    scores.Italian += matches ? matches.length : 0;
  }
  for (const pattern of FRENCH_PATTERNS) {
    const matches = text.match(pattern);
    scores.French += matches ? matches.length : 0;
  }

  // Find the language with highest score
  const entries = Object.entries(scores).filter(([lang]) => lang !== 'Mixed') as [
    SupportedLanguage,
    number,
  ][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const [topLang, topScore] = sorted[0];
  const [, secondScore] = sorted[1] || ['Mixed', 0];

  // Calculate confidence based on score difference
  const totalScore = sorted.reduce((sum, [, score]) => sum + score, 0);
  if (totalScore === 0) {
    return { primaryLanguage: 'Mixed', confidence: 0.3 };
  }

  const confidence = topScore / totalScore;

  // If top two scores are close, it might be mixed
  if (secondScore > 0 && topScore / secondScore < 2) {
    return { primaryLanguage: topLang, confidence: confidence * 0.7 };
  }

  return { primaryLanguage: topLang, confidence: Math.min(confidence, 0.9) };
}

/**
 * Detect language from text using franc + pattern matching
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  if (!text || text.length < 20) {
    return { primaryLanguage: 'Mixed', confidence: 0.2 };
  }

  // Try franc first with multiple candidates
  const francResults = francAll(text, { minLength: 10 });
  const topFrancResult = francResults[0];

  // Get franc's best guess if available
  let francLang: SupportedLanguage | null = null;
  let francConfidence = 0;

  if (topFrancResult && topFrancResult[0] !== 'und') {
    francLang = FRANC_LANG_MAP[topFrancResult[0]] || null;
    francConfidence = topFrancResult[1];
  }

  // Also run pattern-based detection
  const patternResult = detectLanguageWithPatterns(text);

  // Combine results: prefer pattern detection for our target languages
  if (patternResult.confidence > 0.5) {
    // Pattern detection is confident
    return patternResult;
  } else if (francLang && francConfidence > 0.5) {
    // Franc is confident and detected a supported language
    return { primaryLanguage: francLang, confidence: francConfidence };
  } else if (patternResult.confidence > 0.3) {
    // Low confidence pattern match is better than nothing
    return patternResult;
  } else if (francLang) {
    // Fall back to franc even with low confidence
    return { primaryLanguage: francLang, confidence: Math.max(francConfidence, 0.4) };
  }

  // No detection worked - mark as Mixed (unknown)
  return { primaryLanguage: 'Mixed', confidence: 0.3 };
}

/**
 * Extract text and detect language from a document buffer
 */
export async function extractTextAndDetectLanguage(
  buffer: Buffer,
  fileExtension: string
): Promise<{
  text: string;
  primaryLanguage: SupportedLanguage;
  languageConfidence: number;
  extractionSuccess: boolean;
  extractionError?: string;
}> {
  const extraction = await extractText(buffer, fileExtension);

  if (!extraction.success || !extraction.text) {
    return {
      text: '',
      primaryLanguage: 'Mixed',
      languageConfidence: 0,
      extractionSuccess: false,
      extractionError: extraction.error,
    };
  }

  const language = detectLanguage(extraction.text);

  return {
    text: extraction.text,
    primaryLanguage: language.primaryLanguage,
    languageConfidence: language.confidence,
    extractionSuccess: true,
  };
}
