/**
 * Schema Validator
 *
 * Validates AI-generated document content against schema requirements.
 * Checks structure, sections, citations, and other schema-defined rules.
 */

import type {
  DocumentSchema,
  SectionDefinition,
  SchemaValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationRule,
  ValidationRuleResult,
} from './document-schema.types';
import logger from '../utils/logger';

// ============================================================================
// Content Safety Constants
// ============================================================================

/** Maximum content length for validation (100KB) */
const MAX_VALIDATION_CONTENT_LENGTH = 100 * 1024;

// ============================================================================
// Validation Rules
// ============================================================================

/**
 * Built-in validation rule: Check for single H1.
 */
const checkSingleH1: ValidationRule = {
  id: 'single-h1',
  description: 'Document should have exactly one H1 heading',
  severity: 'warning',
  fixStrategy: 'warn-only',
  validate: (content: string, schema: DocumentSchema): ValidationRuleResult => {
    if (schema.structure.headingHierarchy.h1Count !== 'single') {
      return { passed: true };
    }

    const h1Matches = content.match(/<h1[^>]*>/gi) || [];
    const count = h1Matches.length;

    if (count === 0) {
      return {
        passed: false,
        message: 'Documentul nu are titlu H1',
        details: { h1Count: count },
      };
    }

    if (count > 1) {
      return {
        passed: false,
        message: `Documentul are ${count} titluri H1 (ar trebui să fie unul singur)`,
        details: { h1Count: count },
      };
    }

    return { passed: true };
  },
};

/**
 * Built-in validation rule: Check H1 is required.
 */
const checkRequireH1: ValidationRule = {
  id: 'require-h1',
  description: 'Document must have an H1 heading',
  severity: 'error',
  fixStrategy: 'insert-placeholder',
  validate: (content: string, schema: DocumentSchema): ValidationRuleResult => {
    if (!schema.structure.headingHierarchy.requireH1) {
      return { passed: true };
    }

    const hasH1 = /<h1[^>]*>/i.test(content);

    if (!hasH1) {
      return {
        passed: false,
        message: 'Documentul nu are titlu H1 (obligatoriu)',
      };
    }

    return { passed: true };
  },
};

/**
 * Built-in validation rule: Check heading hierarchy depth.
 */
const checkHeadingDepth: ValidationRule = {
  id: 'heading-depth',
  description: 'Headings should not exceed maximum depth',
  severity: 'warning',
  fixStrategy: 'warn-only',
  validate: (content: string, schema: DocumentSchema): ValidationRuleResult => {
    const maxDepth = schema.structure.headingHierarchy.maxDepth;

    // Check each heading level
    for (let level = maxDepth + 1; level <= 6; level++) {
      const regex = new RegExp(`<h${level}[^>]*>`, 'i');
      if (regex.test(content)) {
        return {
          passed: false,
          message: `Documentul folosește H${level} (maximul permis este H${maxDepth})`,
          details: { foundLevel: level, maxDepth },
        };
      }
    }

    return { passed: true };
  },
};

/**
 * Built-in validation rule: Check required citations.
 */
const checkCitationCount: ValidationRule = {
  id: 'citation-count',
  description: 'Document should have minimum required citations',
  severity: 'warning',
  fixStrategy: 'warn-only',
  validate: (content: string, schema: DocumentSchema): ValidationRuleResult => {
    if (!schema.structure.citations.required) {
      return { passed: true };
    }

    const minCount = schema.structure.citations.minCount || 0;
    if (minCount === 0) {
      return { passed: true };
    }

    // Count <ref> elements
    const refMatches = content.match(/<ref\s[^>]*>/gi) || [];
    // Also count footnote-style citations <sup><a href="#fn
    const footnoteMatches = content.match(/<sup[^>]*><a\s+href="#fn/gi) || [];
    const count = refMatches.length + footnoteMatches.length;

    if (count < minCount) {
      return {
        passed: false,
        message: `Documentul are ${count} citări (minimum ${minCount} necesare)`,
        details: { citationCount: count, minRequired: minCount },
      };
    }

    return { passed: true };
  },
};

/**
 * Built-in validation rule: Check for sources block.
 */
const checkSourcesBlock: ValidationRule = {
  id: 'sources-block',
  description: 'Document should have a sources block',
  severity: 'warning',
  fixStrategy: 'warn-only',
  validate: (content: string, schema: DocumentSchema): ValidationRuleResult => {
    if (!schema.structure.citations.requireSourcesBlock) {
      return { passed: true };
    }

    const hasSourcesBlock = /<sources>/i.test(content) || /<footer[^>]*>.*note/is.test(content);

    if (!hasSourcesBlock) {
      return {
        passed: false,
        message: 'Documentul nu are bloc de surse (<sources> sau footer cu note)',
      };
    }

    return { passed: true };
  },
};

/**
 * Built-in validation rule: Check for proper heading nesting.
 */
const checkHeadingNesting: ValidationRule = {
  id: 'heading-nesting',
  description: 'Headings should be properly nested (no skipping levels)',
  severity: 'warning',
  fixStrategy: 'warn-only',
  validate: (content: string): ValidationRuleResult => {
    // Extract all headings in order
    const headingPattern = /<h([1-6])[^>]*>/gi;
    let match;
    let lastLevel = 0;
    const issues: string[] = [];

    while ((match = headingPattern.exec(content)) !== null) {
      const level = parseInt(match[1], 10);

      // First heading can be any level
      if (lastLevel === 0) {
        lastLevel = level;
        continue;
      }

      // Going deeper: should only go one level at a time
      if (level > lastLevel && level > lastLevel + 1) {
        issues.push(`Săritură de la H${lastLevel} la H${level}`);
      }

      lastLevel = level;
    }

    if (issues.length > 0) {
      return {
        passed: false,
        message: 'Ierarhia heading-urilor are sarituri: ' + issues.join(', '),
        details: { issues },
      };
    }

    return { passed: true };
  },
};

/**
 * All built-in validation rules.
 */
const BUILTIN_RULES: ValidationRule[] = [
  checkSingleH1,
  checkRequireH1,
  checkHeadingDepth,
  checkCitationCount,
  checkSourcesBlock,
  checkHeadingNesting,
];

// ============================================================================
// Schema Validator Class
// ============================================================================

export class SchemaValidator {
  /**
   * Validate content against a schema.
   *
   * @param content - The HTML content to validate
   * @param schema - The schema to validate against
   * @returns Validation result with errors and warnings
   */
  validate(content: string, schema: DocumentSchema): SchemaValidationResult {
    // Content safety check
    if (content.length > MAX_VALIDATION_CONTENT_LENGTH) {
      logger.warn('Content too large for validation, truncating', {
        originalLength: content.length,
        maxLength: MAX_VALIDATION_CONTENT_LENGTH,
        schemaId: schema.id,
      });
      content = content.substring(0, MAX_VALIDATION_CONTENT_LENGTH);
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const foundSections: string[] = [];
    const missingSections: string[] = [];
    let citationCount = 0;

    // Run built-in validation rules
    for (const rule of BUILTIN_RULES) {
      const result = rule.validate(content, schema);

      if (!result.passed) {
        if (rule.severity === 'error') {
          errors.push({
            ruleId: rule.id,
            message: result.message || rule.description,
            severity: 'error',
            fixStrategy: rule.fixStrategy,
            details: result.details,
          });
        } else {
          warnings.push({
            ruleId: rule.id,
            message: result.message || rule.description,
            details: result.details,
          });
        }
      }
    }

    // Check required sections
    for (const section of schema.structure.sections) {
      const found = this.detectSection(content, section);

      if (found) {
        foundSections.push(section.id);
      } else if (section.required) {
        missingSections.push(section.id);

        // Add to errors or warnings based on validation mode
        if (schema.validation.mode === 'strict') {
          errors.push({
            ruleId: `section-${section.id}`,
            message: `Secțiunea obligatorie "${section.name}" lipsește`,
            severity: 'error',
            fixStrategy: 'insert-placeholder',
          });
        } else {
          warnings.push({
            ruleId: `section-${section.id}`,
            message: `Secțiunea "${section.name}" nu a fost găsită`,
          });
        }
      }
    }

    // Count citations
    const refMatches = content.match(/<ref\s[^>]*>/gi) || [];
    const footnoteMatches = content.match(/<sup[^>]*><a\s+href="#fn/gi) || [];
    citationCount = refMatches.length + footnoteMatches.length;

    // Determine overall validity
    const valid = errors.length === 0;

    logger.debug('Schema validation completed', {
      schemaId: schema.id,
      valid,
      errorCount: errors.length,
      warningCount: warnings.length,
      foundSections,
      missingSections,
      citationCount,
    });

    return {
      valid,
      schemaId: schema.id,
      errors,
      warnings,
      foundSections,
      missingSections,
      citationCount,
    };
  }

  /**
   * Detect if a section is present in the content.
   */
  private detectSection(content: string, section: SectionDefinition): boolean {
    // Try each detection pattern
    for (const pattern of section.detectionPatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    // Fallback: try direct name matching (case-insensitive)
    const normalizedContent = content.toLowerCase();
    const normalizedName = section.name.toLowerCase();

    if (normalizedContent.includes(normalizedName)) {
      return true;
    }

    return false;
  }

  /**
   * Get a summary of validation results.
   */
  getSummary(result: SchemaValidationResult): string {
    const parts: string[] = [];

    if (result.valid) {
      parts.push('Validare OK');
    } else {
      parts.push(`Validare EȘUATĂ: ${result.errors.length} erori`);
    }

    if (result.warnings.length > 0) {
      parts.push(`${result.warnings.length} avertismente`);
    }

    if (result.missingSections.length > 0) {
      parts.push(`Secțiuni lipsă: ${result.missingSections.join(', ')}`);
    }

    parts.push(`Citări: ${result.citationCount}`);

    return parts.join('. ');
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Global schema validator instance.
 */
export const schemaValidator = new SchemaValidator();
