/**
 * Text extraction from PDF and DOCX files
 */

import pdf from 'pdf-parse';
import mammoth from 'mammoth';

interface ExtractionResult {
  text: string;
  wordCount: number;
  language: 'ro' | 'en' | 'mixed';
}

/**
 * Extract text from PDF buffer
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return cleanText(data.text);
}

/**
 * Extract text from DOCX buffer
 */
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return cleanText(result.value);
}

/**
 * Extract text from document based on file extension
 */
export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<ExtractionResult> {
  const ext = filename.split('.').pop()?.toLowerCase();

  let text: string;

  switch (ext) {
    case 'pdf':
      text = await extractTextFromPDF(buffer);
      break;
    case 'docx':
    case 'doc':
      text = await extractTextFromDOCX(buffer);
      break;
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }

  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const language = detectLanguage(text);

  return { text, wordCount, language };
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
    .replace(/[ \t]+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Simple language detection (Romanian vs English)
 * Based on common Romanian diacritics and words
 */
function detectLanguage(text: string): 'ro' | 'en' | 'mixed' {
  const sample = text.slice(0, 2000).toLowerCase();

  // Romanian-specific patterns
  const romanianPatterns = [
    /[ăâîșț]/g, // Romanian diacritics
    /\b(și|sau|care|este|sunt|pentru|dar|din|prin|acest|această|aceste|acestea)\b/g,
    /\b(contract|notificare|intampinare|cerere|tribunal|instanta|reclamant|parat)\b/g,
  ];

  // English patterns
  const englishPatterns = [
    /\b(the|and|for|that|with|this|from|have|been)\b/g,
    /\b(agreement|contract|party|parties|hereby|whereas|therefore)\b/g,
  ];

  let romanianScore = 0;
  let englishScore = 0;

  for (const pattern of romanianPatterns) {
    const matches = sample.match(pattern);
    romanianScore += matches ? matches.length : 0;
  }

  for (const pattern of englishPatterns) {
    const matches = sample.match(pattern);
    englishScore += matches ? matches.length : 0;
  }

  // Determine language based on scores
  const total = romanianScore + englishScore;
  if (total === 0) return 'en'; // Default to English

  const romanianRatio = romanianScore / total;

  if (romanianRatio > 0.7) return 'ro';
  if (romanianRatio < 0.3) return 'en';
  return 'mixed';
}

export { ExtractionResult };
