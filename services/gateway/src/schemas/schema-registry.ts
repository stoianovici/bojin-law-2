/**
 * Schema Registry
 *
 * Central registry for document schemas. Handles:
 * - Schema registration and storage
 * - Document type detection from name/prompt
 * - Schema lookup by ID
 */

import type { DocumentSchema, DocumentCategory } from './document-schema.types';
import logger from '../utils/logger';

// ============================================================================
// Detection Result
// ============================================================================

/**
 * Result of schema detection.
 */
export interface SchemaDetectionResult {
  /** Detected schema */
  schema: DocumentSchema;

  /** Detection confidence (0-1) */
  confidence: number;

  /** Which keywords matched */
  matchedKeywords: string[];

  /** Whether custom matcher was used */
  usedCustomMatcher: boolean;
}

// ============================================================================
// Schema Registry Class
// ============================================================================

class SchemaRegistryImpl {
  /** Map of schema ID to schema */
  private schemas: Map<string, DocumentSchema> = new Map();

  /** Default schema ID to use when no match found */
  private defaultSchemaId: string = 'generic';

  /**
   * Register a schema.
   * @param schema - The schema to register
   * @throws Error if schema with same ID already exists
   */
  register(schema: DocumentSchema): void {
    if (this.schemas.has(schema.id)) {
      throw new Error(`Schema with ID "${schema.id}" already registered`);
    }
    this.schemas.set(schema.id, schema);
    logger.debug('Schema registered', { schemaId: schema.id, category: schema.category });
  }

  /**
   * Register multiple schemas at once.
   * @param schemas - Array of schemas to register
   */
  registerAll(schemas: DocumentSchema[]): void {
    for (const schema of schemas) {
      this.register(schema);
    }
  }

  /**
   * Get a schema by ID.
   * @param id - Schema ID
   * @returns Schema or undefined if not found
   */
  get(id: string): DocumentSchema | undefined {
    return this.schemas.get(id);
  }

  /**
   * Get the default schema.
   * @returns Default schema (generic)
   */
  getDefault(): DocumentSchema {
    const defaultSchema = this.schemas.get(this.defaultSchemaId);
    if (!defaultSchema) {
      throw new Error(`Default schema "${this.defaultSchemaId}" not registered`);
    }
    return defaultSchema;
  }

  /**
   * Set the default schema ID.
   * @param id - Schema ID to use as default
   */
  setDefault(id: string): void {
    if (!this.schemas.has(id)) {
      throw new Error(`Cannot set default: schema "${id}" not registered`);
    }
    this.defaultSchemaId = id;
  }

  /**
   * Get all registered schemas.
   * @returns Array of all schemas
   */
  getAll(): DocumentSchema[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Get schemas by category.
   * @param category - Category to filter by
   * @returns Array of matching schemas
   */
  getByCategory(category: DocumentCategory): DocumentSchema[] {
    return this.getAll().filter((s) => s.category === category);
  }

  /**
   * Detect the appropriate schema for a document based on name and prompt.
   *
   * Detection algorithm:
   * 1. Try custom matchers first (highest priority)
   * 2. Score each schema based on keyword matches
   * 3. Weight by schema priority
   * 4. Return highest-scoring match or default
   *
   * @param documentName - Name of the document
   * @param prompt - User's prompt/instructions
   * @returns Detection result with schema and confidence
   */
  detect(documentName: string, prompt: string): SchemaDetectionResult {
    const textToCheck = `${documentName.toLowerCase()} ${prompt.toLowerCase()}`;
    let bestMatch: SchemaDetectionResult | null = null;

    for (const schema of this.schemas.values()) {
      // Skip generic schema in detection (it's the fallback)
      if (schema.id === 'generic') continue;

      // Try custom matcher first
      if (schema.detection.customMatcher) {
        if (schema.detection.customMatcher(documentName, prompt)) {
          const result: SchemaDetectionResult = {
            schema,
            confidence: 1.0, // Custom matcher = full confidence
            matchedKeywords: [],
            usedCustomMatcher: true,
          };

          // Custom matcher with high priority wins immediately
          if (!bestMatch || schema.detection.priority > bestMatch.schema.detection.priority) {
            bestMatch = result;
          }
          continue;
        }
      }

      // Keyword matching
      const matchedKeywords: string[] = [];
      for (const keyword of schema.detection.keywords) {
        if (textToCheck.includes(keyword.toLowerCase())) {
          matchedKeywords.push(keyword);
        }
      }

      if (matchedKeywords.length > 0) {
        // Calculate confidence based on:
        // - Number of keywords matched
        // - Proportion of total keywords matched
        // - Schema priority
        const matchRatio = matchedKeywords.length / schema.detection.keywords.length;
        const baseConfidence = Math.min(0.5 + matchRatio * 0.4, 0.9);
        const priorityBoost = schema.detection.priority * 0.01;
        const confidence = Math.min(baseConfidence + priorityBoost, 0.99);

        const result: SchemaDetectionResult = {
          schema,
          confidence,
          matchedKeywords,
          usedCustomMatcher: false,
        };

        // Compare with current best match
        if (!bestMatch) {
          bestMatch = result;
        } else {
          // Prefer higher confidence, then higher priority
          const betterConfidence = result.confidence > bestMatch.confidence;
          const sameConfidenceHigherPriority =
            result.confidence === bestMatch.confidence &&
            result.schema.detection.priority > bestMatch.schema.detection.priority;

          if (betterConfidence || sameConfidenceHigherPriority) {
            bestMatch = result;
          }
        }
      }
    }

    // If no match found, return default schema
    if (!bestMatch) {
      const defaultSchema = this.getDefault();
      bestMatch = {
        schema: defaultSchema,
        confidence: 0.1, // Low confidence for fallback
        matchedKeywords: [],
        usedCustomMatcher: false,
      };
    }

    logger.debug('Schema detection result', {
      documentName,
      promptPreview: prompt.substring(0, 50),
      detectedSchema: bestMatch.schema.id,
      confidence: bestMatch.confidence,
      matchedKeywords: bestMatch.matchedKeywords,
    });

    return bestMatch;
  }

  /**
   * Check if a schema is registered.
   * @param id - Schema ID to check
   * @returns true if registered
   */
  has(id: string): boolean {
    return this.schemas.has(id);
  }

  /**
   * Clear all registered schemas.
   * Useful for testing.
   */
  clear(): void {
    this.schemas.clear();
    this.defaultSchemaId = 'generic';
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Global schema registry instance.
 * Use this to register and lookup schemas.
 */
export const schemaRegistry = new SchemaRegistryImpl();
