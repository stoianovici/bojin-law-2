/**
 * Schema-Driven Document Formatting System
 *
 * This module provides a unified approach to document generation:
 * - Pre-generation: Schema detection and prompt injection
 * - Post-generation: Validation against schema requirements
 * - Normalization: Schema-driven HTML transformation
 *
 * Usage:
 * ```typescript
 * import {
 *   schemaRegistry,
 *   promptInjector,
 *   schemaValidator,
 *   createSchemaNormalizer,
 *   initializeBuiltinSchemas,
 * } from './schemas';
 *
 * // At app startup
 * initializeBuiltinSchemas();
 *
 * // Detect schema from document name/prompt
 * const { schema } = schemaRegistry.detect(documentName, userPrompt);
 *
 * // Build prompts with schema requirements
 * const { systemPrompt, userPrompt } = promptInjector.build(schema, options);
 *
 * // After AI generation, validate
 * const validation = schemaValidator.validate(content, schema);
 *
 * // Normalize for OOXML conversion
 * const normalizer = createSchemaNormalizer(schema);
 * const normalizedHtml = normalizer.normalize(content);
 * ```
 */

// Types
export type {
  DocumentSchema,
  DocumentCategory,
  DetectionConfig,
  SectionDefinition,
  HeadingHierarchyConfig,
  CitationConfig,
  StructureConfig,
  TypographyConfig,
  CalloutStyleConfig,
  PaginationConfig,
  CoverPageConfig,
  FormattingConfig,
  FixStrategy,
  ValidationSeverity,
  ValidationRule,
  ValidationRuleResult,
  ValidationConfig,
  NormalizationRuleId,
  NormalizationConfig,
  PromptConfig,
  ValidationError,
  ValidationWarning,
  SchemaValidationResult,
} from './document-schema.types';

// Registry
export { schemaRegistry, type SchemaDetectionResult } from './schema-registry';

// Builtin Schemas
export {
  researchSchema,
  notificareSchema,
  courtFilingSchema,
  contractSchema,
  genericSchema,
  BUILTIN_SCHEMAS,
  initializeBuiltinSchemas,
} from './builtin-schemas';

// Prompt Injector
export {
  promptInjector,
  PromptInjector,
  type PromptBuildOptions,
  type BuiltPrompt,
} from './prompt-injector';

// Validator
export { schemaValidator, SchemaValidator } from './schema-validator';

// Normalizer
export { SchemaNormalizer, createSchemaNormalizer, type ParsedSource } from './schema-normalizer';

// Import for auto-initialization
import { initializeBuiltinSchemas as init } from './builtin-schemas';

// Auto-initialize schemas on module load
init();
