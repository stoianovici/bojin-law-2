/**
 * Communication Template Service
 * Story 5.5: Multi-Channel Communication Hub (AC: 2)
 *
 * Manages reusable communication templates for standardized messages
 */

import { prisma } from '@legal-platform/database';
import { CommunicationChannel, TemplateCategory } from '@prisma/client';
import { templateParser } from '../utils/template-parser';

// ============================================================================
// Types
// ============================================================================

interface TemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required: boolean;
}

interface CreateTemplateInput {
  name: string;
  description?: string;
  category: TemplateCategory;
  channelType: CommunicationChannel;
  subject?: string;
  body: string;
  htmlBody?: string;
  variables: TemplateVariable[];
  isGlobal: boolean;
}

interface UpdateTemplateInput {
  name?: string;
  description?: string;
  category?: TemplateCategory;
  channelType?: CommunicationChannel;
  subject?: string;
  body?: string;
  htmlBody?: string;
  variables?: TemplateVariable[];
  isGlobal?: boolean;
  isActive?: boolean;
}

interface TemplateFilter {
  category?: TemplateCategory;
  channelType?: CommunicationChannel;
  isActive?: boolean;
  isGlobal?: boolean;
  searchTerm?: string;
}

interface CommunicationTemplate {
  id: string;
  firmId: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  channelType: CommunicationChannel;
  subject?: string;
  body: string;
  htmlBody?: string;
  variables: TemplateVariable[];
  isActive: boolean;
  isGlobal: boolean;
  createdBy: string;
  usageCount: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface RenderedTemplate {
  subject?: string;
  body: string;
  htmlBody?: string;
}

interface UserContext {
  userId: string;
  firmId: string;
}

// ============================================================================
// Service
// ============================================================================

export class CommunicationTemplateService {
  /**
   * Create a new communication template
   */
  async createTemplate(
    input: CreateTemplateInput,
    userContext: UserContext
  ): Promise<CommunicationTemplate> {
    // Extract variables from template body to validate
    const extractedVars = templateParser.extractVariables(input.body);
    const declaredVarNames = input.variables.map((v) => v.name);

    // Warn if there are variables in body not declared
    for (const v of extractedVars) {
      if (!declaredVarNames.includes(v)) {
        console.warn(`Variable {{${v}}} found in template but not declared in variables list`);
      }
    }

    const template = await prisma.communicationTemplate.create({
      data: {
        firmId: userContext.firmId,
        name: input.name,
        description: input.description,
        category: input.category,
        channelType: input.channelType,
        subject: input.subject,
        body: input.body,
        htmlBody: input.htmlBody,
        variables: input.variables as any,
        isGlobal: input.isGlobal,
        isActive: true,
        createdBy: userContext.userId,
        usageCount: 0,
      },
    });

    return this.mapToTemplate(template);
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    id: string,
    input: UpdateTemplateInput,
    userContext: UserContext
  ): Promise<CommunicationTemplate> {
    // Verify template exists and belongs to firm
    const existing = await prisma.communicationTemplate.findFirst({
      where: { id, firmId: userContext.firmId },
    });

    if (!existing) {
      throw new Error('Template not found');
    }

    // Only creator or global templates by admins can be updated
    if (existing.createdBy !== userContext.userId && !existing.isGlobal) {
      throw new Error('Only the creator can update this template');
    }

    const template = await prisma.communicationTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        category: input.category,
        channelType: input.channelType,
        subject: input.subject,
        body: input.body,
        htmlBody: input.htmlBody,
        variables: input.variables as any,
        isGlobal: input.isGlobal,
        isActive: input.isActive,
      },
    });

    return this.mapToTemplate(template);
  }

  /**
   * Soft delete a template (set isActive = false)
   */
  async deleteTemplate(id: string, userContext: UserContext): Promise<boolean> {
    const existing = await prisma.communicationTemplate.findFirst({
      where: { id, firmId: userContext.firmId },
    });

    if (!existing) {
      throw new Error('Template not found');
    }

    await prisma.communicationTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return true;
  }

  /**
   * Get a template by ID
   */
  async getTemplate(id: string, userContext: UserContext): Promise<CommunicationTemplate | null> {
    const template = await prisma.communicationTemplate.findFirst({
      where: {
        id,
        OR: [{ firmId: userContext.firmId }, { isGlobal: true }],
      },
    });

    return template ? this.mapToTemplate(template) : null;
  }

  /**
   * List templates with filtering
   */
  async listTemplates(
    filter: TemplateFilter,
    userContext: UserContext,
    options?: { limit?: number; offset?: number }
  ): Promise<{ templates: CommunicationTemplate[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const where: any = {
      OR: [{ firmId: userContext.firmId }, { isGlobal: true }],
    };

    if (filter.category) {
      where.category = filter.category;
    }
    if (filter.channelType) {
      where.channelType = filter.channelType;
    }
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }
    if (filter.isGlobal !== undefined) {
      where.isGlobal = filter.isGlobal;
    }
    if (filter.searchTerm) {
      where.AND = [
        {
          OR: [
            { name: { contains: filter.searchTerm, mode: 'insensitive' } },
            { description: { contains: filter.searchTerm, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [templates, total] = await Promise.all([
      prisma.communicationTemplate.findMany({
        where,
        orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
      }),
      prisma.communicationTemplate.count({ where }),
    ]);

    return {
      templates: templates.map((t) => this.mapToTemplate(t)),
      total,
    };
  }

  /**
   * Render a template with variable values
   */
  async renderTemplate(
    templateId: string,
    variables: Record<string, string>,
    userContext: UserContext
  ): Promise<RenderedTemplate> {
    const template = await this.getTemplate(templateId, userContext);

    if (!template) {
      throw new Error('Template not found');
    }

    // Validate required variables
    const missingRequired = template.variables
      .filter((v) => v.required && !variables[v.name])
      .map((v) => v.name);

    if (missingRequired.length > 0) {
      throw new Error(`Missing required variables: ${missingRequired.join(', ')}`);
    }

    // Add default values for missing optional variables
    const allVariables = { ...variables };
    for (const v of template.variables) {
      if (!allVariables[v.name] && v.defaultValue) {
        allVariables[v.name] = v.defaultValue;
      }
    }

    // Render template
    const renderedBody = templateParser.replaceVariables(template.body, allVariables);
    const renderedSubject = template.subject
      ? templateParser.replaceVariables(template.subject, allVariables)
      : undefined;
    const renderedHtmlBody = template.htmlBody
      ? templateParser.replaceVariables(template.htmlBody, allVariables)
      : undefined;

    return {
      subject: renderedSubject,
      body: renderedBody,
      htmlBody: renderedHtmlBody,
    };
  }

  /**
   * Increment usage count for a template
   */
  async incrementUsageCount(templateId: string): Promise<void> {
    await prisma.communicationTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  /**
   * Get popular templates for a channel type
   */
  async getPopularTemplates(
    channelType: CommunicationChannel,
    userContext: UserContext,
    limit: number = 5
  ): Promise<CommunicationTemplate[]> {
    const templates = await prisma.communicationTemplate.findMany({
      where: {
        channelType,
        isActive: true,
        OR: [{ firmId: userContext.firmId }, { isGlobal: true }],
      },
      orderBy: { usageCount: 'desc' },
      take: limit,
    });

    return templates.map((t) => this.mapToTemplate(t));
  }

  /**
   * Duplicate a template
   */
  async duplicateTemplate(
    templateId: string,
    newName: string,
    userContext: UserContext
  ): Promise<CommunicationTemplate> {
    const original = await this.getTemplate(templateId, userContext);

    if (!original) {
      throw new Error('Template not found');
    }

    return this.createTemplate(
      {
        name: newName,
        description: original.description,
        category: original.category,
        channelType: original.channelType,
        subject: original.subject,
        body: original.body,
        htmlBody: original.htmlBody,
        variables: original.variables,
        isGlobal: false, // Duplicates are always private
      },
      userContext
    );
  }

  /**
   * Map Prisma result to CommunicationTemplate type
   */
  private mapToTemplate(template: any): CommunicationTemplate {
    return {
      id: template.id,
      firmId: template.firmId,
      name: template.name,
      description: template.description || undefined,
      category: template.category,
      channelType: template.channelType,
      subject: template.subject || undefined,
      body: template.body,
      htmlBody: template.htmlBody || undefined,
      variables: (template.variables as TemplateVariable[]) || [],
      isActive: template.isActive,
      isGlobal: template.isGlobal,
      createdBy: template.createdBy,
      usageCount: template.usageCount,
      lastUsedAt: template.lastUsedAt || undefined,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}

// Export singleton instance
export const communicationTemplateService = new CommunicationTemplateService();
