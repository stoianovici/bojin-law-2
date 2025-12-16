/**
 * Romanian Legal Templates - Index
 * Story 2.12.1 - Task 5: Romanian Templates
 *
 * Central export point for all Romanian legal document templates
 */

export * from './notificare-avocateasca.template';
export * from './contract-vanzare-cumparare.template';
export * from './intampinare.template';
export * from './somatie-plata.template';
export * from './cerere-chemare-judecata.template';

import {
  NotificareAvocateascaTemplate,
  generateNotificareAvocateasca,
  validateNotificareVariables,
} from './notificare-avocateasca.template';

import {
  ContractVanzareCumparareTemplate,
  generateContractVanzareCumparare,
  validateContractVariables,
} from './contract-vanzare-cumparare.template';

import {
  IntampinareTemplate,
  generateIntampinare,
  validateIntampinareVariables,
} from './intampinare.template';

import {
  somatiePlataMetadata,
  generateSomatiePlata,
  validateSomatiePlata,
} from './somatie-plata.template';

import {
  cerereChemareJudecataMetadata,
  generateCerereChemareJudecata,
  validateCerereChemareJudecata,
} from './cerere-chemare-judecata.template';

/**
 * Template Registry - All available Romanian legal templates
 */
export const ROMANIAN_TEMPLATES = {
  'notificare-avocateasca': {
    definition: NotificareAvocateascaTemplate,
    generate: generateNotificareAvocateasca,
    validate: validateNotificareVariables,
  },
  'contract-vanzare-cumparare': {
    definition: ContractVanzareCumparareTemplate,
    generate: generateContractVanzareCumparare,
    validate: validateContractVariables,
  },
  intampinare: {
    definition: IntampinareTemplate,
    generate: generateIntampinare,
    validate: validateIntampinareVariables,
  },
  'somatie-plata': {
    definition: { metadata: somatiePlataMetadata },
    generate: generateSomatiePlata,
    validate: validateSomatiePlata,
  },
  'cerere-chemare-judecata': {
    definition: { metadata: cerereChemareJudecataMetadata },
    generate: generateCerereChemareJudecata,
    validate: validateCerereChemareJudecata,
  },
} as const;

export type RomanianTemplateSlug = keyof typeof ROMANIAN_TEMPLATES;

/**
 * Get template by slug
 */
export function getTemplate(slug: RomanianTemplateSlug): {
  definition: any; // Mixed structure - first 3 templates have full definition, last 2 have metadata wrapper
  generate: (variables: Record<string, string>) => string;
  validate: (variables: Record<string, string>) => { valid: boolean; missing: string[] };
} {
  const template = ROMANIAN_TEMPLATES[slug];
  if (!template) {
    throw new Error(`Template not found: ${slug}`);
  }
  // @ts-ignore - Mixed template structures, handled by getTemplateMetadata
  return template;
}

/**
 * Get all available template slugs
 */
export function getAvailableTemplates(): RomanianTemplateSlug[] {
  return Object.keys(ROMANIAN_TEMPLATES) as RomanianTemplateSlug[];
}

/**
 * Get template metadata
 */
export function getTemplateMetadata(slug: RomanianTemplateSlug) {
  const template = getTemplate(slug);
  const metadata = template.definition.metadata;

  // Ensure all metadata has required fields
  return {
    ...metadata,
    primaryLanguage: metadata.primaryLanguage || 'ro',
    templateSlug: metadata.templateSlug || slug,
  };
}

/**
 * Search templates by category
 */
export function getTemplatesByCategory(category: string): RomanianTemplateSlug[] {
  return getAvailableTemplates().filter((slug) => {
    const template = getTemplate(slug);
    return template.definition.metadata.legalCategory === category;
  });
}
