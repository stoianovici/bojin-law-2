/**
 * Document Template Validator Service
 * Story 5.4: Proactive AI Suggestions System
 *
 * Validates documents against templates and predefined rules,
 * supporting both system defaults and custom firm-specific rules.
 */

import { prisma } from '@legal-platform/database';
import logger from '../lib/logger';

// Types for template validation
export interface TemplateValidationRule {
  documentType: string;
  requiredSections: string[];
  requiredFields: string[];
  signatureBlocks: number;
  dateFields: string[];
  optionalSections?: string[];
  customValidations?: CustomValidation[];
}

export interface CustomValidation {
  name: string;
  type: 'regex' | 'contains' | 'length' | 'format';
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  errorMessage: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0.0 - 1.0
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  type:
    | 'missing_section'
    | 'missing_field'
    | 'invalid_format'
    | 'missing_signature'
    | 'missing_date';
  field: string;
  message: string;
  location?: string;
}

export interface ValidationWarning {
  type: 'recommended_section' | 'style_suggestion' | 'best_practice';
  field: string;
  message: string;
}

// Pre-defined validation rules for Romanian legal documents
export const ROMANIAN_LEGAL_TEMPLATES: Record<string, TemplateValidationRule> = {
  // Contract templates
  Contract: {
    documentType: 'Contract',
    requiredSections: [
      'parties',
      'object',
      'price',
      'duration',
      'obligations',
      'termination',
      'disputes',
      'final_provisions',
    ],
    requiredFields: [
      'party_names',
      'party_addresses',
      'contract_date',
      'effective_date',
      'contract_value',
      'payment_terms',
    ],
    signatureBlocks: 2,
    dateFields: ['contract_date', 'effective_date', 'termination_date'],
    optionalSections: ['force_majeure', 'confidentiality', 'amendments', 'exhibits'],
  },

  VanzareCumparare: {
    documentType: 'VanzareCumparare',
    requiredSections: [
      'parties',
      'object_sale',
      'price',
      'payment',
      'delivery',
      'warranties',
      'ownership_transfer',
    ],
    requiredFields: [
      'seller_name',
      'seller_address',
      'seller_id',
      'buyer_name',
      'buyer_address',
      'buyer_id',
      'property_description',
      'sale_price',
      'payment_method',
    ],
    signatureBlocks: 2,
    dateFields: ['contract_date', 'delivery_date'],
    optionalSections: ['encumbrances', 'representations', 'notarization'],
  },

  // Motion/Court filing templates
  Motion: {
    documentType: 'Motion',
    requiredSections: [
      'caption',
      'introduction',
      'statement_of_facts',
      'argument',
      'prayer_for_relief',
      'certificate_of_service',
    ],
    requiredFields: ['court_name', 'case_number', 'party_names', 'motion_title', 'filing_date'],
    signatureBlocks: 1,
    dateFields: ['filing_date', 'service_date'],
    optionalSections: ['exhibits', 'memorandum_of_law'],
  },

  Intampinare: {
    documentType: 'Intampinare',
    requiredSections: [
      'caption',
      'parties',
      'procedural_history',
      'response_to_claims',
      'legal_arguments',
      'evidence',
      'conclusion',
    ],
    requiredFields: [
      'court_name',
      'case_number',
      'defendant_name',
      'plaintiff_name',
      'filing_date',
    ],
    signatureBlocks: 1,
    dateFields: ['filing_date'],
    optionalSections: ['counterclaims', 'preliminary_objections'],
  },

  Cerere: {
    documentType: 'Cerere',
    requiredSections: [
      'header',
      'parties',
      'facts',
      'legal_basis',
      'claims',
      'evidence',
      'conclusion',
    ],
    requiredFields: [
      'court_name',
      'petitioner_name',
      'petitioner_address',
      'respondent_name',
      'claim_value',
    ],
    signatureBlocks: 1,
    dateFields: ['filing_date'],
    optionalSections: ['procedural_requests', 'provisional_measures'],
  },

  // Letter templates
  Letter: {
    documentType: 'Letter',
    requiredSections: [
      'letterhead',
      'date',
      'recipient',
      'salutation',
      'body',
      'closing',
      'signature',
    ],
    requiredFields: [
      'sender_name',
      'sender_address',
      'recipient_name',
      'recipient_address',
      'date',
      'subject',
    ],
    signatureBlocks: 1,
    dateFields: ['date'],
    optionalSections: ['reference', 'enclosures', 'cc'],
  },

  ClientLetter: {
    documentType: 'ClientLetter',
    requiredSections: [
      'letterhead',
      'date',
      'client_info',
      'salutation',
      'matter_reference',
      'body',
      'advice_disclaimer',
      'closing',
      'signature',
    ],
    requiredFields: ['client_name', 'matter_id', 'date', 'attorney_name'],
    signatureBlocks: 1,
    dateFields: ['date'],
    optionalSections: ['billing_info', 'next_steps'],
  },

  // Pleading templates
  Pleading: {
    documentType: 'Pleading',
    requiredSections: [
      'caption',
      'introduction',
      'factual_allegations',
      'causes_of_action',
      'relief_requested',
      'verification',
    ],
    requiredFields: ['court_name', 'case_number', 'plaintiff_name', 'defendant_name'],
    signatureBlocks: 1,
    dateFields: ['filing_date'],
    optionalSections: ['jury_demand', 'exhibits'],
  },

  // Power of Attorney
  Procura: {
    documentType: 'Procura',
    requiredSections: ['grantor', 'grantee', 'powers_granted', 'scope', 'duration', 'signatures'],
    requiredFields: [
      'grantor_name',
      'grantor_id',
      'grantor_address',
      'grantee_name',
      'grantee_id',
      'powers_description',
    ],
    signatureBlocks: 1,
    dateFields: ['date', 'expiration_date'],
    optionalSections: ['notarization', 'witnesses'],
  },
};

// Field patterns for Romanian legal documents
const ROMANIAN_FIELD_PATTERNS: Record<string, RegExp[]> = {
  party_names: [/părți/i, /parte/i, /între/i, /parties/i, /vânzător/i, /cumpărător/i],
  party_addresses: [/domicil/i, /sediul/i, /adresa/i, /address/i],
  contract_date: [/data.*contract/i, /încheiat.*la/i, /dated/i],
  court_name: [/judecătorie|tribunal|curte.*apel|instanța/i],
  case_number: [/dosar.*nr/i, /nr\.?\s*\d+\/\d+/i, /case.*no/i],
  signature: [/semnătur/i, /signature/i, /semnat/i, /signed/i],
  date: [/data/i, /date/i, /\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/],
  notarization: [/notar/i, /autentific/i, /legalizat/i],
};

// Section patterns for Romanian legal documents
const ROMANIAN_SECTION_PATTERNS: Record<string, RegExp[]> = {
  parties: [/părți/i, /părțile contractante/i, /parties/i, /între/i],
  object: [/obiect/i, /object/i, /obiectul/i],
  price: [/preț/i, /price/i, /valoare/i, /contravaloare/i],
  obligations: [/obligații/i, /obligations/i],
  termination: [/încetare/i, /reziliere/i, /termination/i],
  disputes: [/litigii/i, /disputes/i, /competență/i],
  caption: [/antet/i, /caption/i, /dosar/i],
  prayer_for_relief: [/solicit/i, /cerere/i, /prayer/i, /relief/i],
  certificate_of_service: [/certificat.*comunicare/i, /certificate.*service/i],
  signature: [/semnătur/i, /signature/i],
};

export class DocumentTemplateValidatorService {
  /**
   * Validate a document against a template
   */
  async validateDocument(
    documentContent: string,
    documentType: string,
    firmId?: string
  ): Promise<ValidationResult> {
    logger.info('Validating document against template', {
      documentType,
      firmId,
      contentLength: documentContent.length,
    });

    // Get the appropriate template
    const template = await this.getTemplate(documentType, firmId);

    if (!template) {
      logger.warn('No template found for document type', { documentType });
      return {
        isValid: true, // Can't validate without template
        score: 1.0,
        errors: [],
        warnings: [
          {
            type: 'style_suggestion',
            field: 'template',
            message: `No validation template found for document type: ${documentType}`,
          },
        ],
        suggestions: ['Consider creating a custom template for this document type'],
      };
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    const contentLower = documentContent.toLowerCase();

    // Validate required sections
    for (const section of template.requiredSections) {
      if (!this.sectionExists(contentLower, section)) {
        errors.push({
          type: 'missing_section',
          field: section,
          message: `Required section "${section}" is missing`,
        });
      }
    }

    // Validate optional sections (generate warnings)
    if (template.optionalSections) {
      for (const section of template.optionalSections) {
        if (!this.sectionExists(contentLower, section)) {
          warnings.push({
            type: 'recommended_section',
            field: section,
            message: `Recommended section "${section}" could enhance this document`,
          });
        }
      }
    }

    // Validate required fields
    for (const field of template.requiredFields) {
      if (!this.fieldExists(contentLower, field)) {
        errors.push({
          type: 'missing_field',
          field,
          message: `Required field "${field}" is missing`,
        });
      }
    }

    // Validate date fields
    for (const dateField of template.dateFields) {
      if (!this.dateFieldExists(contentLower, dateField)) {
        warnings.push({
          type: 'best_practice',
          field: dateField,
          message: `Date field "${dateField}" may be missing or improperly formatted`,
        });
      }
    }

    // Validate signature blocks
    const signatureCount = this.countSignatureBlocks(documentContent);
    if (signatureCount < template.signatureBlocks) {
      errors.push({
        type: 'missing_signature',
        field: 'signature_blocks',
        message: `Expected ${template.signatureBlocks} signature block(s), found ${signatureCount}`,
      });
    }

    // Run custom validations if any
    if (template.customValidations) {
      for (const validation of template.customValidations) {
        const validationResult = this.runCustomValidation(documentContent, validation);
        if (!validationResult.isValid) {
          errors.push({
            type: 'invalid_format',
            field: validation.name,
            message: validation.errorMessage,
          });
        }
      }
    }

    // Generate suggestions based on errors
    if (errors.length > 0) {
      suggestions.push('Review and address all validation errors before finalizing the document');

      if (errors.some((e) => e.type === 'missing_section')) {
        suggestions.push('Add the missing required sections to ensure document completeness');
      }

      if (errors.some((e) => e.type === 'missing_signature')) {
        suggestions.push('Ensure all required signature blocks are present');
      }
    }

    if (warnings.length > 0) {
      suggestions.push('Consider addressing the warnings to improve document quality');
    }

    // Calculate validation score
    const totalChecks =
      template.requiredSections.length +
      template.requiredFields.length +
      template.signatureBlocks +
      (template.customValidations?.length || 0);
    const failedChecks = errors.length;
    const score = totalChecks > 0 ? Math.max(0, (totalChecks - failedChecks) / totalChecks) : 1.0;

    const result: ValidationResult = {
      isValid: errors.length === 0,
      score,
      errors,
      warnings,
      suggestions,
    };

    logger.info('Document validation completed', {
      documentType,
      isValid: result.isValid,
      score: result.score,
      errorCount: errors.length,
      warningCount: warnings.length,
    });

    return result;
  }

  /**
   * Get template for document type (check firm custom templates first)
   */
  private async getTemplate(
    documentType: string,
    firmId?: string
  ): Promise<TemplateValidationRule | null> {
    // Check for firm-specific custom template first
    if (firmId) {
      const customTemplate = await this.getCustomTemplate(firmId, documentType);
      if (customTemplate) {
        return customTemplate;
      }
    }

    // Fall back to predefined templates
    const normalizedType = this.normalizeDocumentType(documentType);
    return ROMANIAN_LEGAL_TEMPLATES[normalizedType] || null;
  }

  /**
   * Get custom template from database (stored in defaultRates JSON field)
   */
  private async getCustomTemplate(
    firmId: string,
    documentType: string
  ): Promise<TemplateValidationRule | null> {
    try {
      // Check if firm has custom templates stored in defaultRates
      const firm = await prisma.firm.findUnique({
        where: { id: firmId },
        select: { defaultRates: true },
      });

      if (firm?.defaultRates) {
        const rates = firm.defaultRates as Record<string, unknown>;
        const customTemplates = rates.documentTemplates as
          | Record<string, TemplateValidationRule>
          | undefined;

        if (customTemplates && customTemplates[documentType]) {
          logger.debug('Using custom firm template', { firmId, documentType });
          return customTemplates[documentType];
        }
      }

      return null;
    } catch (error) {
      logger.warn('Error fetching custom template', {
        firmId,
        documentType,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Check if a section exists in the document
   */
  private sectionExists(content: string, section: string): boolean {
    const patterns = ROMANIAN_SECTION_PATTERNS[section];
    if (patterns) {
      return patterns.some((pattern) => pattern.test(content));
    }
    // Fallback: check if section name appears in content
    return content.includes(section.toLowerCase().replace(/_/g, ' '));
  }

  /**
   * Check if a field exists in the document
   */
  private fieldExists(content: string, field: string): boolean {
    const patterns = ROMANIAN_FIELD_PATTERNS[field];
    if (patterns) {
      return patterns.some((pattern) => pattern.test(content));
    }
    // Fallback: check if field name appears in content
    return content.includes(field.toLowerCase().replace(/_/g, ' '));
  }

  /**
   * Check if a date field exists and is properly formatted
   */
  private dateFieldExists(content: string, _dateField: string): boolean {
    // Check for any date-like patterns in the content
    const datePatterns = [
      /\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/, // DD/MM/YYYY, DD.MM.YYYY
      /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/, // YYYY/MM/DD
      /\d{1,2}\s+(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\s+\d{4}/i,
      /\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
    ];

    return datePatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Count signature blocks in document
   */
  private countSignatureBlocks(content: string): number {
    const signaturePatterns = [
      /semnătur[aă]/gi,
      /signature/gi,
      /semnat\s*de/gi,
      /signed\s*by/gi,
      /_{10,}/g, // Signature lines
      /\.{10,}/g, // Dotted signature lines
    ];

    let maxCount = 0;
    for (const pattern of signaturePatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > maxCount) {
        maxCount = matches.length;
      }
    }

    return maxCount;
  }

  /**
   * Run custom validation
   */
  private runCustomValidation(
    content: string,
    validation: CustomValidation
  ): { isValid: boolean; message?: string } {
    switch (validation.type) {
      case 'regex':
        if (validation.pattern) {
          const regex = new RegExp(validation.pattern, 'i');
          return { isValid: regex.test(content) };
        }
        return { isValid: true };

      case 'contains':
        if (validation.pattern) {
          return { isValid: content.toLowerCase().includes(validation.pattern.toLowerCase()) };
        }
        return { isValid: true };

      case 'length': {
        const isMinValid = validation.minLength ? content.length >= validation.minLength : true;
        const isMaxValid = validation.maxLength ? content.length <= validation.maxLength : true;
        return { isValid: isMinValid && isMaxValid };
      }

      case 'format':
        // Format validations would need specific implementations
        return { isValid: true };

      default:
        return { isValid: true };
    }
  }

  /**
   * Normalize document type for template lookup
   */
  private normalizeDocumentType(type: string): string {
    const typeMapping: Record<string, string> = {
      contract: 'Contract',
      'contract-vanzare-cumparare': 'VanzareCumparare',
      vanzarecumparare: 'VanzareCumparare',
      motion: 'Motion',
      intampinare: 'Intampinare',
      cerere: 'Cerere',
      letter: 'Letter',
      clientletter: 'ClientLetter',
      pleading: 'Pleading',
      procura: 'Procura',
    };

    return typeMapping[type.toLowerCase()] || type;
  }

  /**
   * Get available templates for a firm
   */
  async getAvailableTemplates(firmId?: string): Promise<string[]> {
    const templates = Object.keys(ROMANIAN_LEGAL_TEMPLATES);

    // Add any custom firm templates
    if (firmId) {
      try {
        const firm = await prisma.firm.findUnique({
          where: { id: firmId },
          select: { defaultRates: true },
        });

        if (firm?.defaultRates) {
          const rates = firm.defaultRates as Record<string, unknown>;
          const customTemplates = rates.documentTemplates as Record<string, unknown> | undefined;

          if (customTemplates) {
            const customKeys = Object.keys(customTemplates);
            for (const key of customKeys) {
              if (!templates.includes(key)) {
                templates.push(key);
              }
            }
          }
        }
      } catch (error) {
        logger.warn('Error fetching firm templates', {
          firmId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return templates.sort();
  }

  /**
   * Create or update a custom template for a firm
   */
  async saveCustomTemplate(firmId: string, template: TemplateValidationRule): Promise<void> {
    try {
      const firm = await prisma.firm.findUnique({
        where: { id: firmId },
        select: { defaultRates: true },
      });

      const rates = (firm?.defaultRates as Record<string, unknown>) || {};
      const documentTemplates = (rates.documentTemplates as Record<string, unknown>) || {};

      documentTemplates[template.documentType] = template;
      rates.documentTemplates = documentTemplates;

      await prisma.firm.update({
        where: { id: firmId },
        data: { defaultRates: JSON.parse(JSON.stringify(rates)) },
      });

      logger.info('Custom template saved', {
        firmId,
        documentType: template.documentType,
      });
    } catch (error) {
      logger.error('Failed to save custom template', {
        firmId,
        documentType: template.documentType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete a custom template
   */
  async deleteCustomTemplate(firmId: string, documentType: string): Promise<void> {
    try {
      const firm = await prisma.firm.findUnique({
        where: { id: firmId },
        select: { defaultRates: true },
      });

      if (firm?.defaultRates) {
        const rates = firm.defaultRates as Record<string, unknown>;
        const documentTemplates = rates.documentTemplates as Record<string, unknown> | undefined;

        if (documentTemplates && documentTemplates[documentType]) {
          delete documentTemplates[documentType];
          rates.documentTemplates = documentTemplates;

          await prisma.firm.update({
            where: { id: firmId },
            data: { defaultRates: JSON.parse(JSON.stringify(rates)) },
          });

          logger.info('Custom template deleted', { firmId, documentType });
        }
      }
    } catch (error) {
      logger.error('Failed to delete custom template', {
        firmId,
        documentType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get template details
   */
  getTemplateDetails(documentType: string): TemplateValidationRule | null {
    const normalizedType = this.normalizeDocumentType(documentType);
    return ROMANIAN_LEGAL_TEMPLATES[normalizedType] || null;
  }
}

// Singleton instance
export const documentTemplateValidatorService = new DocumentTemplateValidatorService();
