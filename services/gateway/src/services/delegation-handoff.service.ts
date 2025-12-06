/**
 * Delegation Handoff Service
 * Story 4.5: Team Workload Management
 *
 * Handles delegation handoff notes and AI context generation
 * AC: 4 - Delegation preserves context with automatic handoff notes
 *
 * Business Logic:
 * - Generate AI-powered context summaries
 * - Link related tasks and documents
 * - Preserve delegation history
 */

import { PrismaClient as PrismaClientType } from '@prisma/client';
import type {
  DelegationHandoff,
  GenerateHandoffInput,
  GenerateHandoffResponse,
} from '@legal-platform/types';

/**
 * Delegation Handoff Service
 * Handles handoff notes for task delegations
 */
export class DelegationHandoffService {
  private prisma: PrismaClientType;

  /**
   * Create DelegationHandoffService instance
   *
   * @param prismaClient - Optional Prisma client (for testing)
   */
  constructor(prismaClient?: PrismaClientType) {
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }
  }

  /**
   * Generate handoff notes using AI
   * AC: 4 - Automatic handoff notes with context
   *
   * @param input - Handoff generation input
   * @returns Generated handoff content
   */
  async generateHandoff(input: GenerateHandoffInput): Promise<GenerateHandoffResponse> {
    // Get delegation details
    const delegation = await this.prisma.taskDelegation.findUnique({
      where: { id: input.delegationId },
      include: {
        sourceTask: {
          include: {
            case: {
              select: {
                id: true,
                title: true,
                caseNumber: true,
                type: true,
                client: {
                  select: { name: true },
                },
              },
            },
            subtasks: {
              select: { id: true, title: true, status: true },
            },
            documentLinks: {
              include: {
                document: {
                  select: { id: true, fileName: true },
                },
              },
            },
          },
        },
        delegatedTask: true,
        delegator: {
          select: { firstName: true, lastName: true },
        },
        delegate: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!delegation) {
      throw new Error('Delegation not found');
    }

    const sourceTask = delegation.sourceTask;
    const caseData = sourceTask.case;

    // Build context summary
    const contextParts: string[] = [];

    // Case context
    contextParts.push(
      `Case: ${caseData.caseNumber} - ${caseData.title} (${caseData.type})`
    );
    contextParts.push(`Client: ${caseData.client.name}`);

    // Task context
    contextParts.push(`Task: ${sourceTask.title}`);
    if (sourceTask.description) {
      contextParts.push(`Description: ${sourceTask.description}`);
    }

    // Subtasks status
    if (sourceTask.subtasks.length > 0) {
      const completedCount = sourceTask.subtasks.filter(
        (s) => s.status === 'Completed'
      ).length;
      contextParts.push(
        `Subtasks: ${completedCount}/${sourceTask.subtasks.length} completed`
      );
    }

    // Build handoff notes
    const handoffParts: string[] = [];

    // Add delegator's notes if provided
    if (input.delegatorNotes) {
      handoffParts.push(`Notes from ${delegation.delegator.firstName}: ${input.delegatorNotes}`);
    }

    // Delegation reason
    handoffParts.push(`Reason: ${delegation.reason}`);

    // Delegation period
    handoffParts.push(
      `Coverage period: ${delegation.startDate.toISOString().split('T')[0]} to ${delegation.endDate.toISOString().split('T')[0]}`
    );

    // Include recent activity if requested
    if (input.includeRecentActivity) {
      // Get recent time entries for context
      const recentEntries = await this.prisma.timeEntry.findMany({
        where: {
          taskId: sourceTask.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          description: true,
          hours: true,
          date: true,
        },
      });

      if (recentEntries.length > 0) {
        handoffParts.push('\nRecent Activity:');
        for (const entry of recentEntries) {
          handoffParts.push(
            `- ${entry.date.toISOString().split('T')[0]}: ${entry.description} (${Number(entry.hours)}h)`
          );
        }
      }
    }

    // Get suggested documents
    const suggestedDocs = sourceTask.documentLinks.map((link) => link.document.id);

    // Get suggested related tasks (subtasks)
    const suggestedTasks = sourceTask.subtasks.map((st) => st.id);

    return {
      handoffNotes: handoffParts.join('\n'),
      contextSummary: contextParts.join('\n'),
      suggestedDocs,
      suggestedTasks,
    };
  }

  /**
   * Save handoff notes for a delegation
   *
   * @param delegationId - Delegation ID
   * @param handoff - Handoff data
   * @returns Created handoff record
   */
  async saveHandoff(
    delegationId: string,
    handoffNotes: string,
    contextSummary?: string,
    relatedTaskIds?: string[],
    relatedDocIds?: string[],
    aiGenerated?: boolean
  ): Promise<DelegationHandoff> {
    // Check if handoff already exists
    const existing = await this.prisma.delegationHandoff.findUnique({
      where: { delegationId },
    });

    if (existing) {
      // Update existing
      const updated = await this.prisma.delegationHandoff.update({
        where: { delegationId },
        data: {
          handoffNotes,
          contextSummary,
          relatedTaskIds: relatedTaskIds || [],
          relatedDocIds: relatedDocIds || [],
          aiGenerated: aiGenerated || false,
        },
      });

      return this.mapToHandoff(updated);
    }

    // Create new
    const created = await this.prisma.delegationHandoff.create({
      data: {
        delegationId,
        handoffNotes,
        contextSummary,
        relatedTaskIds: relatedTaskIds || [],
        relatedDocIds: relatedDocIds || [],
        aiGenerated: aiGenerated || false,
      },
    });

    return this.mapToHandoff(created);
  }

  /**
   * Get handoff for a delegation
   *
   * @param delegationId - Delegation ID
   * @returns Handoff record or null
   */
  async getHandoff(delegationId: string): Promise<DelegationHandoff | null> {
    const record = await this.prisma.delegationHandoff.findUnique({
      where: { delegationId },
    });

    return record ? this.mapToHandoff(record) : null;
  }

  /**
   * Map Prisma record to DelegationHandoff type
   */
  private mapToHandoff(record: any): DelegationHandoff {
    return {
      id: record.id,
      delegationId: record.delegationId,
      handoffNotes: record.handoffNotes,
      contextSummary: record.contextSummary || undefined,
      relatedTaskIds: record.relatedTaskIds,
      relatedDocIds: record.relatedDocIds,
      aiGenerated: record.aiGenerated,
      createdAt: record.createdAt,
    };
  }
}

// Export singleton instance
export const delegationHandoffService = new DelegationHandoffService();
