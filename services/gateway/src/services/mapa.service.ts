/**
 * Mapa Service
 * OPS-100: Mapa Service Layer
 *
 * Manages document binders (mape) with slots for expected documents.
 * Provides CRUD operations, slot management, document assignment,
 * and template instantiation.
 */

import { prisma } from '@legal-platform/database';
import { Prisma, UserRole } from '@prisma/client';
import { getONRCTemplateById, isONRCTemplateId } from '../data/onrc-templates';
import { activityEmitter } from './activity-emitter.service';

// ============================================================================
// Types
// ============================================================================

interface UserContext {
  userId: string;
  role: UserRole;
  firmId: string;
}

interface CreateMapaInput {
  caseId: string;
  name: string;
  description?: string | null;
  templateId?: string | null;
}

interface UpdateMapaInput {
  name?: string;
  description?: string | null;
}

interface CreateMapaSlotInput {
  name: string;
  description?: string | null;
  category?: string | null;
  required?: boolean;
  order: number;
}

interface QuickSlotInput {
  name: string;
  required?: boolean;
}

interface CreateMapaWithSlotsInput {
  caseId: string;
  name: string;
  description?: string | null;
  slots: QuickSlotInput[];
}

interface UpdateMapaSlotInput {
  name?: string;
  description?: string | null;
  category?: string | null;
  required?: boolean;
  order?: number;
}

interface SlotDefinition {
  name: string;
  description?: string | null;
  category?: string | null;
  required?: boolean;
  order?: number;
}

interface CreateTemplateInput {
  name: string;
  description?: string | null;
  caseType?: string | null;
  slotDefinitions: SlotDefinition[];
}

interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  caseType?: string | null;
  slotDefinitions?: SlotDefinition[];
  isActive?: boolean;
}

export interface MapaCompletionStatus {
  totalSlots: number;
  filledSlots: number;
  requiredSlots: number;
  filledRequiredSlots: number;
  isComplete: boolean;
  missingRequired: string[];
}

// ============================================================================
// Service
// ============================================================================

export class MapaService {
  // ==========================================================================
  // Mapa CRUD
  // ==========================================================================

  /**
   * Create a new mapa for a case
   */
  async createMapa(input: CreateMapaInput, userContext: UserContext) {
    await this.validateCaseAccess(input.caseId, userContext);

    // If templateId provided, create from template
    if (input.templateId) {
      return this.createMapaFromTemplate(input.templateId, input.caseId, userContext, input.name);
    }

    const mapa = await prisma.mapa.create({
      data: {
        caseId: input.caseId,
        name: input.name,
        description: input.description,
        createdById: userContext.userId,
      },
      include: {
        slots: {
          orderBy: { order: 'asc' },
        },
        template: true,
        createdBy: true,
      },
    });

    // Emit activity to team chat (fire and forget)
    const userName =
      [mapa.createdBy?.firstName, mapa.createdBy?.lastName].filter(Boolean).join(' ') ||
      mapa.createdBy?.email ||
      'Unknown';
    activityEmitter
      .emitMapaCreated(userContext.firmId, userName, {
        id: mapa.id,
        name: mapa.name,
      })
      .catch((err) => console.error('[ActivityEmitter] Mapa create event failed:', err));

    return mapa;
  }

  /**
   * Create a mapa from a template
   *
   * Supports both database templates (UUIDs) and ONRC static templates (onrc-* IDs).
   */
  async createMapaFromTemplate(
    templateId: string,
    caseId: string,
    userContext: UserContext,
    customName?: string
  ) {
    await this.validateCaseAccess(caseId, userContext);

    let templateName: string;
    let templateDescription: string | null | undefined;
    let slotDefs: SlotDefinition[];

    // Check if this is an ONRC template (static data) or a database template
    if (isONRCTemplateId(templateId)) {
      // ONRC template - look up from static data
      const onrcTemplate = getONRCTemplateById(templateId);
      if (!onrcTemplate) {
        throw new Error('Template not found');
      }
      templateName = onrcTemplate.name;
      templateDescription = onrcTemplate.description;
      slotDefs = onrcTemplate.slotDefinitions;
    } else {
      // Database template - look up from database
      const template = await prisma.mapaTemplate.findUnique({
        where: { id: templateId },
      });

      // Template must exist and either belong to the user's firm OR be an ONRC (system) template (firmId is null)
      if (!template || (template.firmId !== null && template.firmId !== userContext.firmId)) {
        throw new Error('Template not found');
      }

      templateName = template.name;
      templateDescription = template.description;
      slotDefs = (template.slotDefinitions as unknown as SlotDefinition[]) || [];
    }

    const mapa = await prisma.mapa.create({
      data: {
        caseId,
        name: customName || templateName,
        description: templateDescription,
        // Don't set templateId for ONRC templates (no DB record to reference)
        templateId: isONRCTemplateId(templateId) ? null : templateId,
        createdById: userContext.userId,
        slots: {
          create: slotDefs.map((slot, index) => ({
            name: slot.name,
            description: slot.description,
            category: slot.category,
            required: slot.required ?? true,
            order: slot.order ?? index,
          })),
        },
      },
      include: {
        slots: {
          orderBy: { order: 'asc' },
        },
        template: true,
        createdBy: true,
      },
    });

    // Emit activity to team chat (fire and forget)
    const templateMapaUserName =
      [mapa.createdBy?.firstName, mapa.createdBy?.lastName].filter(Boolean).join(' ') ||
      mapa.createdBy?.email ||
      'Unknown';
    activityEmitter
      .emitMapaCreated(userContext.firmId, templateMapaUserName, {
        id: mapa.id,
        name: mapa.name,
      })
      .catch((err) => console.error('[ActivityEmitter] Mapa create event failed:', err));

    return mapa;
  }

  /**
   * Create a mapa with slots in one operation (quick list)
   */
  async createMapaWithSlots(input: CreateMapaWithSlotsInput, userContext: UserContext) {
    await this.validateCaseAccess(input.caseId, userContext);

    const mapa = await prisma.mapa.create({
      data: {
        caseId: input.caseId,
        name: input.name,
        description: input.description,
        createdById: userContext.userId,
        slots: {
          create: input.slots.map((slot, index) => ({
            name: slot.name,
            required: slot.required ?? false,
            order: index,
          })),
        },
      },
      include: {
        slots: {
          orderBy: { order: 'asc' },
        },
        template: true,
        createdBy: true,
      },
    });

    // Emit activity to team chat (fire and forget)
    const quickMapaUserName =
      [mapa.createdBy?.firstName, mapa.createdBy?.lastName].filter(Boolean).join(' ') ||
      mapa.createdBy?.email ||
      'Unknown';
    activityEmitter
      .emitMapaCreated(userContext.firmId, quickMapaUserName, {
        id: mapa.id,
        name: mapa.name,
      })
      .catch((err) => console.error('[ActivityEmitter] Mapa create event failed:', err));

    return mapa;
  }

  /**
   * Get a mapa by ID
   */
  async getMapa(id: string, userContext: UserContext) {
    const mapa = await prisma.mapa.findUnique({
      where: { id },
      include: {
        case: true,
        client: true,
        slots: {
          include: {
            caseDocument: {
              include: {
                document: true,
              },
            },
            assignedBy: true,
          },
          orderBy: { order: 'asc' },
        },
        template: true,
        createdBy: true,
      },
    });

    if (!mapa) {
      return null;
    }

    // Validate access based on whether it's case-level or client-level mapa
    if (mapa.caseId) {
      await this.validateCaseAccess(mapa.caseId, userContext);
    } else if (mapa.clientId) {
      await this.validateClientAccess(mapa.clientId, userContext);
    } else {
      throw new Error('Mapa has no case or client association');
    }

    return mapa;
  }

  /**
   * Get all mape for a case
   */
  async getCaseMape(caseId: string, userContext: UserContext) {
    await this.validateCaseAccess(caseId, userContext);

    const mape = await prisma.mapa.findMany({
      where: { caseId },
      include: {
        slots: {
          include: {
            caseDocument: {
              include: {
                document: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
        template: true,
        createdBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return mape;
  }

  /**
   * Update a mapa
   */
  async updateMapa(id: string, input: UpdateMapaInput, userContext: UserContext) {
    const mapa = await prisma.mapa.findUnique({
      where: { id },
      select: { caseId: true, clientId: true },
    });

    if (!mapa) {
      throw new Error('Mapa not found');
    }

    // Validate access based on whether it's case-level or client-level mapa
    if (mapa.caseId) {
      await this.validateCaseAccess(mapa.caseId, userContext);
    } else if (mapa.clientId) {
      await this.validateClientAccess(mapa.clientId, userContext);
    } else {
      throw new Error('Mapa has no case or client association');
    }

    const updatedMapa = await prisma.mapa.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      },
      include: {
        slots: {
          include: {
            caseDocument: {
              include: {
                document: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
        template: true,
        createdBy: true,
      },
    });

    return updatedMapa;
  }

  /**
   * Delete a mapa (supports both case-level and client-level mapas)
   */
  async deleteMapa(id: string, userContext: UserContext): Promise<boolean> {
    const mapa = await prisma.mapa.findUnique({
      where: { id },
      select: { caseId: true, clientId: true },
    });

    if (!mapa) {
      throw new Error('Mapa not found');
    }

    // Validate access based on whether it's case-level or client-level
    if (mapa.caseId) {
      await this.validateCaseAccess(mapa.caseId, userContext);
    } else if (mapa.clientId) {
      await this.validateClientAccess(mapa.clientId, userContext);
    } else {
      throw new Error('Mapa has no case or client association');
    }

    await prisma.mapa.delete({
      where: { id },
    });

    return true;
  }

  // ==========================================================================
  // Slot Management
  // ==========================================================================

  /**
   * Add a slot to a mapa
   */
  async addSlot(mapaId: string, input: CreateMapaSlotInput, userContext: UserContext) {
    const mapa = await prisma.mapa.findUnique({
      where: { id: mapaId },
      select: { caseId: true, clientId: true },
    });

    if (!mapa) {
      throw new Error('Mapa not found');
    }

    // Validate access based on whether it's case-level or client-level mapa
    if (mapa.caseId) {
      await this.validateCaseAccess(mapa.caseId, userContext);
    } else if (mapa.clientId) {
      await this.validateClientAccess(mapa.clientId, userContext);
    } else {
      throw new Error('Mapa has no case or client association');
    }

    // Use transaction to prevent race condition with unique constraint on (mapaId, order)
    const slot = await prisma.$transaction(async (tx) => {
      // Shift existing slots if needed to make room for new order
      await tx.mapaSlot.updateMany({
        where: {
          mapaId,
          order: { gte: input.order },
        },
        data: {
          order: { increment: 1 },
        },
      });

      return tx.mapaSlot.create({
        data: {
          mapaId,
          name: input.name,
          description: input.description,
          category: input.category,
          required: input.required ?? true,
          order: input.order,
        },
        include: {
          caseDocument: {
            include: {
              document: true,
            },
          },
          assignedBy: true,
        },
      });
    });

    return slot;
  }

  /**
   * Add multiple slots to a mapa
   */
  async addSlots(mapaId: string, inputs: CreateMapaSlotInput[], userContext: UserContext) {
    const mapa = await prisma.mapa.findUnique({
      where: { id: mapaId },
      select: { caseId: true, clientId: true },
    });

    if (!mapa) {
      throw new Error('Mapa not found');
    }

    // Validate access based on whether it's case-level or client-level mapa
    if (mapa.caseId) {
      await this.validateCaseAccess(mapa.caseId, userContext);
    } else if (mapa.clientId) {
      await this.validateClientAccess(mapa.clientId, userContext);
    } else {
      throw new Error('Mapa has no case or client association');
    }

    // Use interactive transaction to prevent race condition with unique constraint on (mapaId, order)
    const slots = await prisma.$transaction(async (tx) => {
      // Get current max order inside transaction
      const maxOrder = await tx.mapaSlot.aggregate({
        where: { mapaId },
        _max: { order: true },
      });

      const startOrder = (maxOrder._max.order ?? -1) + 1;

      // Create all slots sequentially within the transaction
      const createdSlots = [];
      for (let index = 0; index < inputs.length; index++) {
        const input = inputs[index];
        const slot = await tx.mapaSlot.create({
          data: {
            mapaId,
            name: input.name,
            description: input.description,
            category: input.category,
            required: input.required ?? true,
            order: input.order ?? startOrder + index,
          },
          include: {
            caseDocument: {
              include: {
                document: true,
              },
            },
            assignedBy: true,
          },
        });
        createdSlots.push(slot);
      }

      return createdSlots;
    });

    return slots;
  }

  /**
   * Update a slot
   */
  async updateSlot(slotId: string, input: UpdateMapaSlotInput, userContext: UserContext) {
    const slot = await prisma.mapaSlot.findUnique({
      where: { id: slotId },
      include: {
        mapa: {
          select: { caseId: true, clientId: true },
        },
      },
    });

    if (!slot) {
      throw new Error('Slot not found');
    }

    // Validate access based on whether it's case-level or client-level mapa
    if (slot.mapa.caseId) {
      await this.validateCaseAccess(slot.mapa.caseId, userContext);
    } else if (slot.mapa.clientId) {
      await this.validateClientAccess(slot.mapa.clientId, userContext);
    } else {
      throw new Error('Mapa has no case or client association');
    }

    // Handle order change
    if (input.order !== undefined && input.order !== slot.order) {
      // Reorder other slots
      if (input.order > slot.order) {
        // Moving down: shift slots in between up
        await prisma.mapaSlot.updateMany({
          where: {
            mapaId: slot.mapaId,
            order: {
              gt: slot.order,
              lte: input.order,
            },
          },
          data: {
            order: { decrement: 1 },
          },
        });
      } else {
        // Moving up: shift slots in between down
        await prisma.mapaSlot.updateMany({
          where: {
            mapaId: slot.mapaId,
            order: {
              gte: input.order,
              lt: slot.order,
            },
          },
          data: {
            order: { increment: 1 },
          },
        });
      }
    }

    const updatedSlot = await prisma.mapaSlot.update({
      where: { id: slotId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.required !== undefined && { required: input.required }),
        ...(input.order !== undefined && { order: input.order }),
      },
      include: {
        caseDocument: {
          include: {
            document: true,
          },
        },
        assignedBy: true,
      },
    });

    return updatedSlot;
  }

  /**
   * Delete a slot
   */
  async deleteSlot(slotId: string, userContext: UserContext): Promise<boolean> {
    const slot = await prisma.mapaSlot.findUnique({
      where: { id: slotId },
      include: {
        mapa: {
          select: { caseId: true, clientId: true },
        },
      },
    });

    if (!slot) {
      throw new Error('Slot not found');
    }

    // Validate access based on whether it's case-level or client-level mapa
    if (slot.mapa.caseId) {
      await this.validateCaseAccess(slot.mapa.caseId, userContext);
    } else if (slot.mapa.clientId) {
      await this.validateClientAccess(slot.mapa.clientId, userContext);
    } else {
      throw new Error('Mapa has no case or client association');
    }

    // Delete the slot
    await prisma.mapaSlot.delete({
      where: { id: slotId },
    });

    // Reorder remaining slots
    await prisma.mapaSlot.updateMany({
      where: {
        mapaId: slot.mapaId,
        order: { gt: slot.order },
      },
      data: {
        order: { decrement: 1 },
      },
    });

    return true;
  }

  /**
   * Reorder slots within a mapa
   */
  async reorderSlots(mapaId: string, slotIds: string[], userContext: UserContext) {
    const mapa = await prisma.mapa.findUnique({
      where: { id: mapaId },
      select: { caseId: true, clientId: true },
    });

    if (!mapa) {
      throw new Error('Mapa not found');
    }

    // Validate access based on whether it's case-level or client-level mapa
    if (mapa.caseId) {
      await this.validateCaseAccess(mapa.caseId, userContext);
    } else if (mapa.clientId) {
      await this.validateClientAccess(mapa.clientId, userContext);
    } else {
      throw new Error('Mapa has no case or client association');
    }

    // Validate all slots belong to this mapa
    const existingSlots = await prisma.mapaSlot.findMany({
      where: { mapaId },
    });

    const existingIds = new Set(existingSlots.map((s) => s.id));
    if (!slotIds.every((id) => existingIds.has(id))) {
      throw new Error('Invalid slot IDs');
    }

    // Update order in transaction
    await prisma.$transaction(
      slotIds.map((id, index) =>
        prisma.mapaSlot.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    const slots = await prisma.mapaSlot.findMany({
      where: { mapaId },
      include: {
        caseDocument: {
          include: {
            document: true,
          },
        },
        assignedBy: true,
      },
      orderBy: { order: 'asc' },
    });

    return slots;
  }

  // ==========================================================================
  // Document Assignment
  // ==========================================================================

  /**
   * Assign a document to a slot
   */
  async assignDocument(slotId: string, caseDocumentId: string, userContext: UserContext) {
    const slot = await prisma.mapaSlot.findUnique({
      where: { id: slotId },
      include: {
        mapa: {
          select: { caseId: true, clientId: true },
        },
      },
    });

    if (!slot) {
      throw new Error('Slot not found');
    }

    // Validate access based on whether it's case-level or client-level mapa
    if (slot.mapa.caseId) {
      await this.validateCaseAccess(slot.mapa.caseId, userContext);
    } else if (slot.mapa.clientId) {
      await this.validateClientAccess(slot.mapa.clientId, userContext);
    } else {
      throw new Error('Mapa has no case or client association');
    }

    // Validate the document exists
    const caseDocument = await prisma.caseDocument.findUnique({
      where: { id: caseDocumentId },
    });

    if (!caseDocument) {
      throw new Error('Document not found');
    }

    // Validate document belongs to the same case or client
    if (slot.mapa.caseId) {
      if (caseDocument.caseId !== slot.mapa.caseId) {
        throw new Error('Document must belong to the same case');
      }
    } else if (slot.mapa.clientId) {
      if (caseDocument.clientId !== slot.mapa.clientId) {
        throw new Error('Document must belong to the same client');
      }
    }

    const updatedSlot = await prisma.mapaSlot.update({
      where: { id: slotId },
      data: {
        caseDocumentId,
        assignedAt: new Date(),
        assignedById: userContext.userId,
      },
      include: {
        caseDocument: {
          include: {
            document: true,
          },
        },
        assignedBy: true,
        mapa: true,
      },
    });

    // Check if mapa is now complete (all required slots filled)
    const allSlots = await prisma.mapaSlot.findMany({
      where: { mapaId: updatedSlot.mapaId },
      select: { required: true, caseDocumentId: true },
    });
    const requiredSlots = allSlots.filter((s) => s.required);
    const filledRequiredSlots = requiredSlots.filter((s) => s.caseDocumentId !== null);

    if (requiredSlots.length > 0 && filledRequiredSlots.length === requiredSlots.length) {
      // All required slots are filled - emit mapa completed
      activityEmitter
        .emitMapaCompleted(userContext.firmId, {
          id: updatedSlot.mapa.id,
          name: updatedSlot.mapa.name,
        })
        .catch((err) => console.error('[ActivityEmitter] Mapa complete event failed:', err));
    }

    return updatedSlot;
  }

  /**
   * Unassign a document from a slot
   */
  async unassignDocument(slotId: string, userContext: UserContext) {
    const slot = await prisma.mapaSlot.findUnique({
      where: { id: slotId },
      include: {
        mapa: {
          select: { caseId: true, clientId: true },
        },
      },
    });

    if (!slot) {
      throw new Error('Slot not found');
    }

    // Validate access based on whether it's case-level or client-level mapa
    if (slot.mapa.caseId) {
      await this.validateCaseAccess(slot.mapa.caseId, userContext);
    } else if (slot.mapa.clientId) {
      await this.validateClientAccess(slot.mapa.clientId, userContext);
    } else {
      throw new Error('Mapa has no case or client association');
    }

    const updatedSlot = await prisma.mapaSlot.update({
      where: { id: slotId },
      data: {
        caseDocumentId: null,
        assignedAt: null,
        assignedById: null,
      },
      include: {
        caseDocument: {
          include: {
            document: true,
          },
        },
        assignedBy: true,
      },
    });

    return updatedSlot;
  }

  /**
   * Bulk assign documents to slots
   */
  async bulkAssignDocuments(
    assignments: { slotId: string; caseDocumentId: string }[],
    userContext: UserContext
  ) {
    if (assignments.length === 0) {
      return [];
    }

    // Get all slots and validate access
    const slotIds = assignments.map((a) => a.slotId);
    const slots = await prisma.mapaSlot.findMany({
      where: { id: { in: slotIds } },
      include: {
        mapa: {
          select: { caseId: true },
        },
      },
    });

    if (slots.length !== slotIds.length) {
      throw new Error('Some slots not found');
    }

    // Validate all slots belong to the same case
    const caseIds = new Set(slots.map((s) => s.mapa.caseId));
    if (caseIds.size !== 1) {
      throw new Error('All slots must be from the same case');
    }

    const caseId = slots[0].mapa.caseId;
    await this.validateCaseAccess(caseId, userContext);

    // Validate all documents exist and belong to the same case
    const documentIds = assignments.map((a) => a.caseDocumentId);
    const documents = await prisma.caseDocument.findMany({
      where: { id: { in: documentIds } },
    });

    if (documents.length !== documentIds.length) {
      throw new Error('Some documents not found');
    }

    if (documents.some((d) => d.caseId !== caseId)) {
      throw new Error('All documents must belong to the same case');
    }

    // Update slots in transaction
    const updatedSlots = await prisma.$transaction(
      assignments.map((assignment) =>
        prisma.mapaSlot.update({
          where: { id: assignment.slotId },
          data: {
            caseDocumentId: assignment.caseDocumentId,
            assignedAt: new Date(),
            assignedById: userContext.userId,
          },
          include: {
            caseDocument: {
              include: {
                document: true,
              },
            },
            assignedBy: true,
          },
        })
      )
    );

    // Check if any affected mapa is now complete (all required slots filled)
    const mapaIds = [...new Set(slots.map((s) => s.mapaId))];
    for (const mapaId of mapaIds) {
      const allSlots = await prisma.mapaSlot.findMany({
        where: { mapaId },
        select: { required: true, caseDocumentId: true },
      });
      const requiredSlots = allSlots.filter((s) => s.required);
      const filledRequiredSlots = requiredSlots.filter((s) => s.caseDocumentId !== null);

      if (requiredSlots.length > 0 && filledRequiredSlots.length === requiredSlots.length) {
        // Get mapa name for the event
        const mapa = await prisma.mapa.findUnique({
          where: { id: mapaId },
          select: { id: true, name: true },
        });
        if (mapa) {
          activityEmitter
            .emitMapaCompleted(userContext.firmId, {
              id: mapa.id,
              name: mapa.name,
            })
            .catch((err) => console.error('[ActivityEmitter] Mapa complete event failed:', err));
        }
      }
    }

    return updatedSlots;
  }

  // ==========================================================================
  // Status & Analytics
  // ==========================================================================

  /**
   * Get completion status for a mapa
   */
  async getCompletionStatus(
    mapaId: string,
    userContext: UserContext
  ): Promise<MapaCompletionStatus> {
    const mapa = await prisma.mapa.findUnique({
      where: { id: mapaId },
      select: { caseId: true, clientId: true },
    });

    if (!mapa) {
      throw new Error('Mapa not found');
    }

    // Validate access based on whether it's case-level or client-level mapa
    if (mapa.caseId) {
      await this.validateCaseAccess(mapa.caseId, userContext);
    } else if (mapa.clientId) {
      await this.validateClientAccess(mapa.clientId, userContext);
    } else {
      throw new Error('Mapa has no case or client association');
    }

    const slots = await prisma.mapaSlot.findMany({
      where: { mapaId },
      select: {
        name: true,
        required: true,
        caseDocumentId: true,
      },
    });

    const totalSlots = slots.length;
    const filledSlots = slots.filter((s) => s.caseDocumentId !== null).length;
    const requiredSlots = slots.filter((s) => s.required).length;
    const filledRequiredSlots = slots.filter((s) => s.required && s.caseDocumentId !== null).length;
    const missingRequired = slots
      .filter((s) => s.required && s.caseDocumentId === null)
      .map((s) => s.name);

    return {
      totalSlots,
      filledSlots,
      requiredSlots,
      filledRequiredSlots,
      isComplete: filledRequiredSlots === requiredSlots,
      missingRequired,
    };
  }

  /**
   * Get mapa with slots (alias for getMapa for clarity)
   */
  async getMapaWithSlots(id: string, userContext: UserContext) {
    return this.getMapa(id, userContext);
  }

  // ==========================================================================
  // Template Operations
  // ==========================================================================

  /**
   * Create a new template
   */
  async createTemplate(input: CreateTemplateInput, userContext: UserContext) {
    const template = await prisma.mapaTemplate.create({
      data: {
        firmId: userContext.firmId,
        name: input.name,
        description: input.description,
        caseType: input.caseType,
        slotDefinitions: input.slotDefinitions as unknown as Prisma.InputJsonValue,
        createdById: userContext.userId,
      },
      include: {
        createdBy: true,
      },
    });

    return template;
  }

  /**
   * Get all templates for the firm
   */
  async getFirmTemplates(userContext: UserContext) {
    const templates = await prisma.mapaTemplate.findMany({
      where: {
        firmId: userContext.firmId,
        isActive: true,
      },
      include: {
        createdBy: true,
        _count: {
          select: { mape: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return templates;
  }

  /**
   * Get a specific template
   */
  async getTemplate(id: string, userContext: UserContext) {
    const template = await prisma.mapaTemplate.findUnique({
      where: { id },
      include: {
        createdBy: true,
        _count: {
          select: { mape: true },
        },
      },
    });

    if (!template || template.firmId !== userContext.firmId) {
      return null;
    }

    return template;
  }

  /**
   * Update a template
   */
  async updateTemplate(id: string, input: UpdateTemplateInput, userContext: UserContext) {
    const template = await prisma.mapaTemplate.findUnique({
      where: { id },
    });

    if (!template || template.firmId !== userContext.firmId) {
      throw new Error('Template not found');
    }

    const updatedTemplate = await prisma.mapaTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.caseType !== undefined && { caseType: input.caseType }),
        ...(input.slotDefinitions !== undefined && {
          slotDefinitions: input.slotDefinitions as unknown as Prisma.InputJsonValue,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: {
        createdBy: true,
        _count: {
          select: { mape: true },
        },
      },
    });

    return updatedTemplate;
  }

  /**
   * Delete a template (soft delete by setting isActive = false)
   */
  async deleteTemplate(id: string, userContext: UserContext): Promise<boolean> {
    const template = await prisma.mapaTemplate.findUnique({
      where: { id },
    });

    if (!template || template.firmId !== userContext.firmId) {
      throw new Error('Template not found');
    }

    await prisma.mapaTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return true;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Validate user has access to a case
   */
  private async validateCaseAccess(caseId: string, userContext: UserContext): Promise<void> {
    // Partners have access to all cases in their firm
    if (userContext.role === 'Partner') {
      const caseRecord = await prisma.case.findUnique({
        where: { id: caseId },
        select: { firmId: true },
      });

      if (!caseRecord || caseRecord.firmId !== userContext.firmId) {
        throw new Error('Case not found');
      }

      return;
    }

    // Check if user is assigned to the case
    const assignment = await prisma.caseTeam.findFirst({
      where: {
        caseId,
        userId: userContext.userId,
      },
    });

    if (!assignment) {
      throw new Error('Access denied: Not assigned to this case');
    }
  }

  /**
   * Validate user has access to a client (for client-level mapas)
   */
  private async validateClientAccess(clientId: string, userContext: UserContext): Promise<void> {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { firmId: true },
    });

    if (!client || client.firmId !== userContext.firmId) {
      throw new Error('Client not found');
    }
  }
}

// Export singleton instance
export const mapaService = new MapaService();
