/**
 * Romanian Document Generator Service
 * Story 2.12.1 - Task 6: Template Integration
 *
 * Integrates Romanian legal templates with Document Drafting skill
 * Provides variable substitution and document generation
 */

// Romanian templates are now available as a shared package
import {
  ROMANIAN_TEMPLATES,
  getTemplate,
  getAvailableTemplates,
  getTemplateMetadata,
  type RomanianTemplateSlug,
} from '@legal-platform/romanian-templates';

export interface DocumentGenerationRequest {
  templateSlug: RomanianTemplateSlug;
  variables: Record<string, string>;
  format?: 'markdown' | 'html' | 'plain';
}

export interface DocumentGenerationResponse {
  success: boolean;
  document?: string;
  metadata?: ReturnType<typeof getTemplateMetadata>;
  errors?: string[];
  warnings?: string[];
}

export interface TemplateValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Romanian Document Generator Service
 * Handles generation, validation, and management of Romanian legal documents
 */
export class RomanianDocumentGeneratorService {
  /**
   * Generate a Romanian legal document from template
   */
  async generateDocument(
    request: DocumentGenerationRequest
  ): Promise<DocumentGenerationResponse> {
    try {
      const { templateSlug, variables, format = 'markdown' } = request;

      // Get template
      const template = getTemplate(templateSlug);
      if (!template) {
        return {
          success: false,
          errors: [`Template not found: ${templateSlug}`],
        };
      }

      // Validate variables
      const validation = template.validate(variables);
      if (!validation.valid) {
        return {
          success: false,
          errors: [`Missing required variables: ${validation.missing.join(', ')}`],
        };
      }

      // Generate document
      const document = template.generate(variables);

      // Get metadata
      const metadata = getTemplateMetadata(templateSlug);

      // Convert format if needed
      const formattedDocument = this.convertFormat(document, format);

      return {
        success: true,
        document: formattedDocument,
        metadata,
        warnings: this.generateWarnings(templateSlug, variables),
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Validate template variables without generating document
   */
  validateVariables(
    templateSlug: RomanianTemplateSlug,
    variables: Record<string, string>
  ): TemplateValidationResult {
    try {
      const template = getTemplate(templateSlug);
      const validation = template.validate(variables);

      return {
        valid: validation.valid,
        missing: validation.missing,
        warnings: this.generateWarnings(templateSlug, variables),
      };
    } catch (error) {
      return {
        valid: false,
        missing: [],
        warnings: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Get all available Romanian templates
   */
  getAvailableTemplates(): Array<{
    slug: RomanianTemplateSlug;
    metadata: ReturnType<typeof getTemplateMetadata>;
  }> {
    const slugs = getAvailableTemplates();
    return slugs.map((slug) => ({
      slug,
      metadata: getTemplateMetadata(slug),
    }));
  }

  /**
   * Get template metadata by slug
   */
  getTemplateInfo(templateSlug: RomanianTemplateSlug) {
    return getTemplateMetadata(templateSlug);
  }

  /**
   * Search templates by criteria
   */
  searchTemplates(criteria: {
    category?: string;
    complexity?: string;
    language?: string;
  }): Array<{
    slug: RomanianTemplateSlug;
    metadata: ReturnType<typeof getTemplateMetadata>;
  }> {
    const allTemplates = this.getAvailableTemplates();

    return allTemplates.filter((template) => {
      const { metadata } = template;

      if (criteria.category && metadata.legalCategory !== criteria.category) {
        return false;
      }

      if (criteria.complexity && metadata.complexity !== criteria.complexity) {
        return false;
      }

      if (criteria.language && metadata.primaryLanguage !== criteria.language) {
        return false;
      }

      return true;
    });
  }

  /**
   * Convert document format
   */
  private convertFormat(document: string, format: 'markdown' | 'html' | 'plain'): string {
    switch (format) {
      case 'markdown':
        return document; // Already in markdown

      case 'plain':
        // Strip markdown formatting for plain text
        return document
          .replace(/#{1,6}\s/g, '') // Remove headers
          .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.+?)\*/g, '$1') // Remove italic
          .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
          .replace(/`(.+?)`/g, '$1'); // Remove code

      case 'html':
        // Basic markdown to HTML conversion
        return document
          .replace(/#{6}\s(.+)/g, '<h6>$1</h6>')
          .replace(/#{5}\s(.+)/g, '<h5>$1</h5>')
          .replace(/#{4}\s(.+)/g, '<h4>$1</h4>')
          .replace(/#{3}\s(.+)/g, '<h3>$1</h3>')
          .replace(/#{2}\s(.+)/g, '<h2>$1</h2>')
          .replace(/#{1}\s(.+)/g, '<h1>$1</h1>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/\n\n/g, '</p><p>')
          .replace(/^/, '<p>')
          .replace(/$/, '</p>');

      default:
        return document;
    }
  }

  /**
   * Generate warnings for template usage
   */
  private generateWarnings(
    templateSlug: RomanianTemplateSlug,
    variables: Record<string, string>
  ): string[] {
    const warnings: string[] = [];
    const metadata = getTemplateMetadata(templateSlug);

    // Check for legal requirements based on template type
    if (templateSlug === 'notificare-avocateasca') {
      if (!variables.TERMEN_CONFORMARE) {
        warnings.push('Consider specifying a compliance deadline (TERMEN_CONFORMARE)');
      }
      warnings.push('This notice must be sent via registered mail with return receipt');
    }

    if (templateSlug === 'contract-vanzare-cumparare') {
      if (!variables.CLAUZA_TVA) {
        warnings.push('Consider adding VAT clause if applicable');
      }
      if (!variables.PENALITATE_PROCENT) {
        warnings.push('Consider adding late payment penalties');
      }
    }

    if (templateSlug === 'intampinare') {
      warnings.push('Statement of Defense must be filed within 25 days of service');
      warnings.push('Requires attorney signature and bar stamp');
      if (!variables.AVOCAT_PARAT_NUME) {
        warnings.push('Defense attorney name is required for court filings');
      }
    }

    // General warnings
    warnings.push('This is a template starting point - legal review recommended');

    if (metadata.complexity === 'high') {
      warnings.push('This is a complex template - attorney review strongly recommended');
    }

    return warnings;
  }

  /**
   * Estimate time savings for using template
   */
  estimateTimeSavings(templateSlug: RomanianTemplateSlug): {
    manualDraftingTime: string;
    templateTime: string;
    savings: string;
  } {
    const metadata = getTemplateMetadata(templateSlug);

    // Estimate based on average document length and complexity
    let manualMinutes = 60; // Base time

    if (metadata.averageLength) {
      manualMinutes = metadata.averageLength * 30; // 30 minutes per page
    }

    if (metadata.complexity === 'high') {
      manualMinutes *= 1.5;
    } else if (metadata.complexity === 'low') {
      manualMinutes *= 0.7;
    }

    const templateMinutes = 10; // Time to fill in template
    const savingsMinutes = manualMinutes - templateMinutes;

    return {
      manualDraftingTime: `${Math.round(manualMinutes)} minutes`,
      templateTime: `${templateMinutes} minutes`,
      savings: `${Math.round(savingsMinutes)} minutes (${Math.round((savingsMinutes / manualMinutes) * 100)}%)`,
    };
  }
}

/**
 * Singleton instance
 */
export const romanianDocumentGenerator = new RomanianDocumentGeneratorService();

/**
 * Convenience exports
 */
export { ROMANIAN_TEMPLATES, getTemplate, getAvailableTemplates, getTemplateMetadata };
export type { RomanianTemplateSlug };
