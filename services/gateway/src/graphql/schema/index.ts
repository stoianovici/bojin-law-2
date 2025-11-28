/**
 * GraphQL Schema Builder
 * Story 2.6: Case Management Data Model and API
 * Story 2.8.1: Billing & Rate Management (firm schema)
 * Story 2.8.2: Case Approval Workflow (approval schema, notification schema)
 * Story 2.8.3: Role-Based Financial Visibility (directive support)
 * Story 2.10: Basic AI Search Implementation (search schema)
 * Story 2.11.3: Financial KPIs Backend Service (financial-kpis schema)
 * Story 3.1: AI Service Infrastructure (ai-monitoring schema)
 * Story 3.3: Intelligent Document Drafting (document-drafting schema)
 *
 * Loads and merges all GraphQL schema files and applies directives
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLSchema } from 'graphql';
import { requiresFinancialAccessDirective, requiresFinancialAccessTypeDefs } from '../directives';

/**
 * Load GraphQL schema type definitions (string)
 * Used by Apollo Server
 */
export function loadSchema(): string {
  const schemaDir = __dirname;

  // Load all schema files
  const scalars = readFileSync(join(schemaDir, 'scalars.graphql'), 'utf-8');
  const enums = readFileSync(join(schemaDir, 'enums.graphql'), 'utf-8');
  const firmSchema = readFileSync(join(schemaDir, 'firm.graphql'), 'utf-8');
  const caseSchema = readFileSync(join(schemaDir, 'case.graphql'), 'utf-8');
  const approvalSchema = readFileSync(join(schemaDir, 'approval.graphql'), 'utf-8');
  const notificationSchema = readFileSync(join(schemaDir, 'notification.graphql'), 'utf-8');
  const documentSchema = readFileSync(join(schemaDir, 'document.graphql'), 'utf-8');
  const searchSchema = readFileSync(join(schemaDir, 'search.graphql'), 'utf-8');
  const financialKpisSchema = readFileSync(join(schemaDir, 'financial-kpis.graphql'), 'utf-8');
  const aiMonitoringSchema = readFileSync(join(schemaDir, 'ai-monitoring.graphql'), 'utf-8');
  const documentDraftingSchema = readFileSync(
    join(schemaDir, 'document-drafting.graphql'),
    'utf-8'
  );

  // Include directive definitions
  const directives = requiresFinancialAccessTypeDefs;

  // Merge all schemas
  return [
    scalars,
    enums,
    directives,
    firmSchema,
    caseSchema,
    approvalSchema,
    notificationSchema,
    documentSchema,
    searchSchema,
    financialKpisSchema,
    aiMonitoringSchema,
    documentDraftingSchema,
  ].join('\n\n');
}

/**
 * Build executable schema with directives applied
 * This transforms the schema to apply directive logic
 *
 * @param typeDefs - GraphQL type definitions (from loadSchema())
 * @param resolvers - GraphQL resolvers
 * @returns Executable schema with directives applied
 */
export function buildExecutableSchema(typeDefs: string, resolvers: any): GraphQLSchema {
  // Create base schema
  let schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  // Apply directive transformers
  schema = requiresFinancialAccessDirective()(schema);

  return schema;
}
