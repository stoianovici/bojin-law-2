/**
 * Word AI Validation Service
 * Phase 1.4: Post-Generation Validation
 *
 * Validates generated court filing documents against template requirements.
 * Includes content safety checks to prevent ReDoS attacks.
 */

import type {
  CourtFilingValidationResult,
  CourtFilingTemplateMetadata,
} from '@legal-platform/types';
import logger from '../utils/logger';

// Re-export types for backwards compatibility
export type { CourtFilingValidationResult, CourtFilingTemplateMetadata };

// ============================================================================
// Content Safety Constants
// ============================================================================

/** Maximum content length for regex validation (100KB) */
const MAX_VALIDATION_CONTENT_LENGTH = 100 * 1024;

/** Maximum number of required sections to validate */
const MAX_REQUIRED_SECTIONS = 50;

/** Maximum length per section name */
const MAX_SECTION_NAME_LENGTH = 100;

// ============================================================================
// Section Detection Patterns
// ============================================================================

/**
 * Patterns for detecting common court filing sections in Romanian text.
 * Each key maps to an array of regex patterns that indicate presence of that section.
 */
const SECTION_PATTERNS: Record<string, RegExp[]> = {
  // Header / Court identification
  'Antet instanta': [
    /către\s+(judecătoria|tribunalul|curtea)/i,
    /instanța\s+de\s+judecată/i,
    /dosar\s+nr\./i,
  ],
  'Instanta si numar dosar': [/dosar\s+(nr\.?|număr)/i, /instanța.*?dosar/i],

  // Party identification
  'Identificare Reclamant': [
    /reclamant[:\s]/i,
    /subsemnatul.*?calitate\s+de\s+reclamant/i,
    /în\s+calitate\s+de\s+reclamant/i,
  ],
  'Identificare Parat': [
    /pârât[:\s]/i,
    /pârâtul?[:\s]/i,
    /în\s+contradictoriu\s+cu/i,
    /chemat\s+în\s+judecată/i,
  ],
  'Identificare parti': [/părțile/i, /reclamant.*?pârât/i, /pârât.*?reclamant/i],

  // Claim elements
  'Obiectul cererii si valoarea': [
    /obiectul?\s+(cererii|acțiunii)/i,
    /valoarea?\s+(cererii|litigiului|obiectului)/i,
    /solicit[ăa]m/i,
  ],
  Obiect: [/obiectul?\s+(cererii|contestației|intervenției)/i],

  // Jurisdiction
  'Competenta instantei': [
    /competența/i,
    /competent[ăa]\s+territorial/i,
    /competent[ăa]\s+material/i,
  ],

  // Facts and law
  'Situatia de fapt': [
    /situația\s+de\s+fapt/i,
    /în\s+fapt/i,
    /starea\s+de\s+fapt/i,
    /motivele\s+de\s+fapt/i,
  ],
  'Temeiul de drept': [
    /temei(ul)?\s+(de\s+)?drept/i,
    /în\s+drept/i,
    /temeiul?\s+juridic/i,
    /baza\s+legală/i,
  ],
  'Motivele de drept': [/motivele?\s+de\s+drept/i, /în\s+drept/i],

  // Claims and requests
  Pretentii: [/pretenții/i, /solicit[ăa]m.*?următoarele/i, /pretențiile\s+noastre/i],
  Solicitare: [/solicit[ăa]m/i, /rugăm\s+instanța/i],
  Cereri: [/formulăm.*?cerere/i, /depunem.*?cerere/i],

  // Evidence
  Dovezi: [/dovezi/i, /probe/i, /înscrisuri/i, /martori/i, /mijloace\s+de\s+probă/i],
  'Probele invocate': [/probe(le)?\s+(invocate|propuse)/i, /dovezi(le)?\s+propuse/i],

  // Procedural elements
  'Exceptii procesuale': [
    /excepții?\s+(procesuale?|de\s+procedură)/i,
    /invocăm.*?excepți/i,
    /ridicăm.*?excepți/i,
  ],
  'Apararea juridica': [/apărarea/i, /ne\s+apărăm/i, /în\s+apărare/i],
  Contraargumente: [/contraargument/i, /răspundem\s+la/i, /contestăm/i],

  // Costs and annexes
  'Cheltuieli de judecata': [/cheltuieli\s+de\s+judecată/i, /onorarii/i, /taxă\s+de\s+timbru/i],
  Anexe: [/anexe/i, /documente\s+atașate/i, /înscrisuri\s+anexate/i, /alăturat/i],
  'Inscrisuri anexate': [/înscrisuri\s+anexate/i, /documente\s+anexate/i],

  // Signature
  Semnatura: [/semnătura/i, /avocat/i, /cu\s+stimă/i, /reprezentant/i],

  // Appeal-specific sections
  'Hotararea atacata': [/hotărârea\s+atacată/i, /sentința\s+atacată/i, /decizia\s+atacată/i],
  'Instanta a carei hotarare se ataca': [/instanța\s+a\s+cărei/i, /hotărârea\s+pronunțată\s+de/i],
  'Motivele de fapt': [/motivele?\s+de\s+fapt/i, /în\s+fapt/i],
  'Motivele de nelegalitate': [/motivele?\s+de\s+nelegalitate/i, /nelegalitate/i, /art\.\s*488/i],
  'Dezvoltarea motivelor': [/dezvoltăm\s+motivele/i, /dezvoltare/i],

  // Intervention-specific
  'Intervenient principal': [/intervenient\s+principal/i],
  'Intervenient accesoriu': [/intervenient\s+accesoriu/i],
  'Obiectul interventiei': [/obiectul\s+intervenției/i],
  'Interesul interventiei': [/interesul\s+intervenției/i],

  // Guarantee-specific
  'Chemator in garantie': [/chemător\s+în\s+garanție/i],
  'Chemat in garantie': [/chemat\s+în\s+garanție/i],
  'Temeiul garantiei': [/temeiul\s+garanției/i],
  'Prejudiciul potential': [/prejudiciul?\s+(potențial|posibil)/i],

  // Execution-specific
  'Titlul executoriu': [/titlul?\s+executoriu/i],
  'Suma datorata': [/suma\s+datorată/i, /debit/i, /creanță/i],
  'Modalitatea de executare': [/modalitatea\s+de\s+executare/i],
  'Actul contestat': [/actul\s+contestat/i],
  'Motivele contestatiei': [/motivele\s+contestației/i],
  Cautiune: [/cauțiune/i],

  // Special procedures
  'Aparenta dreptului': [/aparența\s+dreptului/i],
  Urgenta: [/urgența/i, /urgent/i, /grabnic/i],
  'Masurile provizorii solicitate': [/măsuri\s+provizorii/i],
  'Cazul de incompatibilitate': [/cazul?\s+de\s+incompatibilitate/i],
  'Motivul contestatiei': [/motivul\s+contestației/i],
  'Motivul de revizuire': [/motivul?\s+de\s+revizuire/i],
  'Dovezi noi': [/dovezi\s+noi/i, /înscrisuri\s+noi/i],
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a generated court filing document against template requirements.
 *
 * @param content - The generated document content (markdown or HTML)
 * @param requiredSections - List of required section names from template
 * @returns Validation result with missing and found sections
 *
 * @throws Error if content is too large for safe regex processing
 */
export function validateCourtFiling(
  content: string,
  requiredSections: string[]
): CourtFilingValidationResult {
  // Content safety checks (prevent ReDoS)
  if (content.length > MAX_VALIDATION_CONTENT_LENGTH) {
    logger.warn('Content too large for validation, truncating', {
      originalLength: content.length,
      maxLength: MAX_VALIDATION_CONTENT_LENGTH,
    });
    // Truncate content for safety - better than failing entirely
    content = content.substring(0, MAX_VALIDATION_CONTENT_LENGTH);
  }

  // Limit number of sections to validate
  if (requiredSections.length > MAX_REQUIRED_SECTIONS) {
    logger.warn('Too many required sections, truncating', {
      originalCount: requiredSections.length,
      maxCount: MAX_REQUIRED_SECTIONS,
    });
    requiredSections = requiredSections.slice(0, MAX_REQUIRED_SECTIONS);
  }

  // Validate section name lengths and filter out overly long names
  requiredSections = requiredSections.filter((section) => {
    if (section.length > MAX_SECTION_NAME_LENGTH) {
      logger.warn('Section name too long, skipping', {
        section: section.substring(0, 50),
        length: section.length,
        maxLength: MAX_SECTION_NAME_LENGTH,
      });
      return false;
    }
    return true;
  });

  const foundSections: string[] = [];
  const missingSections: string[] = [];
  const warnings: string[] = [];

  // Normalize content for matching (remove diacritics for fuzzy matching)
  const normalizedContent = content
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const section of requiredSections) {
    const patterns = SECTION_PATTERNS[section];

    if (!patterns) {
      // No predefined pattern - try direct text matching
      const sectionLower = section
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      if (
        normalizedContent.includes(sectionLower) ||
        content.toLowerCase().includes(section.toLowerCase())
      ) {
        foundSections.push(section);
      } else {
        missingSections.push(section);
        warnings.push(
          `Secțiunea "${section}" nu are pattern definit - verificare manuală recomandată`
        );
      }
      continue;
    }

    // Check if any pattern matches
    const found = patterns.some((pattern) => pattern.test(content));

    if (found) {
      foundSections.push(section);
    } else {
      missingSections.push(section);
    }
  }

  const valid = missingSections.length === 0;

  logger.info('Court filing validation completed', {
    requiredCount: requiredSections.length,
    foundCount: foundSections.length,
    missingCount: missingSections.length,
    valid,
    missingSections: missingSections.slice(0, 5), // Log first 5 for brevity
  });

  return {
    valid,
    missingSections,
    foundSections,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate court filing with full template metadata.
 * Provides additional context-aware validation.
 *
 * @param content - The generated document content
 * @param templateMetadata - Full template metadata
 * @returns Enhanced validation result
 */
export function validateCourtFilingWithMetadata(
  content: string,
  templateMetadata: CourtFilingTemplateMetadata
): CourtFilingValidationResult {
  const result = validateCourtFiling(content, templateMetadata.requiredSections);

  // Add form category specific warnings
  if (templateMetadata.formCategory === 'A' && result.missingSections.length > 2) {
    result.warnings = result.warnings || [];
    result.warnings.push(
      `Cererea de tip A (complexă) are ${result.missingSections.length} secțiuni lipsă - verificați structura documentului`
    );
  }

  // Check for CPC article references if important
  if (templateMetadata.cpcArticles.length > 0) {
    const hasAnyArticle = templateMetadata.cpcArticles.some((art) =>
      content.toLowerCase().includes(art.toLowerCase())
    );
    if (!hasAnyArticle) {
      result.warnings = result.warnings || [];
      result.warnings.push(
        `Documentul nu conține referințe la articolele CPC relevante: ${templateMetadata.cpcArticles.slice(0, 3).join(', ')}`
      );
    }
  }

  // Check for party labels
  const { party1, party2 } = templateMetadata.partyLabels;
  const contentLower = content.toLowerCase();

  if (!contentLower.includes(party1.toLowerCase())) {
    result.warnings = result.warnings || [];
    result.warnings.push(`Documentul nu menționează rolul de "${party1}"`);
  }

  if (!contentLower.includes(party2.toLowerCase())) {
    result.warnings = result.warnings || [];
    result.warnings.push(`Documentul nu menționează rolul de "${party2}"`);
  }

  return result;
}

export const wordAiValidationService = {
  validateCourtFiling,
  validateCourtFilingWithMetadata,
};
