// Story 4.4: Task Template Service
// Manages task templates for case workflows

import { prisma, TaskTemplate, CaseType } from '@legal-platform/database';

// Class wrapper for compatibility with resolvers
export class TaskTemplateService {
  createTemplate = createTemplate;
  updateTemplate = updateTemplate;
  deleteTemplate = deleteTemplate;
  getTemplateById = getTemplateById;
  getTemplates = getTemplates;
  duplicateTemplate = duplicateTemplate;
}

// ============================================================================
// Input Types
// ============================================================================

export interface CreateTemplateInput {
  name: string;
  description?: string;
  caseType?: CaseType;
  isDefault?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  caseType?: CaseType;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface TemplateFilters {
  caseType?: CaseType;
  activeOnly?: boolean;
}

// ============================================================================
// Template CRUD Operations (AC: 1)
// ============================================================================

export async function createTemplate(
  input: CreateTemplateInput,
  userId: string,
  firmId: string
): Promise<TaskTemplate> {
  return prisma.taskTemplate.create({
    data: {
      firmId,
      name: input.name,
      description: input.description,
      caseType: input.caseType,
      isDefault: input.isDefault ?? false,
      createdBy: userId,
    },
  });
}

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput,
  userId: string,
  firmId: string
): Promise<TaskTemplate> {
  // Verify template belongs to user's firm
  const template = await prisma.taskTemplate.findUnique({
    where: { id },
  });

  if (!template || template.firmId !== firmId) {
    throw new Error('Template not found or access denied');
  }

  return prisma.taskTemplate.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      caseType: input.caseType,
      isDefault: input.isDefault,
      isActive: input.isActive,
    },
  });
}

export async function deleteTemplate(id: string, userId: string, firmId: string): Promise<void> {
  // Verify template belongs to user's firm
  const template = await prisma.taskTemplate.findUnique({
    where: { id },
  });

  if (!template || template.firmId !== firmId) {
    throw new Error('Template not found or access denied');
  }

  // Soft delete by marking as inactive
  await prisma.taskTemplate.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function getTemplateById(id: string, firmId: string): Promise<TaskTemplate | null> {
  return prisma.taskTemplate.findFirst({
    where: {
      id,
      firmId,
    },
  });
}

export async function getTemplates(
  firmId: string,
  filters?: TemplateFilters
): Promise<TaskTemplate[]> {
  return prisma.taskTemplate.findMany({
    where: {
      firmId,
      ...(filters?.caseType && { caseType: filters.caseType }),
      ...(filters?.activeOnly && { isActive: true }),
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
}

export async function duplicateTemplate(
  id: string,
  newName: string,
  userId: string,
  firmId: string
): Promise<TaskTemplate> {
  const original = await prisma.taskTemplate.findUnique({
    where: { id },
  });

  if (!original || original.firmId !== firmId) {
    throw new Error('Template not found or access denied');
  }

  // Create new template as a simple copy
  return prisma.taskTemplate.create({
    data: {
      firmId,
      name: newName,
      description: original.description,
      caseType: original.caseType,
      isDefault: false,
      createdBy: userId,
    },
  });
}
