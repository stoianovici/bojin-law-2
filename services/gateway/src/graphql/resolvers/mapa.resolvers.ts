/**
 * Mapa Resolvers
 * OPS-101: Mapa GraphQL Schema & Resolvers
 *
 * GraphQL resolvers for mapa (document binder) management.
 * Handles CRUD operations for mape, slots, templates, and document assignments.
 */

import { prisma, Prisma } from '@legal-platform/database';
import { mapaService, type MapaCompletionStatus } from '../../services/mapa.service';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
}

interface CreateMapaInput {
  caseId: string;
  name: string;
  description?: string;
  templateId?: string;
}

interface QuickSlotInput {
  name: string;
  required?: boolean;
}

interface CreateMapaWithSlotsInput {
  caseId: string;
  name: string;
  description?: string;
  slots: QuickSlotInput[];
}

interface UpdateMapaInput {
  name?: string;
  description?: string;
}

interface CreateSlotInput {
  name: string;
  description?: string;
  category?: string;
  required?: boolean;
  order: number;
}

interface UpdateSlotInput {
  name?: string;
  description?: string;
  category?: string;
  required?: boolean;
  order?: number;
}

interface AssignDocumentInput {
  slotId: string;
  caseDocumentId: string;
}

interface ReorderSlotsInput {
  mapaId: string;
  slotIds: string[];
}

interface SlotDefinitionInput {
  name: string;
  description?: string;
  category?: string;
  required?: boolean;
  order: number;
}

interface CreateTemplateInput {
  name: string;
  description?: string;
  caseType?: string;
  slotDefinitions: SlotDefinitionInput[];
}

interface UpdateTemplateInput {
  name?: string;
  description?: string;
  caseType?: string;
  slotDefinitions?: SlotDefinitionInput[];
  isActive?: boolean;
}

interface ONRCTemplateInput {
  procedureId: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  sourceUrl: string;
  contentHash: string;
  scrapedAt: Date;
  slotDefinitions: Array<{
    name: string;
    description?: string;
    category?: string;
    required: boolean;
    order: number;
  }>;
  aiEnhanced?: boolean;
  aiConfidence?: number;
  procedureSummary?: string;
  legalContext?: string;
  aiWarnings?: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function getUserContext(context: Context) {
  if (!context.user) {
    throw new Error('Authentication required');
  }

  return {
    userId: context.user.id,
    firmId: context.user.firmId,
    role: context.user.role as any,
  };
}

// ============================================================================
// Resolvers
// ============================================================================

export const mapaResolvers = {
  Query: {
    /**
     * Get a single mapa by ID
     */
    mapa: async (_: unknown, { id }: { id: string }, context: Context) => {
      const userContext = getUserContext(context);
      return mapaService.getMapa(id, userContext);
    },

    /**
     * Get all mape for a case
     */
    caseMape: async (_: unknown, { caseId }: { caseId: string }, context: Context) => {
      const userContext = getUserContext(context);
      return mapaService.getCaseMape(caseId, userContext);
    },

    /**
     * Get all mapa templates for the firm
     */
    mapaTemplates: async (_: unknown, __: unknown, context: Context) => {
      const userContext = getUserContext(context);
      return mapaService.getFirmTemplates(userContext);
    },

    /**
     * Get a single mapa template by ID
     */
    mapaTemplate: async (_: unknown, { id }: { id: string }, context: Context) => {
      const userContext = getUserContext(context);
      return mapaService.getTemplate(id, userContext);
    },

    /**
     * Get all ONRC (system) templates
     */
    onrcTemplates: async (_: unknown, __: unknown, context: Context) => {
      getUserContext(context); // Ensure authenticated
      return prisma.mapaTemplate.findMany({
        where: { isONRC: true, isActive: true },
        orderBy: { name: 'asc' },
      });
    },

    /**
     * Get ONRC sync status
     */
    onrcSyncStatus: async (_: unknown, __: unknown, context: Context) => {
      const userContext = getUserContext(context);
      if (userContext.role !== 'Partner') {
        throw new Error('Only Partners can view ONRC sync status');
      }

      const templates = await prisma.mapaTemplate.findMany({
        where: { isONRC: true },
        select: { lastSynced: true, aiMetadata: true },
      });

      const lastSyncAt = templates.reduce(
        (latest, t) => {
          if (!t.lastSynced) return latest;
          if (!latest) return t.lastSynced;
          return t.lastSynced > latest ? t.lastSynced : latest;
        },
        null as Date | null
      );

      const aiEnhancedCount = templates.filter(
        (t) => t.aiMetadata && (t.aiMetadata as { enhanced?: boolean }).enhanced
      ).length;

      return {
        lastSyncAt,
        templateCount: templates.length,
        aiEnhancedCount,
        syncAvailable: !!process.env.ANTHROPIC_API_KEY,
      };
    },
  },

  Mutation: {
    // --- Mapa CRUD ---

    /**
     * Create a new mapa
     */
    createMapa: async (_: unknown, { input }: { input: CreateMapaInput }, context: Context) => {
      const userContext = getUserContext(context);
      return mapaService.createMapa(input, userContext);
    },

    /**
     * Create a mapa from a template
     */
    createMapaFromTemplate: async (
      _: unknown,
      { templateId, caseId }: { templateId: string; caseId: string },
      context: Context
    ) => {
      const userContext = getUserContext(context);
      return mapaService.createMapaFromTemplate(templateId, caseId, userContext);
    },

    /**
     * Create a mapa with slots in one operation (quick list)
     */
    createMapaWithSlots: async (
      _: unknown,
      { input }: { input: CreateMapaWithSlotsInput },
      context: Context
    ) => {
      const userContext = getUserContext(context);
      return mapaService.createMapaWithSlots(input, userContext);
    },

    /**
     * Update a mapa
     */
    updateMapa: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateMapaInput },
      context: Context
    ) => {
      const userContext = getUserContext(context);
      return mapaService.updateMapa(id, input, userContext);
    },

    /**
     * Delete a mapa
     */
    deleteMapa: async (_: unknown, { id }: { id: string }, context: Context) => {
      const userContext = getUserContext(context);
      return mapaService.deleteMapa(id, userContext);
    },

    // --- Slot Management ---

    /**
     * Add a slot to a mapa
     */
    addMapaSlot: async (
      _: unknown,
      { mapaId, input }: { mapaId: string; input: CreateSlotInput },
      context: Context
    ) => {
      const userContext = getUserContext(context);
      return mapaService.addSlot(mapaId, input, userContext);
    },

    /**
     * Add multiple slots to a mapa
     */
    addMapaSlots: async (
      _: unknown,
      { mapaId, inputs }: { mapaId: string; inputs: CreateSlotInput[] },
      context: Context
    ) => {
      const userContext = getUserContext(context);
      return mapaService.addSlots(mapaId, inputs, userContext);
    },

    /**
     * Update a slot
     */
    updateMapaSlot: async (
      _: unknown,
      { slotId, input }: { slotId: string; input: UpdateSlotInput },
      context: Context
    ) => {
      const userContext = getUserContext(context);
      return mapaService.updateSlot(slotId, input, userContext);
    },

    /**
     * Delete a slot
     */
    deleteMapaSlot: async (_: unknown, { slotId }: { slotId: string }, context: Context) => {
      const userContext = getUserContext(context);
      return mapaService.deleteSlot(slotId, userContext);
    },

    /**
     * Reorder slots within a mapa
     */
    reorderMapaSlots: async (
      _: unknown,
      { input }: { input: ReorderSlotsInput },
      context: Context
    ) => {
      const userContext = getUserContext(context);
      return mapaService.reorderSlots(input.mapaId, input.slotIds, userContext);
    },

    // --- Document Assignment ---

    /**
     * Assign a document to a slot
     */
    assignDocumentToSlot: async (
      _: unknown,
      { slotId, caseDocumentId }: { slotId: string; caseDocumentId: string },
      context: Context
    ) => {
      const userContext = getUserContext(context);
      return mapaService.assignDocument(slotId, caseDocumentId, userContext);
    },

    /**
     * Unassign a document from a slot
     */
    unassignDocumentFromSlot: async (
      _: unknown,
      { slotId }: { slotId: string },
      context: Context
    ) => {
      const userContext = getUserContext(context);
      return mapaService.unassignDocument(slotId, userContext);
    },

    /**
     * Bulk assign documents to slots
     */
    bulkAssignDocuments: async (
      _: unknown,
      { assignments }: { assignments: AssignDocumentInput[] },
      context: Context
    ) => {
      const userContext = getUserContext(context);
      return mapaService.bulkAssignDocuments(assignments, userContext);
    },

    // --- Template Operations ---

    /**
     * Create a new template
     */
    createMapaTemplate: async (
      _: unknown,
      { input }: { input: CreateTemplateInput },
      context: Context
    ) => {
      const userContext = getUserContext(context);
      return mapaService.createTemplate(input, userContext);
    },

    /**
     * Update a template
     */
    updateMapaTemplate: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateTemplateInput },
      context: Context
    ) => {
      const userContext = getUserContext(context);
      return mapaService.updateTemplate(id, input, userContext);
    },

    /**
     * Delete a template
     */
    deleteMapaTemplate: async (_: unknown, { id }: { id: string }, context: Context) => {
      const userContext = getUserContext(context);
      return mapaService.deleteTemplate(id, userContext);
    },

    // --- ONRC Template Operations ---

    /**
     * Save ONRC templates to the database
     * Upserts templates by procedureId (unique constraint)
     */
    saveONRCTemplates: async (
      _: unknown,
      { templates }: { templates: ONRCTemplateInput[] },
      context: Context
    ) => {
      const userContext = getUserContext(context);
      if (userContext.role !== 'Partner') {
        throw new Error('Only Partners can sync ONRC templates');
      }

      const errors: Array<{ procedureId: string; error: string }> = [];
      let syncedCount = 0;

      for (const template of templates) {
        try {
          // Build AI metadata if present
          const aiMetadata = template.aiEnhanced
            ? {
                enhanced: template.aiEnhanced,
                confidence: template.aiConfidence,
                legalContext: template.legalContext,
                warnings: template.aiWarnings,
                procedureSummary: template.procedureSummary,
              }
            : null;

          // Build description with AI summary if available
          let description = template.description || '';
          if (template.procedureSummary) {
            description = description
              ? `${description}\n\n${template.procedureSummary}`
              : template.procedureSummary;
          }

          // Cast to Prisma JSON types
          const slotDefsJson = template.slotDefinitions as Prisma.InputJsonValue;
          const aiMetadataJson = aiMetadata as Prisma.InputJsonValue | null;

          // Upsert by procedureId (unique constraint)
          await prisma.mapaTemplate.upsert({
            where: { procedureId: template.procedureId },
            create: {
              name: template.name,
              description,
              procedureId: template.procedureId,
              sourceUrl: template.sourceUrl,
              contentHash: template.contentHash,
              lastSynced: template.scrapedAt,
              slotDefinitions: slotDefsJson,
              aiMetadata: aiMetadataJson,
              isONRC: true,
              isLocked: true,
              isActive: true,
              caseType: template.category,
            },
            update: {
              name: template.name,
              description,
              sourceUrl: template.sourceUrl,
              contentHash: template.contentHash,
              lastSynced: template.scrapedAt,
              slotDefinitions: slotDefsJson,
              aiMetadata: aiMetadataJson,
            },
          });

          syncedCount++;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          errors.push({ procedureId: template.procedureId, error: errorMessage });
        }
      }

      return {
        success: errors.length === 0,
        message:
          errors.length === 0
            ? `Successfully synced ${syncedCount} ONRC templates`
            : `Synced ${syncedCount} templates with ${errors.length} errors`,
        syncedCount,
        errorCount: errors.length,
        errors,
        syncedAt: new Date(),
      };
    },
  },

  // ============================================================================
  // Type Resolvers
  // ============================================================================

  Mapa: {
    /**
     * Resolve case relation
     */
    case: async (mapa: { caseId: string }) => {
      return prisma.case.findUnique({
        where: { id: mapa.caseId },
      });
    },

    /**
     * Resolve template relation
     */
    template: async (mapa: { templateId: string | null }) => {
      if (!mapa.templateId) return null;
      return prisma.mapaTemplate.findUnique({
        where: { id: mapa.templateId },
      });
    },

    /**
     * Resolve slots relation
     */
    slots: async (mapa: { id: string }) => {
      return prisma.mapaSlot.findMany({
        where: { mapaId: mapa.id },
        orderBy: { order: 'asc' },
      });
    },

    /**
     * Resolve completion status
     */
    completionStatus: async (
      mapa: { id: string },
      _: unknown,
      context: Context
    ): Promise<MapaCompletionStatus & { percentComplete: number }> => {
      const userContext = getUserContext(context);
      const status = await mapaService.getCompletionStatus(mapa.id, userContext);
      const percentComplete =
        status.totalSlots > 0 ? Math.round((status.filledSlots / status.totalSlots) * 100) : 100;
      return {
        ...status,
        percentComplete,
      };
    },

    /**
     * Resolve createdBy relation
     */
    createdBy: async (mapa: { createdById: string }) => {
      return prisma.user.findUnique({
        where: { id: mapa.createdById },
      });
    },
  },

  MapaSlot: {
    /**
     * Resolve mapa relation
     */
    mapa: async (slot: { mapaId: string }) => {
      return prisma.mapa.findUnique({
        where: { id: slot.mapaId },
      });
    },

    /**
     * Resolve document relation (CaseDocumentWithContext format)
     */
    document: async (slot: { caseDocumentId: string | null }) => {
      if (!slot.caseDocumentId) return null;

      const caseDocument = await prisma.caseDocument.findUnique({
        where: { id: slot.caseDocumentId },
        include: {
          document: true,
          linker: true,
        },
      });

      if (!caseDocument) return null;

      return {
        document: caseDocument.document,
        linkedBy: caseDocument.linker,
        linkedAt: caseDocument.linkedAt,
        isOriginal: caseDocument.isOriginal,
        sourceCase: null,
      };
    },

    /**
     * Resolve assignedBy relation
     */
    assignedBy: async (slot: { assignedById: string | null }) => {
      if (!slot.assignedById) return null;
      return prisma.user.findUnique({
        where: { id: slot.assignedById },
      });
    },

    /**
     * Compute slot status based on document assignment
     * - pending: no document assigned
     * - received: document has been assigned
     */
    status: (slot: { caseDocumentId: string | null }) => {
      return slot.caseDocumentId ? 'received' : 'pending';
    },
  },

  MapaTemplate: {
    /**
     * Resolve createdBy relation (null for ONRC system templates)
     */
    createdBy: async (template: { createdById: string | null }) => {
      if (!template.createdById) return null;
      return prisma.user.findUnique({
        where: { id: template.createdById },
      });
    },

    /**
     * Resolve slotDefinitions (JSON to typed array)
     */
    slotDefinitions: (template: { slotDefinitions: unknown }) => {
      return template.slotDefinitions as SlotDefinitionInput[];
    },

    /**
     * Resolve usage count
     */
    usageCount: async (template: { id: string }) => {
      return prisma.mapa.count({
        where: { templateId: template.id },
      });
    },
  },

  MapaCompletionStatus: {
    /**
     * Calculate percent complete
     */
    percentComplete: (status: { totalSlots: number; filledSlots: number }) => {
      return status.totalSlots > 0
        ? Math.round((status.filledSlots / status.totalSlots) * 100)
        : 100;
    },
  },
};
