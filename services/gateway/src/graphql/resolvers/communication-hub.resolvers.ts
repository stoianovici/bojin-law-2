/**
 * Communication Hub GraphQL Resolvers
 * Story 5.5: Multi-Channel Communication Hub (AC: 1-6)
 */

import { prisma } from '@legal-platform/database';
import {
  CommunicationChannel,
  PrivacyLevel,
  TemplateCategory,
  BulkCommunicationStatus,
  ExportFormat,
  UserRole,
} from '@prisma/client';

import { unifiedTimelineService } from '../../services/unified-timeline.service';
import { internalNotesService } from '../../services/internal-notes.service';
import { communicationTemplateService } from '../../services/communication-template.service';
import { bulkCommunicationService } from '../../services/bulk-communication.service';
import { communicationExportService } from '../../services/communication-export.service';
import { communicationPrivacyService } from '../../services/communication-privacy.service';

// ============================================================================
// Helper Types
// ============================================================================

interface Context {
  user: {
    id: string;
    role: UserRole;
    firmId: string;
  };
}

interface TimelineFilter {
  caseId: string;
  channelTypes?: CommunicationChannel[];
  direction?: string;
  dateFrom?: Date;
  dateTo?: Date;
  searchTerm?: string;
  includePrivate?: boolean;
}

// ============================================================================
// Query Resolvers
// ============================================================================

const Query = {
  // Timeline Queries
  caseTimeline: async (
    _: any,
    args: { filter: TimelineFilter; first?: number; after?: string },
    context: Context
  ) => {
    const { filter, first = 20, after } = args;

    return unifiedTimelineService.getUnifiedTimeline(
      {
        caseId: filter.caseId,
        channelTypes: filter.channelTypes,
        direction: filter.direction as any,
        dateFrom: filter.dateFrom,
        dateTo: filter.dateTo,
        searchTerm: filter.searchTerm,
        includePrivate: filter.includePrivate,
      },
      { limit: first, cursor: after },
      {
        userId: context.user.id,
        role: context.user.role,
        firmId: context.user.firmId,
      }
    );
  },

  communicationEntry: async (
    _: any,
    args: { id: string },
    context: Context
  ) => {
    return unifiedTimelineService.getCommunicationEntry(args.id, {
      userId: context.user.id,
      role: context.user.role,
      firmId: context.user.firmId,
    });
  },

  // Template Queries
  communicationTemplates: async (
    _: any,
    args: {
      category?: TemplateCategory;
      channelType?: CommunicationChannel;
      searchTerm?: string;
    },
    context: Context
  ) => {
    const result = await communicationTemplateService.listTemplates(
      {
        category: args.category,
        channelType: args.channelType,
        searchTerm: args.searchTerm,
        isActive: true,
      },
      { userId: context.user.id, firmId: context.user.firmId }
    );
    return result.templates;
  },

  communicationTemplate: async (
    _: any,
    args: { id: string },
    context: Context
  ) => {
    return communicationTemplateService.getTemplate(args.id, {
      userId: context.user.id,
      firmId: context.user.firmId,
    });
  },

  // Bulk Communication Queries
  bulkCommunications: async (
    _: any,
    args: { caseId?: string; status?: BulkCommunicationStatus },
    context: Context
  ) => {
    const result = await bulkCommunicationService.listBulkCommunications(
      { userId: context.user.id, firmId: context.user.firmId },
      { status: args.status }
    );
    return result.items;
  },

  bulkCommunicationProgress: async (
    _: any,
    args: { id: string },
    context: Context
  ) => {
    const bulkComm = await bulkCommunicationService.getBulkCommunication(args.id, {
      userId: context.user.id,
      firmId: context.user.firmId,
    });

    if (!bulkComm) {
      throw new Error('Bulk communication not found');
    }

    const pendingCount = bulkComm.totalRecipients - bulkComm.sentCount - bulkComm.failedCount;
    const percentComplete =
      bulkComm.totalRecipients > 0
        ? ((bulkComm.sentCount + bulkComm.failedCount) / bulkComm.totalRecipients) * 100
        : 0;

    // Estimate time based on average send rate (assume 10 per second)
    const estimatedTimeRemaining = pendingCount > 0 ? Math.ceil(pendingCount / 10) : 0;

    return {
      totalRecipients: bulkComm.totalRecipients,
      sentCount: bulkComm.sentCount,
      failedCount: bulkComm.failedCount,
      pendingCount,
      percentComplete,
      estimatedTimeRemaining,
    };
  },

  bulkCommunicationFailedRecipients: async (
    _: any,
    args: { id: string; limit?: number; offset?: number },
    context: Context
  ) => {
    const { logs, total } = await bulkCommunicationService.getBulkCommunicationLogs(
      args.id,
      { userId: context.user.id, firmId: context.user.firmId },
      { status: 'failed', limit: args.limit || 50, offset: args.offset || 0 }
    );

    const limit = args.limit || 50;
    const offset = args.offset || 0;
    const hasMore = offset + logs.length < total;

    return {
      logs: logs.map((log) => ({
        id: log.id,
        recipientEmail: log.recipientEmail,
        recipientName: log.recipientName,
        status: log.status,
        errorMessage: log.errorMessage,
        sentAt: log.sentAt,
      })),
      total,
      hasMore,
    };
  },

  // Export Queries
  communicationExports: async (
    _: any,
    args: { caseId: string },
    context: Context
  ) => {
    const result = await communicationExportService.listExports(args.caseId, {
      userId: context.user.id,
      firmId: context.user.firmId,
    });
    return result.exports;
  },

  communicationExport: async (
    _: any,
    args: { id: string },
    context: Context
  ) => {
    return communicationExportService.getExport(args.id, {
      userId: context.user.id,
      firmId: context.user.firmId,
    });
  },
};

// ============================================================================
// Mutation Resolvers
// ============================================================================

const Mutation = {
  // Internal Notes Mutations
  createInternalNote: async (
    _: any,
    args: {
      input: {
        caseId: string;
        body: string;
        isPrivate?: boolean;
        privacyLevel?: PrivacyLevel;
        allowedViewers?: string[];
      };
    },
    context: Context
  ) => {
    const note = await internalNotesService.createInternalNote(
      {
        caseId: args.input.caseId,
        body: args.input.body,
        isPrivate: args.input.isPrivate || false,
        privacyLevel: args.input.privacyLevel || PrivacyLevel.Normal,
        allowedViewers: args.input.allowedViewers,
      },
      {
        userId: context.user.id,
        role: context.user.role,
        firmId: context.user.firmId,
      }
    );

    // Map to TimelineEntry format
    return {
      id: note.id,
      channelType: CommunicationChannel.InternalNote,
      direction: 'Internal',
      body: note.body,
      bodyPreview: note.body.substring(0, 200),
      senderName: note.authorName,
      recipients: [],
      hasAttachments: note.hasAttachments,
      attachments: note.attachments,
      isPrivate: note.isPrivate,
      privacyLevel: note.privacyLevel,
      sentAt: note.createdAt,
      childCount: 0,
    };
  },

  updateInternalNote: async (
    _: any,
    args: { id: string; body: string },
    context: Context
  ) => {
    const note = await internalNotesService.updateInternalNote(
      args.id,
      { body: args.body },
      {
        userId: context.user.id,
        role: context.user.role,
        firmId: context.user.firmId,
      }
    );

    return {
      id: note.id,
      channelType: CommunicationChannel.InternalNote,
      direction: 'Internal',
      body: note.body,
      bodyPreview: note.body.substring(0, 200),
      senderName: note.authorName,
      recipients: [],
      hasAttachments: note.hasAttachments,
      attachments: note.attachments,
      isPrivate: note.isPrivate,
      privacyLevel: note.privacyLevel,
      sentAt: note.createdAt,
      childCount: 0,
    };
  },

  deleteInternalNote: async (
    _: any,
    args: { id: string },
    context: Context
  ) => {
    return internalNotesService.deleteInternalNote(args.id, {
      userId: context.user.id,
      role: context.user.role,
      firmId: context.user.firmId,
    });
  },

  // Template Mutations
  createCommunicationTemplate: async (
    _: any,
    args: {
      input: {
        name: string;
        description?: string;
        category: TemplateCategory;
        channelType: CommunicationChannel;
        subject?: string;
        body: string;
        htmlBody?: string;
        variables?: Array<{
          name: string;
          description: string;
          defaultValue?: string;
          required: boolean;
        }>;
        isGlobal?: boolean;
      };
    },
    context: Context
  ) => {
    return communicationTemplateService.createTemplate(
      {
        name: args.input.name,
        description: args.input.description,
        category: args.input.category,
        channelType: args.input.channelType,
        subject: args.input.subject,
        body: args.input.body,
        htmlBody: args.input.htmlBody,
        variables: args.input.variables || [],
        isGlobal: args.input.isGlobal || false,
      },
      { userId: context.user.id, firmId: context.user.firmId }
    );
  },

  updateCommunicationTemplate: async (
    _: any,
    args: {
      id: string;
      input: {
        name?: string;
        description?: string;
        category?: TemplateCategory;
        subject?: string;
        body?: string;
        htmlBody?: string;
        variables?: Array<{
          name: string;
          description: string;
          defaultValue?: string;
          required: boolean;
        }>;
        isGlobal?: boolean;
        isActive?: boolean;
      };
    },
    context: Context
  ) => {
    return communicationTemplateService.updateTemplate(
      args.id,
      args.input,
      { userId: context.user.id, firmId: context.user.firmId }
    );
  },

  deleteCommunicationTemplate: async (
    _: any,
    args: { id: string },
    context: Context
  ) => {
    return communicationTemplateService.deleteTemplate(args.id, {
      userId: context.user.id,
      firmId: context.user.firmId,
    });
  },

  renderTemplate: async (
    _: any,
    args: { input: { templateId: string; variables: Record<string, string> } },
    context: Context
  ) => {
    return communicationTemplateService.renderTemplate(
      args.input.templateId,
      args.input.variables,
      { userId: context.user.id, firmId: context.user.firmId }
    );
  },

  // Bulk Communication Mutations
  createBulkCommunication: async (
    _: any,
    args: {
      input: {
        caseId?: string;
        templateId?: string;
        subject: string;
        body: string;
        channelType: CommunicationChannel;
        recipientType: string;
        recipientFilter: any;
        scheduledFor?: Date;
      };
    },
    context: Context
  ) => {
    // Only Partners and Associates can create bulk communications
    const roleStr = context.user.role as string;
    if (roleStr !== 'Partner' && roleStr !== 'Associate') {
      throw new Error('Only attorneys can create bulk communications');
    }

    return bulkCommunicationService.createBulkCommunication(
      {
        caseId: args.input.caseId,
        templateId: args.input.templateId,
        subject: args.input.subject,
        body: args.input.body,
        channelType: args.input.channelType,
        recipientType: args.input.recipientType as any,
        recipientFilter: args.input.recipientFilter,
        scheduledFor: args.input.scheduledFor,
      },
      { userId: context.user.id, firmId: context.user.firmId }
    );
  },

  sendBulkCommunication: async (
    _: any,
    args: { id: string },
    context: Context
  ) => {
    // Resolve recipients first if not done
    await bulkCommunicationService.resolveRecipients(args.id, {
      userId: context.user.id,
      firmId: context.user.firmId,
    });

    return bulkCommunicationService.sendBulkCommunication(args.id, {
      userId: context.user.id,
      firmId: context.user.firmId,
    });
  },

  cancelBulkCommunication: async (
    _: any,
    args: { id: string },
    context: Context
  ) => {
    return bulkCommunicationService.cancelBulkCommunication(args.id, {
      userId: context.user.id,
      firmId: context.user.firmId,
    });
  },

  // Export Mutations
  exportCommunications: async (
    _: any,
    args: {
      input: {
        caseId: string;
        format: ExportFormat;
        dateRangeFrom?: Date;
        dateRangeTo?: Date;
        channelTypes?: CommunicationChannel[];
        includeAttachments?: boolean;
      };
    },
    context: Context
  ) => {
    return communicationExportService.createExport(
      {
        caseId: args.input.caseId,
        format: args.input.format,
        dateRangeFrom: args.input.dateRangeFrom,
        dateRangeTo: args.input.dateRangeTo,
        channelTypes: args.input.channelTypes,
        includeAttachments: args.input.includeAttachments,
      },
      { userId: context.user.id, firmId: context.user.firmId }
    );
  },

  // Privacy Mutations
  updateCommunicationPrivacy: async (
    _: any,
    args: {
      input: {
        communicationId: string;
        privacyLevel: PrivacyLevel;
        allowedViewers?: string[];
      };
    },
    context: Context
  ) => {
    await communicationPrivacyService.updatePrivacy(
      {
        communicationId: args.input.communicationId,
        privacyLevel: args.input.privacyLevel,
        allowedViewers: args.input.allowedViewers,
      },
      {
        userId: context.user.id,
        role: context.user.role,
        firmId: context.user.firmId,
      }
    );

    // Return the updated entry
    return unifiedTimelineService.getCommunicationEntry(args.input.communicationId, {
      userId: context.user.id,
      role: context.user.role,
      firmId: context.user.firmId,
    });
  },
};

// ============================================================================
// Field Resolvers
// ============================================================================

const TimelineEntry = {
  attachments: async (parent: any) => {
    if (parent.attachments) {
      return parent.attachments;
    }

    const attachments = await prisma.communicationAttachment.findMany({
      where: { communicationEntryId: parent.id },
    });

    return attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      downloadUrl: a.storageUrl,
      documentId: a.documentId,
    }));
  },

  case: async (parent: any) => {
    if (!parent.caseId) return null;
    return prisma.case.findUnique({ where: { id: parent.caseId } });
  },

  childCount: async (parent: any) => {
    return prisma.communicationEntry.count({
      where: { parentId: parent.id },
    });
  },
};

const CommunicationTemplate = {
  createdBy: async (parent: any) => {
    return prisma.user.findUnique({ where: { id: parent.createdBy } });
  },
};

const BulkCommunication = {
  createdBy: async (parent: any) => {
    return prisma.user.findUnique({ where: { id: parent.createdBy } });
  },

  case: async (parent: any) => {
    if (!parent.caseId) return null;
    return prisma.case.findUnique({ where: { id: parent.caseId } });
  },
};

const CommunicationExport = {
  downloadUrl: async (parent: any, _: any, context: Context) => {
    if (parent.status !== 'Completed' || !parent.fileUrl) {
      return null;
    }

    return communicationExportService.getDownloadUrl(parent.id, {
      userId: context.user.id,
      firmId: context.user.firmId,
    });
  },
};

// ============================================================================
// Export Resolvers
// ============================================================================

export const communicationHubResolvers = {
  Query,
  Mutation,
  TimelineEntry,
  CommunicationTemplate,
  BulkCommunication,
  CommunicationExport,
};
