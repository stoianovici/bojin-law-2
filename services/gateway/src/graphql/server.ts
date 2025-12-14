/**
 * Apollo Server Setup
 * Story 2.6: Case Management Data Model and API
 * Story 2.8.1: Billing & Rate Management (firm resolvers)
 * Story 2.8.2: Case Approval Workflow (approval resolvers, notification resolvers)
 * Story 2.8.3: Role-Based Financial Visibility (directive support)
 * Story 2.8.4: Cross-Case Document Linking (document resolvers)
 * Story 2.10: Basic AI Search Implementation (search resolvers)
 * Story 2.11.1: Business Owner Role & Financial Data Scope
 * Story 2.11.3: Financial KPIs Backend Service (financialKPIs resolvers)
 * Story 3.6: Document Review and Approval Workflow (document-review resolvers)
 * Story 3.7: AI Document Intelligence Dashboard (document-intelligence resolvers)
 * Story 3.8: Document System Testing and Performance (performance-metrics resolvers)
 * Story 4.1: Natural Language Task Parser (task-parser resolvers)
 * Story 4.3: Time Estimation & Manual Time Logging (time-entry resolvers)
 * Story 4.4: Task Dependencies and Automation (task-template, task-dependency resolvers)
 * Story 5.6: AI Learning and Personalization (ai-learning resolvers)
 */

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import type { Request, RequestHandler } from 'express';
import { DateTimeResolver, JSONResolver, UUIDResolver } from 'graphql-scalars';
import http from 'http';
import { approvalResolvers } from './resolvers/approval.resolvers';
import { caseResolvers, type Context } from './resolvers/case.resolvers';
import { documentResolvers } from './resolvers/document.resolvers';
import { firmResolvers } from './resolvers/firm.resolvers';
import { notificationResolvers } from './resolvers/notification.resolvers';
import { searchResolvers } from './resolvers/search.resolvers';
import { financialKPIsResolvers } from './resolvers/financial-kpis.resolvers';
import { documentReviewResolvers } from './resolvers/document-review.resolvers';
import { documentIntelligenceResolvers } from './resolvers/document-intelligence.resolvers';
import { performanceMetricsResolvers } from './resolvers/performance-metrics.resolvers';
import { taskParserResolvers } from './resolvers/task-parser.resolvers';
import { taskResolvers } from './resolvers/task.resolvers';
import { timeEntryResolvers } from './resolvers/time-entry.resolvers';
import { taskTemplateResolvers } from './resolvers/task-template.resolvers';
import { taskDependencyResolvers } from './resolvers/task-dependency.resolvers';
import { workloadManagementResolvers } from './resolvers/workload-management.resolvers';
import { taskCollaborationResolvers } from './resolvers/task-collaboration.resolvers';
import { taskAnalyticsResolvers } from './resolvers/task-analytics.resolvers';
import { caseTypeResolvers } from './resolvers/case-type.resolvers';
import { communicationIntelligenceResolvers } from './resolvers/communication-intelligence.resolvers';
import { communicationHubResolvers } from './resolvers/communication-hub.resolvers';
import { emailDraftingResolvers } from './resolvers/email-drafting.resolvers';
import { emailResolvers } from './resolvers/email.resolvers';
import { aiLearningResolvers } from './resolvers/ai-learning.resolvers';
import { platformIntelligenceResolvers } from './resolvers/platform-intelligence.resolvers';
import { naturalLanguageCommandsResolvers } from './resolvers/natural-language-commands.resolvers';
import { emailImportResolvers } from './resolvers/email-import.resolvers';
import { buildExecutableSchema, loadSchema } from './schema';
import type { FinancialDataScope } from './resolvers/utils/financialDataScope';

/**
 * Determine financial data scope based on user role
 * Story 2.11.1: BusinessOwner gets 'firm' scope, Partner gets 'own' scope
 */
function getFinancialDataScopeFromRole(role: string | undefined): FinancialDataScope | null {
  if (role === 'BusinessOwner') return 'firm';
  if (role === 'Partner') return 'own';
  return null;
}

// Merge all resolvers
const resolvers = {
  DateTime: DateTimeResolver,
  UUID: UUIDResolver,
  JSON: JSONResolver,
  Query: {
    ...caseResolvers.Query,
    ...firmResolvers.Query,
    ...approvalResolvers.Query,
    ...notificationResolvers.Query,
    ...documentResolvers.Query,
    ...searchResolvers.Query,
    ...financialKPIsResolvers.Query,
    ...documentReviewResolvers.Query,
    ...documentIntelligenceResolvers.Query,
    ...performanceMetricsResolvers.Query,
    ...taskParserResolvers.Query,
    ...taskResolvers.Query,
    ...timeEntryResolvers.Query,
    ...taskTemplateResolvers.Query,
    ...taskDependencyResolvers.Query,
    ...workloadManagementResolvers.Query,
    ...taskCollaborationResolvers.Query,
    ...taskAnalyticsResolvers.Query,
    ...caseTypeResolvers.Query,
    ...communicationIntelligenceResolvers.Query,
    ...communicationHubResolvers.Query,
    ...emailDraftingResolvers.Query,
    ...emailResolvers.Query,
    ...aiLearningResolvers.Query,
    ...platformIntelligenceResolvers.Query,
    ...emailImportResolvers.Query,
  },
  Mutation: {
    ...caseResolvers.Mutation,
    ...firmResolvers.Mutation,
    ...approvalResolvers.Mutation,
    ...notificationResolvers.Mutation,
    ...documentResolvers.Mutation,
    ...documentReviewResolvers.Mutation,
    ...performanceMetricsResolvers.Mutation,
    ...taskParserResolvers.Mutation,
    ...taskResolvers.Mutation,
    ...timeEntryResolvers.Mutation,
    ...taskTemplateResolvers.Mutation,
    ...taskDependencyResolvers.Mutation,
    ...workloadManagementResolvers.Mutation,
    ...taskCollaborationResolvers.Mutation,
    ...taskAnalyticsResolvers.Mutation,
    ...caseTypeResolvers.Mutation,
    ...communicationIntelligenceResolvers.Mutation,
    ...communicationHubResolvers.Mutation,
    ...emailDraftingResolvers.Mutation,
    ...emailResolvers.Mutation,
    ...aiLearningResolvers.Mutation,
    ...platformIntelligenceResolvers.Mutation,
    ...naturalLanguageCommandsResolvers.Mutation,
    ...emailImportResolvers.Mutation,
  },
  Subscription: {
    ...emailResolvers.Subscription,
  },
  // Enum resolvers for analytics
  ...(taskAnalyticsResolvers.TrendDirection && {
    TrendDirection: taskAnalyticsResolvers.TrendDirection,
  }),
  ...(taskAnalyticsResolvers.TrendDirectionSimple && {
    TrendDirectionSimple: taskAnalyticsResolvers.TrendDirectionSimple,
  }),
  ...(taskAnalyticsResolvers.VelocityInterval && {
    VelocityInterval: taskAnalyticsResolvers.VelocityInterval,
  }),
  ...(taskAnalyticsResolvers.ImpactLevel && { ImpactLevel: taskAnalyticsResolvers.ImpactLevel }),
  ...(taskAnalyticsResolvers.BottleneckType && {
    BottleneckType: taskAnalyticsResolvers.BottleneckType,
  }),
  ...(taskAnalyticsResolvers.TrainingPriority && {
    TrainingPriority: taskAnalyticsResolvers.TrainingPriority,
  }),
  ...(taskAnalyticsResolvers.WorkerStatus && { WorkerStatus: taskAnalyticsResolvers.WorkerStatus }),
  // Platform Intelligence enum resolvers (Story 5.7)
  ...(platformIntelligenceResolvers.EmailRecipientType && {
    EmailRecipientType: platformIntelligenceResolvers.EmailRecipientType,
  }),
  ...(platformIntelligenceResolvers.AIFeatureType && {
    AIFeatureType: platformIntelligenceResolvers.AIFeatureType,
  }),
  ...(platformIntelligenceResolvers.RecommendationCategory && {
    RecommendationCategory: platformIntelligenceResolvers.RecommendationCategory,
  }),
  ...(platformIntelligenceResolvers.RecommendationPriority && {
    RecommendationPriority: platformIntelligenceResolvers.RecommendationPriority,
  }),
  ...(platformIntelligenceResolvers.ExportFormat && {
    ExportFormat: platformIntelligenceResolvers.ExportFormat,
  }),
  Case: caseResolvers.Case,
  Firm: firmResolvers.Firm,
  CaseApproval: approvalResolvers.CaseApproval,
  Notification: notificationResolvers.Notification,
  Document: documentResolvers.Document,
  DocumentAuditLog: documentResolvers.DocumentAuditLog,
  // Search resolvers (Story 2.10)
  SearchResult: searchResolvers.SearchResult,
  CaseSearchResult: searchResolvers.CaseSearchResult,
  DocumentSearchResult: searchResolvers.DocumentSearchResult,
  ClientSearchResult: searchResolvers.ClientSearchResult,
  // Document Review resolvers (Story 3.6)
  DocumentReview: documentReviewResolvers.DocumentReview,
  ReviewComment: documentReviewResolvers.ReviewComment,
  ReviewCommentReply: documentReviewResolvers.ReviewCommentReply,
  ReviewHistoryEntry: documentReviewResolvers.ReviewHistoryEntry,
  // Task resolvers (Story 4.2)
  Task: taskResolvers.Task,
  TaskAttendee: taskResolvers.TaskAttendee,
  TaskDocumentLink: taskResolvers.TaskDocumentLink,
  TaskDelegation: taskResolvers.TaskDelegation,
  // Time Entry resolvers (Story 4.3)
  TimeEntry: timeEntryResolvers.TimeEntry,
  WeeklySummary: timeEntryResolvers.WeeklySummary,
  DailySummary: timeEntryResolvers.DailySummary,
  // Task Template and Dependency resolvers (Story 4.4)
  TaskTemplate: taskTemplateResolvers.TaskTemplate,
  TaskTemplateStep: taskTemplateResolvers.TaskTemplateStep,
  TaskDependency: taskDependencyResolvers.TaskDependency,
  ParallelTaskGroup: taskDependencyResolvers.ParallelTaskGroup,
  AssigneeSuggestion: taskDependencyResolvers.AssigneeSuggestion, // Story 4.4: Parallel task suggestions
  // Workload Management resolvers (Story 4.5)
  UserAvailability: workloadManagementResolvers.UserAvailability,
  UserWorkload: workloadManagementResolvers.UserWorkload,
  TeamCalendarEntry: workloadManagementResolvers.TeamCalendarEntry,
  TeamMemberCalendar: workloadManagementResolvers.TeamMemberCalendar,
  AssignmentSuggestion: workloadManagementResolvers.AssignmentSuggestion, // Story 4.5: Workload-based suggestions
  CapacityBottleneck: workloadManagementResolvers.CapacityBottleneck,
  // Task Collaboration resolvers (Story 4.6)
  TaskComment: taskCollaborationResolvers.TaskComment,
  TaskHistoryEntry: taskCollaborationResolvers.TaskHistoryEntry,
  CaseActivityEntry: taskCollaborationResolvers.CaseActivityEntry,
  TaskAttachment: taskCollaborationResolvers.TaskAttachment,
  CaseSubscription: taskCollaborationResolvers.CaseSubscription,
  SubtaskWithContext: taskCollaborationResolvers.SubtaskWithContext,
  // Case Type Config resolvers
  CaseTypeConfig: caseTypeResolvers.CaseTypeConfig,
  // Communication Intelligence resolvers (Story 5.2)
  ExtractedDeadline: communicationIntelligenceResolvers.ExtractedDeadline,
  ExtractedCommitment: communicationIntelligenceResolvers.ExtractedCommitment,
  ExtractedActionItem: communicationIntelligenceResolvers.ExtractedActionItem,
  ExtractedQuestion: communicationIntelligenceResolvers.ExtractedQuestion,
  RiskIndicator: communicationIntelligenceResolvers.RiskIndicator,
  ThreadSummary: communicationIntelligenceResolvers.ThreadSummary,
  // Email Drafting resolvers (Story 5.3)
  EmailDraft: emailDraftingResolvers.EmailDraft,
  AttachmentSuggestion: emailDraftingResolvers.AttachmentSuggestion,
  EmailTone: emailDraftingResolvers.EmailTone,
  RecipientType: emailDraftingResolvers.RecipientType,
  DraftStatus: emailDraftingResolvers.DraftStatus,
  InlineSuggestionType: emailDraftingResolvers.InlineSuggestionType,
  // AI Learning resolvers (Story 5.6)
  SnippetCategory: aiLearningResolvers.SnippetCategory,
  // Email resolvers (Story 5.1)
  Email: emailResolvers.Email,
  EmailThread: emailResolvers.EmailThread,
  EmailAttachment: emailResolvers.EmailAttachment,
  // Communication Hub resolvers (Story 5.5)
  TimelineEntry: communicationHubResolvers.TimelineEntry,
  CommunicationTemplate: communicationHubResolvers.CommunicationTemplate,
  BulkCommunication: communicationHubResolvers.BulkCommunication,
  CommunicationExport: communicationHubResolvers.CommunicationExport,
  // Natural Language Commands resolvers (Story 1.5)
  CommandIntent: naturalLanguageCommandsResolvers.CommandIntent,
  CommandStatus: naturalLanguageCommandsResolvers.CommandStatus,
  // Email Import resolvers (OPS-022)
  EmailImportPreview: emailImportResolvers.EmailImportPreview,
  DateRange: emailImportResolvers.DateRange,
  ContactCandidate: emailImportResolvers.ContactCandidate,
};

/**
 * Create Apollo Server instance
 */
export async function createApolloServer(httpServer: http.Server) {
  const typeDefs = loadSchema();

  // Build executable schema with directives applied
  const schema = buildExecutableSchema(typeDefs, resolvers);

  const server = new ApolloServer({
    schema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    introspection: process.env.NODE_ENV !== 'production',
  });

  await server.start();

  return server;
}

/**
 * Create GraphQL middleware for Express
 */
export function createGraphQLMiddleware(server: ApolloServer<Context>): RequestHandler {
  return expressMiddleware(server, {
    context: async ({ req }: { req: Request }): Promise<Context> => {
      // Extract MS access token from header (Story 5.1: Email Integration)
      const msAccessToken = req.headers['x-ms-access-token'] as string | undefined;

      // Support for user context passed from web app proxy
      // The web app authenticates users via session cookie and passes context via x-mock-user header
      // This is trusted internal communication (browser -> web app -> gateway)
      if (req.headers['x-mock-user']) {
        try {
          const userContext = JSON.parse(req.headers['x-mock-user'] as string);
          return {
            user: {
              id: userContext.userId,
              firmId: userContext.firmId,
              role: userContext.role,
              email: userContext.email,
              accessToken: msAccessToken, // Story 5.1: Include MS access token for email operations
            },
            // Story 2.11.1: Populate financial data scope based on role
            financialDataScope: getFinancialDataScopeFromRole(userContext.role),
          };
        } catch (error) {
          console.warn('Invalid x-mock-user header:', error);
        }
      }

      // Extract user from session (set by authentication middleware)
      const user = (req as any).session?.user;

      return {
        user: user
          ? {
              id: user.userId, // Session stores userId, not id
              firmId: user.firmId,
              role: user.role,
              email: user.email,
              accessToken: msAccessToken, // Story 5.1: Include MS access token for email operations
            }
          : undefined,
        // Story 2.11.1: Populate financial data scope based on role
        financialDataScope: getFinancialDataScopeFromRole(user?.role),
      };
    },
  });
}
