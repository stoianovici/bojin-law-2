/**
 * Document Structure Preference Service
 * Story 5.6: AI Learning and Personalization (Task 13)
 *
 * Handles document structure preferences per document type.
 * Learns from user's document creation patterns to maintain consistent structure.
 */

import { prisma } from '@legal-platform/database';
import { Prisma } from '@prisma/client';
import type {
  DocumentStructurePreference,
  DocumentStructurePreferenceInput,
  SectionPreference,
  HeaderStylePreference,
  MarginPreferences,
  FontPreferences,
} from '@legal-platform/types';

// Input types
interface CreatePreferenceInput {
  documentType: string;
  preferredSections: SectionPreference[];
  headerStyle: HeaderStylePreference;
  footerContent?: string;
  marginPreferences?: MarginPreferences;
  fontPreferences?: FontPreferences;
}

interface UpdatePreferenceInput {
  preferredSections?: SectionPreference[];
  headerStyle?: HeaderStylePreference;
  footerContent?: string | null;
  marginPreferences?: MarginPreferences | null;
  fontPreferences?: FontPreferences | null;
}

export class DocumentStructurePreferenceService {
  /**
   * Create a new document structure preference
   */
  async createPreference(
    input: CreatePreferenceInput,
    userId: string,
    firmId: string
  ): Promise<DocumentStructurePreference> {
    // Check for existing preference for this document type
    const existing = await prisma.documentStructurePreference.findUnique({
      where: {
        userId_documentType: {
          userId,
          documentType: input.documentType,
        },
      },
    });

    if (existing) {
      throw new Error(
        `Preferințele pentru tipul de document "${input.documentType}" există deja`
      );
    }

    // Validate sections
    this.validateSections(input.preferredSections);

    const preference = await prisma.documentStructurePreference.create({
      data: {
        firmId,
        userId,
        documentType: input.documentType,
        preferredSections: input.preferredSections as object[],
        headerStyle: input.headerStyle as object,
        footerContent: input.footerContent,
        marginPreferences: input.marginPreferences as object,
        fontPreferences: input.fontPreferences as object,
        usageCount: 0,
      },
    });

    return this.mapToPreference(preference);
  }

  /**
   * Update an existing preference
   */
  async updatePreference(
    preferenceId: string,
    input: UpdatePreferenceInput,
    userId: string
  ): Promise<DocumentStructurePreference> {
    // Verify ownership
    const existing = await prisma.documentStructurePreference.findFirst({
      where: {
        id: preferenceId,
        userId,
      },
    });

    if (!existing) {
      throw new Error('Preferința nu a fost găsită');
    }

    // Validate sections if provided
    if (input.preferredSections) {
      this.validateSections(input.preferredSections);
    }

    const updateData: Prisma.DocumentStructurePreferenceUpdateInput = {};

    if (input.preferredSections) {
      updateData.preferredSections = input.preferredSections as unknown as Prisma.InputJsonValue[];
    }
    if (input.headerStyle) {
      updateData.headerStyle = input.headerStyle as unknown as Prisma.InputJsonValue;
    }
    if (input.footerContent !== undefined) {
      updateData.footerContent = input.footerContent;
    }
    if (input.marginPreferences !== undefined) {
      updateData.marginPreferences = input.marginPreferences === null
        ? Prisma.JsonNull
        : input.marginPreferences as unknown as Prisma.InputJsonValue;
    }
    if (input.fontPreferences !== undefined) {
      updateData.fontPreferences = input.fontPreferences === null
        ? Prisma.JsonNull
        : input.fontPreferences as unknown as Prisma.InputJsonValue;
    }

    const updated = await prisma.documentStructurePreference.update({
      where: { id: preferenceId },
      data: updateData,
    });

    return this.mapToPreference(updated);
  }

  /**
   * Delete a preference
   */
  async deletePreference(preferenceId: string, userId: string): Promise<boolean> {
    const preference = await prisma.documentStructurePreference.findFirst({
      where: {
        id: preferenceId,
        userId,
      },
    });

    if (!preference) {
      throw new Error('Preferința nu a fost găsită');
    }

    await prisma.documentStructurePreference.delete({
      where: { id: preferenceId },
    });

    return true;
  }

  /**
   * Get preference by ID
   */
  async getPreferenceById(
    preferenceId: string,
    userId: string
  ): Promise<DocumentStructurePreference | null> {
    const preference = await prisma.documentStructurePreference.findFirst({
      where: {
        id: preferenceId,
        userId,
      },
    });

    return preference ? this.mapToPreference(preference) : null;
  }

  /**
   * Get preference by document type
   */
  async getPreferenceByType(
    documentType: string,
    userId: string
  ): Promise<DocumentStructurePreference | null> {
    const preference = await prisma.documentStructurePreference.findUnique({
      where: {
        userId_documentType: {
          userId,
          documentType,
        },
      },
    });

    return preference ? this.mapToPreference(preference) : null;
  }

  /**
   * Get all preferences for a user
   */
  async getUserPreferences(userId: string): Promise<DocumentStructurePreference[]> {
    const preferences = await prisma.documentStructurePreference.findMany({
      where: { userId },
      orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
    });

    return preferences.map(this.mapToPreference);
  }

  /**
   * Get all configured document types for a user
   */
  async getConfiguredDocumentTypes(userId: string): Promise<string[]> {
    const preferences = await prisma.documentStructurePreference.findMany({
      where: { userId },
      select: { documentType: true },
      orderBy: { usageCount: 'desc' },
    });

    return preferences.map((p) => p.documentType);
  }

  /**
   * Record usage of a preference (when document is created with these settings)
   */
  async recordUsage(
    documentType: string,
    userId: string
  ): Promise<DocumentStructurePreference | null> {
    const preference = await prisma.documentStructurePreference.findUnique({
      where: {
        userId_documentType: {
          userId,
          documentType,
        },
      },
    });

    if (!preference) {
      return null;
    }

    const updated = await prisma.documentStructurePreference.update({
      where: { id: preference.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return this.mapToPreference(updated);
  }

  /**
   * Learn preferences from a document (analyze and create/update preferences)
   */
  async learnFromDocument(
    documentType: string,
    sections: SectionPreference[],
    headerStyle: HeaderStylePreference,
    userId: string,
    firmId: string
  ): Promise<DocumentStructurePreference> {
    const existing = await prisma.documentStructurePreference.findUnique({
      where: {
        userId_documentType: {
          userId,
          documentType,
        },
      },
    });

    if (existing) {
      // Merge with existing preferences
      const mergedSections = this.mergeSections(
        existing.preferredSections as unknown as SectionPreference[],
        sections
      );

      const updated = await prisma.documentStructurePreference.update({
        where: { id: existing.id },
        data: {
          preferredSections: mergedSections as object[],
          headerStyle: headerStyle as object,
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      return this.mapToPreference(updated);
    } else {
      // Create new preference
      return this.createPreference(
        {
          documentType,
          preferredSections: sections,
          headerStyle,
        },
        userId,
        firmId
      );
    }
  }

  /**
   * Reorder sections in a preference
   */
  async reorderSections(
    preferenceId: string,
    sectionOrders: { name: string; order: number }[],
    userId: string
  ): Promise<DocumentStructurePreference> {
    const preference = await prisma.documentStructurePreference.findFirst({
      where: {
        id: preferenceId,
        userId,
      },
    });

    if (!preference) {
      throw new Error('Preferința nu a fost găsită');
    }

    const sections = preference.preferredSections as unknown as SectionPreference[];
    const updatedSections = sections.map((section) => {
      const newOrder = sectionOrders.find((o) => o.name === section.name);
      return {
        ...section,
        order: newOrder ? newOrder.order : section.order,
      };
    });

    // Sort by order
    updatedSections.sort((a, b) => a.order - b.order);

    const updated = await prisma.documentStructurePreference.update({
      where: { id: preferenceId },
      data: {
        preferredSections: updatedSections as object[],
      },
    });

    return this.mapToPreference(updated);
  }

  /**
   * Get most used document type
   */
  async getMostUsedDocumentType(userId: string): Promise<string | null> {
    const preference = await prisma.documentStructurePreference.findFirst({
      where: {
        userId,
        usageCount: { gt: 0 },
      },
      orderBy: { usageCount: 'desc' },
      select: { documentType: true },
    });

    return preference?.documentType ?? null;
  }

  /**
   * Validate sections array
   */
  private validateSections(sections: SectionPreference[]): void {
    if (!Array.isArray(sections) || sections.length === 0) {
      throw new Error('Secțiunile sunt obligatorii');
    }

    const names = new Set<string>();
    for (const section of sections) {
      if (!section.name || section.name.length > 100) {
        throw new Error('Numele secțiunii este invalid');
      }
      if (names.has(section.name.toLowerCase())) {
        throw new Error(`Secțiunea "${section.name}" este duplicată`);
      }
      names.add(section.name.toLowerCase());
    }
  }

  /**
   * Merge sections from existing and new document
   */
  private mergeSections(
    existing: SectionPreference[],
    newSections: SectionPreference[]
  ): SectionPreference[] {
    const merged = new Map<string, SectionPreference>();

    // Add existing sections
    for (const section of existing) {
      merged.set(section.name.toLowerCase(), section);
    }

    // Merge new sections
    for (const section of newSections) {
      const key = section.name.toLowerCase();
      if (merged.has(key)) {
        // Keep existing but update required status if now required
        const existing = merged.get(key)!;
        merged.set(key, {
          ...existing,
          required: existing.required || section.required,
        });
      } else {
        merged.set(key, section);
      }
    }

    // Convert to array and sort by order
    return Array.from(merged.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Map Prisma model to domain type
   */
  private mapToPreference(preference: {
    id: string;
    firmId: string;
    userId: string;
    documentType: string;
    preferredSections: unknown;
    headerStyle: unknown;
    footerContent: string | null;
    marginPreferences: unknown;
    fontPreferences: unknown;
    usageCount: number;
    lastUsedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): DocumentStructurePreference {
    return {
      id: preference.id,
      firmId: preference.firmId,
      userId: preference.userId,
      documentType: preference.documentType,
      preferredSections: preference.preferredSections as unknown as SectionPreference[],
      headerStyle: preference.headerStyle as unknown as HeaderStylePreference,
      footerContent: preference.footerContent,
      marginPreferences: preference.marginPreferences as unknown as MarginPreferences | null,
      fontPreferences: preference.fontPreferences as unknown as FontPreferences | null,
      usageCount: preference.usageCount,
      lastUsedAt: preference.lastUsedAt,
      createdAt: preference.createdAt,
      updatedAt: preference.updatedAt,
    };
  }
}

// Export singleton instance
export const documentStructurePreferenceService =
  new DocumentStructurePreferenceService();
