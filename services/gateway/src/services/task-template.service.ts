// Story 4.4: Task Template Service
// Manages task templates and template steps with dependency validation

import { prisma, TaskTemplate, TaskTemplateStep, TemplateStepDependency, TaskTypeEnum, CaseType, OffsetType, DependencyType } from '@legal-platform/database';

// Class wrapper for compatibility with resolvers
export class TaskTemplateService {
  createTemplate = createTemplate;
  updateTemplate = updateTemplate;
  deleteTemplate = deleteTemplate;
  getTemplateById = getTemplateById;
  getTemplates = getTemplates;
  duplicateTemplate = duplicateTemplate;
  addStep = addStep;
  updateStep = updateStep;
  removeStep = removeStep;
  reorderSteps = reorderSteps;
  addStepDependency = addStepDependency;
  removeStepDependency = removeStepDependency;
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

export interface CreateStepInput {
  taskType: TaskTypeEnum;
  title: string;
  description?: string;
  estimatedHours?: number;
  typeMetadata?: Record<string, unknown>;
  offsetDays: number;
  offsetFrom: OffsetType;
  isParallel?: boolean;
  isCriticalPath?: boolean;
}

export interface UpdateStepInput {
  taskType?: TaskTypeEnum;
  title?: string;
  description?: string;
  estimatedHours?: number;
  typeMetadata?: Record<string, unknown>;
  offsetDays?: number;
  offsetFrom?: OffsetType;
  isParallel?: boolean;
  isCriticalPath?: boolean;
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
    include: {
      steps: {
        include: {
          dependsOn: true,
          dependents: true,
        },
        orderBy: {
          stepOrder: 'asc',
        },
      },
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
    include: {
      steps: {
        include: {
          dependsOn: true,
          dependents: true,
        },
        orderBy: {
          stepOrder: 'asc',
        },
      },
    },
  });
}

export async function deleteTemplate(
  id: string,
  userId: string,
  firmId: string
): Promise<void> {
  // Verify template belongs to user's firm
  const template = await prisma.taskTemplate.findUnique({
    where: { id },
  });

  if (!template || template.firmId !== firmId) {
    throw new Error('Template not found or access denied');
  }

  // Check if template has been used
  const usageCount = await prisma.taskTemplateUsage.count({
    where: { templateId: id },
  });

  if (usageCount > 0) {
    // Soft delete - mark as inactive
    await prisma.taskTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  } else {
    // Hard delete if never used
    await prisma.taskTemplate.delete({
      where: { id },
    });
  }
}

export async function getTemplateById(
  id: string,
  firmId: string
): Promise<TaskTemplate | null> {
  return prisma.taskTemplate.findFirst({
    where: {
      id,
      firmId,
    },
    include: {
      steps: {
        include: {
          dependsOn: true,
          dependents: true,
        },
        orderBy: {
          stepOrder: 'asc',
        },
      },
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
    include: {
      steps: {
        include: {
          dependsOn: true,
          dependents: true,
        },
        orderBy: {
          stepOrder: 'asc',
        },
      },
    },
    orderBy: [
      { isDefault: 'desc' },
      { name: 'asc' },
    ],
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
    include: {
      steps: {
        include: {
          dependsOn: true,
        },
      },
    },
  });

  if (!original || original.firmId !== firmId) {
    throw new Error('Template not found or access denied');
  }

  // Create new template with steps in a transaction
  return prisma.$transaction(async (tx) => {
    const newTemplate = await tx.taskTemplate.create({
      data: {
        firmId,
        name: newName,
        description: original.description,
        caseType: original.caseType,
        isDefault: false,
        createdBy: userId,
      },
    });

    // Map old step IDs to new step IDs
    const stepIdMap = new Map<string, string>();

    // Create new steps
    for (const step of original.steps) {
      const newStep = await tx.taskTemplateStep.create({
        data: {
          templateId: newTemplate.id,
          stepOrder: step.stepOrder,
          taskType: step.taskType,
          title: step.title,
          description: step.description,
          estimatedHours: step.estimatedHours,
          typeMetadata: step.typeMetadata as any,
          offsetDays: step.offsetDays,
          offsetFrom: step.offsetFrom,
          isParallel: step.isParallel,
          isCriticalPath: step.isCriticalPath,
        },
      });
      stepIdMap.set(step.id, newStep.id);
    }

    // Create dependencies using new step IDs
    for (const step of original.steps) {
      for (const dependency of step.dependsOn) {
        await tx.templateStepDependency.create({
          data: {
            sourceStepId: stepIdMap.get(dependency.sourceStepId)!,
            targetStepId: stepIdMap.get(dependency.targetStepId)!,
            dependencyType: dependency.dependencyType,
            lagDays: dependency.lagDays,
          },
        });
      }
    }

    return tx.taskTemplate.findUniqueOrThrow({
      where: { id: newTemplate.id },
      include: {
        steps: {
          include: {
            dependsOn: true,
            dependents: true,
          },
          orderBy: {
            stepOrder: 'asc',
          },
        },
      },
    });
  });
}

// ============================================================================
// Step Management (AC: 1)
// ============================================================================

export async function addStep(
  templateId: string,
  input: CreateStepInput,
  firmId: string
): Promise<TaskTemplateStep> {
  // Verify template belongs to user's firm
  const template = await prisma.taskTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template || template.firmId !== firmId) {
    throw new Error('Template not found or access denied');
  }

  // Get next step order
  const lastStep = await prisma.taskTemplateStep.findFirst({
    where: { templateId },
    orderBy: { stepOrder: 'desc' },
  });

  const stepOrder = lastStep ? lastStep.stepOrder + 1 : 1;

  return prisma.taskTemplateStep.create({
    data: {
      templateId,
      stepOrder,
      taskType: input.taskType,
      title: input.title,
      description: input.description,
      estimatedHours: input.estimatedHours,
      typeMetadata: input.typeMetadata as any,
      offsetDays: input.offsetDays,
      offsetFrom: input.offsetFrom,
      isParallel: input.isParallel ?? false,
      isCriticalPath: input.isCriticalPath ?? false,
    },
    include: {
      dependsOn: true,
      dependents: true,
    },
  });
}

export async function updateStep(
  stepId: string,
  input: UpdateStepInput,
  firmId: string
): Promise<TaskTemplateStep> {
  // Verify step belongs to template in user's firm
  const step = await prisma.taskTemplateStep.findUnique({
    where: { id: stepId },
    include: { template: true },
  });

  if (!step || step.template.firmId !== firmId) {
    throw new Error('Step not found or access denied');
  }

  return prisma.taskTemplateStep.update({
    where: { id: stepId },
    data: {
      taskType: input.taskType,
      title: input.title,
      description: input.description,
      estimatedHours: input.estimatedHours,
      typeMetadata: input.typeMetadata as any,
      offsetDays: input.offsetDays,
      offsetFrom: input.offsetFrom,
      isParallel: input.isParallel,
      isCriticalPath: input.isCriticalPath,
    },
    include: {
      dependsOn: true,
      dependents: true,
    },
  });
}

export async function removeStep(
  stepId: string,
  firmId: string
): Promise<void> {
  // Verify step belongs to template in user's firm
  const step = await prisma.taskTemplateStep.findUnique({
    where: { id: stepId },
    include: { template: true },
  });

  if (!step || step.template.firmId !== firmId) {
    throw new Error('Step not found or access denied');
  }

  await prisma.taskTemplateStep.delete({
    where: { id: stepId },
  });

  // Reorder remaining steps
  const remainingSteps = await prisma.taskTemplateStep.findMany({
    where: { templateId: step.templateId },
    orderBy: { stepOrder: 'asc' },
  });

  await Promise.all(
    remainingSteps.map((s, index) =>
      prisma.taskTemplateStep.update({
        where: { id: s.id },
        data: { stepOrder: index + 1 },
      })
    )
  );
}

export async function reorderSteps(
  templateId: string,
  stepIds: string[],
  firmId: string
): Promise<TaskTemplateStep[]> {
  // Verify template belongs to user's firm
  const template = await prisma.taskTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template || template.firmId !== firmId) {
    throw new Error('Template not found or access denied');
  }

  // Update step orders in a transaction
  await prisma.$transaction(
    stepIds.map((stepId, index) =>
      prisma.taskTemplateStep.update({
        where: { id: stepId },
        data: { stepOrder: index + 1 },
      })
    )
  );

  return prisma.taskTemplateStep.findMany({
    where: { templateId },
    include: {
      dependsOn: true,
      dependents: true,
    },
    orderBy: { stepOrder: 'asc' },
  });
}

// ============================================================================
// Dependency Management (AC: 1, 2)
// ============================================================================

/**
 * Validates that adding a dependency won't create a cycle using DFS
 */
async function validateNoCycle(
  sourceStepId: string,
  targetStepId: string
): Promise<boolean> {
  // Build adjacency list of dependencies
  const dependencies = await prisma.templateStepDependency.findMany();
  const graph = new Map<string, string[]>();

  for (const dep of dependencies) {
    if (!graph.has(dep.targetStepId)) {
      graph.set(dep.targetStepId, []);
    }
    graph.get(dep.targetStepId)!.push(dep.sourceStepId);
  }

  // Add the proposed edge
  if (!graph.has(targetStepId)) {
    graph.set(targetStepId, []);
  }
  graph.get(targetStepId)!.push(sourceStepId);

  // DFS to detect cycle
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycleDFS(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycleDFS(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        return true; // Cycle detected
      }
    }

    recursionStack.delete(node);
    return false;
  }

  // Check all nodes
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      if (hasCycleDFS(node)) {
        return false; // Cycle detected
      }
    }
  }

  return true; // No cycle
}

export async function addStepDependency(
  sourceStepId: string,
  targetStepId: string,
  type: DependencyType,
  lagDays: number = 0,
  firmId: string
): Promise<TemplateStepDependency> {
  // Verify steps belong to same template in user's firm
  const sourceStep = await prisma.taskTemplateStep.findUnique({
    where: { id: sourceStepId },
    include: { template: true },
  });

  const targetStep = await prisma.taskTemplateStep.findUnique({
    where: { id: targetStepId },
    include: { template: true },
  });

  if (
    !sourceStep ||
    !targetStep ||
    sourceStep.templateId !== targetStep.templateId ||
    sourceStep.template.firmId !== firmId
  ) {
    throw new Error('Steps not found or belong to different templates');
  }

  // Validate no cycle
  const noCycle = await validateNoCycle(sourceStepId, targetStepId);
  if (!noCycle) {
    throw new Error('Adding this dependency would create a circular dependency');
  }

  return prisma.templateStepDependency.create({
    data: {
      sourceStepId,
      targetStepId,
      dependencyType: type,
      lagDays,
    },
  });
}

export async function removeStepDependency(
  dependencyId: string,
  firmId: string
): Promise<void> {
  // Verify dependency belongs to template in user's firm
  const dependency = await prisma.templateStepDependency.findUnique({
    where: { id: dependencyId },
    include: {
      sourceStep: {
        include: { template: true },
      },
    },
  });

  if (!dependency || dependency.sourceStep.template.firmId !== firmId) {
    throw new Error('Dependency not found or access denied');
  }

  await prisma.templateStepDependency.delete({
    where: { id: dependencyId },
  });
}
