/**
 * Context Profile Service
 * Manages configurable context generation profiles
 */

import { prisma } from '@legal-platform/database';
import type {
  ContextProfile,
  SectionConfig,
  SummarizationLevel,
  ContextTarget,
} from '@legal-platform/types';
import logger from '../utils/logger';

// ============================================================================
// Default Profiles
// ============================================================================

const DEFAULT_PROFILES: Omit<ContextProfile, 'id' | 'firmId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Context Word Add-in',
    code: 'word_addin',
    description: 'Context compact pentru redactarea documentelor în Word',
    isDefault: true,
    targetContext: 'word_addin',
    maxTokens: 2000,
    summarizationLevel: 'standard',
    sections: [
      { sectionId: 'parties', enabled: true, priority: 1, maxItems: 10 },
      { sectionId: 'deadlines', enabled: true, priority: 2, maxItems: 5 },
      {
        sectionId: 'documents',
        enabled: true,
        priority: 3,
        maxItems: 8,
        summarizationLevel: 'brief',
      },
      { sectionId: 'health', enabled: true, priority: 4 },
      { sectionId: 'client', enabled: true, priority: 5, summarizationLevel: 'brief' },
    ],
  },
  {
    name: 'Context Email',
    code: 'email_drafting',
    description: 'Context optimizat pentru generarea răspunsurilor la email',
    isDefault: true,
    targetContext: 'email_drafting',
    maxTokens: 3000,
    summarizationLevel: 'standard',
    sections: [
      { sectionId: 'parties', enabled: true, priority: 1, maxItems: 10 },
      {
        sectionId: 'emails',
        enabled: true,
        priority: 2,
        maxItems: 5,
        summarizationLevel: 'detailed',
      },
      { sectionId: 'deadlines', enabled: true, priority: 3, maxItems: 3 },
      {
        sectionId: 'documents',
        enabled: true,
        priority: 4,
        maxItems: 5,
        summarizationLevel: 'brief',
      },
      { sectionId: 'client', enabled: true, priority: 5 },
    ],
  },
  {
    name: 'Context AI Complet',
    code: 'ai_assistant',
    description: 'Context comprehensiv pentru conversații cu asistentul AI',
    isDefault: true,
    targetContext: 'ai_assistant',
    maxTokens: 4000,
    summarizationLevel: 'detailed',
    sections: [
      { sectionId: 'health', enabled: true, priority: 1 },
      { sectionId: 'parties', enabled: true, priority: 2, maxItems: 15 },
      { sectionId: 'deadlines', enabled: true, priority: 3, maxItems: 10 },
      {
        sectionId: 'documents',
        enabled: true,
        priority: 4,
        maxItems: 10,
        summarizationLevel: 'detailed',
      },
      {
        sectionId: 'emails',
        enabled: true,
        priority: 5,
        maxItems: 8,
        summarizationLevel: 'detailed',
      },
      { sectionId: 'client', enabled: true, priority: 6, summarizationLevel: 'detailed' },
    ],
  },
];

// ============================================================================
// Service
// ============================================================================

export class ContextProfileService {
  /**
   * Get profile by code for a firm
   */
  async getProfileByCode(firmId: string, code: string): Promise<ContextProfile | null> {
    const profile = await prisma.contextProfile.findUnique({
      where: { firmId_code: { firmId, code } },
    });

    if (!profile) return null;

    return {
      ...profile,
      sections: profile.sections as unknown as SectionConfig[],
      summarizationLevel: profile.summarizationLevel as SummarizationLevel,
      targetContext: profile.targetContext as ContextTarget,
    };
  }

  /**
   * Get default profile for a target context
   */
  async getDefaultProfile(
    firmId: string,
    targetContext: ContextTarget
  ): Promise<ContextProfile | null> {
    const profile = await prisma.contextProfile.findFirst({
      where: {
        firmId,
        targetContext,
        isDefault: true,
      },
    });

    if (!profile) {
      // Try to get any profile for this target
      const anyProfile = await prisma.contextProfile.findFirst({
        where: { firmId, targetContext },
      });
      if (anyProfile) {
        return {
          ...anyProfile,
          sections: anyProfile.sections as unknown as SectionConfig[],
          summarizationLevel: anyProfile.summarizationLevel as SummarizationLevel,
          targetContext: anyProfile.targetContext as ContextTarget,
        };
      }
      return null;
    }

    return {
      ...profile,
      sections: profile.sections as unknown as SectionConfig[],
      summarizationLevel: profile.summarizationLevel as SummarizationLevel,
      targetContext: profile.targetContext as ContextTarget,
    };
  }

  /**
   * List all profiles for a firm
   */
  async listProfiles(firmId: string, targetContext?: ContextTarget): Promise<ContextProfile[]> {
    const profiles = await prisma.contextProfile.findMany({
      where: {
        firmId,
        ...(targetContext && { targetContext }),
      },
      orderBy: { name: 'asc' },
    });

    return profiles.map((p) => ({
      ...p,
      sections: p.sections as unknown as SectionConfig[],
      summarizationLevel: p.summarizationLevel as SummarizationLevel,
      targetContext: p.targetContext as ContextTarget,
    }));
  }

  /**
   * Ensure default profiles exist for a firm
   */
  async ensureDefaultProfiles(firmId: string): Promise<void> {
    for (const profile of DEFAULT_PROFILES) {
      const existing = await prisma.contextProfile.findUnique({
        where: { firmId_code: { firmId, code: profile.code } },
      });

      if (!existing) {
        await prisma.contextProfile.create({
          data: {
            firmId,
            name: profile.name,
            code: profile.code,
            description: profile.description,
            isDefault: profile.isDefault,
            targetContext: profile.targetContext,
            maxTokens: profile.maxTokens,
            summarizationLevel: profile.summarizationLevel,
            sections: profile.sections as object,
          },
        });
        logger.info('Created default context profile', { firmId, code: profile.code });
      }
    }
  }

  /**
   * Create or update a profile
   */
  async upsertProfile(
    firmId: string,
    input: {
      id?: string;
      name: string;
      code: string;
      description?: string;
      isDefault?: boolean;
      sections: SectionConfig[];
      maxTokens?: number;
      summarizationLevel?: SummarizationLevel;
      targetContext?: ContextTarget;
    }
  ): Promise<ContextProfile> {
    const data = {
      name: input.name,
      code: input.code,
      description: input.description,
      isDefault: input.isDefault ?? false,
      sections: input.sections as object,
      maxTokens: input.maxTokens ?? 4000,
      summarizationLevel: input.summarizationLevel ?? 'standard',
      targetContext: input.targetContext ?? 'general',
    };

    const profile = input.id
      ? await prisma.contextProfile.update({
          where: { id: input.id },
          data,
        })
      : await prisma.contextProfile.create({
          data: { ...data, firmId },
        });

    return {
      ...profile,
      sections: profile.sections as unknown as SectionConfig[],
      summarizationLevel: profile.summarizationLevel as SummarizationLevel,
      targetContext: profile.targetContext as ContextTarget,
    };
  }
}

export const contextProfileService = new ContextProfileService();
