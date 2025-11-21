/**
 * GraphQL Schema Builder
 * Story 2.6: Case Management Data Model and API
 *
 * Loads and merges all GraphQL schema files
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Load GraphQL schema files and merge them
 */
export function loadSchema(): string {
  const schemaDir = __dirname;

  // Load all schema files
  const scalars = readFileSync(join(schemaDir, 'scalars.graphql'), 'utf-8');
  const enums = readFileSync(join(schemaDir, 'enums.graphql'), 'utf-8');
  const caseSchema = readFileSync(join(schemaDir, 'case.graphql'), 'utf-8');

  // Merge all schemas
  return [scalars, enums, caseSchema].join('\n\n');
}
