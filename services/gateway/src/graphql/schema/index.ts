/**
 * GraphQL Schema Builder
 * Story 2.6: Case Management Data Model and API
 * Story 2.8.1: Billing & Rate Management (firm schema)
 * Story 2.8.2: Case Approval Workflow (approval schema, notification schema)
 * Story 2.8.3: Role-Based Financial Visibility (directive support)
 * Story 2.10: Basic AI Search Implementation (search schema)
 * Story 2.11.3: Financial KPIs Backend Service (financial-kpis schema)
 * Story 3.3: Intelligent Document Drafting (document-drafting schema)
 * Story 3.6: Document Review and Approval Workflow (document-review schema)
 * Story 3.7: AI Document Intelligence Dashboard (document-intelligence schema)
 * Story 3.8: Document System Testing and Performance (performance-metrics schema)
 * Story 4.3: Time Estimation & Manual Time Logging (time-entry schema)
 * Story 4.4: Task Dependencies and Automation (task-template, task-dependency schemas)
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
  const documentDraftingSchema = readFileSync(
    join(schemaDir, 'document-drafting.graphql'),
    'utf-8'
  );
  const wordIntegrationSchema = readFileSync(join(schemaDir, 'word-integration.graphql'), 'utf-8');
  const semanticVersionControlSchema = readFileSync(
    join(schemaDir, 'semantic-version-control.graphql'),
    'utf-8'
  );
  const documentReviewSchema = readFileSync(join(schemaDir, 'document-review.graphql'), 'utf-8');
  const documentIntelligenceSchema = readFileSync(
    join(schemaDir, 'document-intelligence.graphql'),
    'utf-8'
  );
  const performanceMetricsSchema = readFileSync(
    join(schemaDir, 'performance-metrics.graphql'),
    'utf-8'
  );
  // Story 4.1: Natural Language Task Parser
  const taskParserSchema = readFileSync(join(schemaDir, 'task-parser.graphql'), 'utf-8');
  // Story 4.2: Task Type System Implementation
  const taskSchema = readFileSync(join(schemaDir, 'task.graphql'), 'utf-8');
  // Story 4.3: Time Estimation & Manual Time Logging
  const timeEntrySchema = readFileSync(join(schemaDir, 'time-entry.graphql'), 'utf-8');
  // Story 4.4: Task Dependencies and Automation
  const taskTemplateSchema = readFileSync(join(schemaDir, 'task-template.graphql'), 'utf-8');
  const taskDependencySchema = readFileSync(join(schemaDir, 'task-dependency.graphql'), 'utf-8');
  // Story 4.5: Team Workload Management
  const workloadManagementSchema = readFileSync(
    join(schemaDir, 'workload-management.graphql'),
    'utf-8'
  );
  // Story 4.6: Task Collaboration and Updates
  const taskCollaborationSchema = readFileSync(
    join(schemaDir, 'task-collaboration.graphql'),
    'utf-8'
  );
  // Story 4.7: Task Analytics and Optimization
  const taskAnalyticsSchema = readFileSync(join(schemaDir, 'task-analytics.graphql'), 'utf-8');
  // Dynamic case types per firm
  const caseTypeSchema = readFileSync(join(schemaDir, 'case-type.graphql'), 'utf-8');
  // Story 5.1: Email Integration and Synchronization
  const emailSchema = readFileSync(join(schemaDir, 'email.graphql'), 'utf-8');
  // Story 5.2: Communication Intelligence Engine
  const communicationIntelligenceSchema = readFileSync(
    join(schemaDir, 'communication-intelligence.graphql'),
    'utf-8'
  );
  // Story 5.3: AI-Powered Email Drafting
  const emailDraftingSchema = readFileSync(join(schemaDir, 'email-drafting.graphql'), 'utf-8');
  // Story 5.4: Proactive AI Suggestions - may already exist
  const proactiveSuggestionsSchema = readFileSync(
    join(schemaDir, 'proactive-suggestions.graphql'),
    'utf-8'
  );
  // Story 5.5: Multi-Channel Communication Hub - may already exist
  const communicationHubSchema = readFileSync(
    join(schemaDir, 'communication-hub.graphql'),
    'utf-8'
  );
  // Story 5.6: AI Learning and Personalization
  const aiLearningSchema = readFileSync(join(schemaDir, 'ai-learning.graphql'), 'utf-8');
  // Story 5.7: Platform Intelligence Dashboard
  const platformIntelligenceSchema = readFileSync(
    join(schemaDir, 'platform-intelligence.graphql'),
    'utf-8'
  );
  // Story 1.5: Natural Language Commands (QuickActionsBar)
  const naturalLanguageCommandsSchema = readFileSync(
    join(schemaDir, 'natural-language-commands.graphql'),
    'utf-8'
  );
  // OPS-022: Email-to-Case Timeline Integration
  const emailImportSchema = readFileSync(join(schemaDir, 'email-import.graphql'), 'utf-8');
  // OPS-028: Classification Metadata UI
  const globalEmailSourcesSchema = readFileSync(
    join(schemaDir, 'global-email-sources.graphql'),
    'utf-8'
  );
  // OPS-029: AI Email Classification Service
  const emailClassificationSchema = readFileSync(
    join(schemaDir, 'email-classification.graphql'),
    'utf-8'
  );
  // OPS-031: Classification Review & Correction
  const classificationReviewSchema = readFileSync(
    join(schemaDir, 'classification-review.graphql'),
    'utf-8'
  );
  // OPS-046-050: Persistent AI Case Summary
  const caseSummarySchema = readFileSync(join(schemaDir, 'case-summary.graphql'), 'utf-8');
  // OPS-063-080: Interactive AI Assistant
  const aiAssistantSchema = readFileSync(join(schemaDir, 'ai-assistant.graphql'), 'utf-8');
  // OPS-089: Document Folder Structure
  const documentFolderSchema = readFileSync(join(schemaDir, 'document-folder.graphql'), 'utf-8');
  // OPS-101: Mapa (Document Binder) Management
  const mapaSchema = readFileSync(join(schemaDir, 'mapa.graphql'), 'utf-8');
  // OPS-154: Predefined Reports with AI Insights
  const reportsSchema = readFileSync(join(schemaDir, 'reports.graphql'), 'utf-8');
  // OPS-190: Personal Contacts Blocklist
  const personalContactSchema = readFileSync(join(schemaDir, 'personal-contact.graphql'), 'utf-8');
  // OPS-221: Dynamic Actor Types
  const actorTypeSchema = readFileSync(join(schemaDir, 'actor-type.graphql'), 'utf-8');
  // OPS-226: Client Portfolio View
  const clientSchema = readFileSync(join(schemaDir, 'client.graphql'), 'utf-8');
  // OPS-241: AI Ops Dashboard
  const aiOpsSchema = readFileSync(join(schemaDir, 'ai-ops.graphql'), 'utf-8');
  // OPS-272: Team Activity View Mode
  const teamActivitySchema = readFileSync(join(schemaDir, 'team-activity.graphql'), 'utf-8');
  // Team Chat
  const teamChatSchema = readFileSync(join(schemaDir, 'team-chat.graphql'), 'utf-8');
  // OPS-298: Mobile Home Brief Feed
  const briefSchema = readFileSync(join(schemaDir, 'brief.graphql'), 'utf-8');
  // Mobile: Case Notes
  const caseNotesSchema = readFileSync(join(schemaDir, 'case-notes.graphql'), 'utf-8');
  // Global Settings: User Preferences
  const userPreferencesSchema = readFileSync(join(schemaDir, 'user-preferences.graphql'), 'utf-8');
  // Global Settings: Team Access Management
  const teamAccessSchema = readFileSync(join(schemaDir, 'team-access.graphql'), 'utf-8');
  // Case History: AI-Generated Chapters
  const caseChaptersSchema = readFileSync(join(schemaDir, 'case-chapters.graphql'), 'utf-8');

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
    documentDraftingSchema,
    wordIntegrationSchema,
    semanticVersionControlSchema,
    documentReviewSchema,
    documentIntelligenceSchema,
    performanceMetricsSchema,
    taskParserSchema,
    taskSchema,
    timeEntrySchema,
    taskTemplateSchema,
    taskDependencySchema,
    workloadManagementSchema,
    taskCollaborationSchema,
    taskAnalyticsSchema,
    caseTypeSchema,
    emailSchema,
    communicationIntelligenceSchema,
    emailDraftingSchema,
    proactiveSuggestionsSchema,
    communicationHubSchema,
    aiLearningSchema,
    platformIntelligenceSchema,
    naturalLanguageCommandsSchema,
    emailImportSchema,
    globalEmailSourcesSchema,
    emailClassificationSchema,
    classificationReviewSchema,
    caseSummarySchema,
    aiAssistantSchema,
    documentFolderSchema,
    mapaSchema,
    reportsSchema,
    personalContactSchema,
    actorTypeSchema,
    clientSchema,
    aiOpsSchema,
    teamActivitySchema,
    teamChatSchema,
    briefSchema,
    caseNotesSchema,
    userPreferencesSchema,
    teamAccessSchema,
    caseChaptersSchema,
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
