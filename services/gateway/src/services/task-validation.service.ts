/**
 * Task Validation Service
 * Story 4.2: Task Type System Implementation
 *
 * Validates tasks based on their type-specific requirements
 */

import {
  TaskType,
  TASK_TYPE_VALIDATION_RULES,
  TaskTypeValidationRule,
} from '@legal-platform/types';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface CreateTaskInput {
  caseId: string;
  type: TaskType;
  title: string;
  description?: string;
  assignedTo: string;
  dueDate: Date;
  dueTime?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  estimatedHours?: number;
  typeMetadata?: Record<string, unknown>;
}

/**
 * Validates a task based on its type-specific requirements
 */
export function validateTaskByType(input: CreateTaskInput): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate basic required fields
  if (!input.title || input.title.trim() === '') {
    errors.push({ field: 'title', message: 'Title is required' });
  }

  if (!input.caseId) {
    errors.push({ field: 'caseId', message: 'Case ID is required' });
  }

  if (!input.assignedTo) {
    errors.push({ field: 'assignedTo', message: 'Assignee is required' });
  }

  if (!input.dueDate) {
    errors.push({ field: 'dueDate', message: 'Due date is required' });
  }

  // Validate dueTime format if provided (HH:mm)
  if (input.dueTime) {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(input.dueTime)) {
      errors.push({
        field: 'dueTime',
        message: 'Due time must be in HH:mm format (00:00 to 23:59)',
      });
    }
  }

  // Validate type-specific metadata
  const typeValidationRules = TASK_TYPE_VALIDATION_RULES[input.type];
  if (typeValidationRules && input.typeMetadata) {
    for (const rule of typeValidationRules) {
      const fieldValue = input.typeMetadata[rule.field];

      if (rule.required && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
        errors.push({ field: rule.field, message: rule.errorMessage });
      }

      if (rule.validation && fieldValue !== undefined && fieldValue !== null) {
        if (!rule.validation(fieldValue)) {
          errors.push({ field: rule.field, message: rule.errorMessage });
        }
      }
    }
  } else if (typeValidationRules && typeValidationRules.length > 0) {
    // If there are required fields but no metadata provided
    const requiredFields = typeValidationRules.filter(r => r.required);
    if (requiredFields.length > 0) {
      errors.push({
        field: 'typeMetadata',
        message: `Type-specific metadata is required for ${input.type} tasks`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates type-specific metadata structure
 */
export function validateTypeMetadata(
  type: TaskType,
  metadata: Record<string, unknown>,
): ValidationResult {
  const errors: ValidationError[] = [];
  const rules = TASK_TYPE_VALIDATION_RULES[type];

  for (const rule of rules) {
    const fieldValue = metadata[rule.field];

    if (rule.required && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
      errors.push({ field: rule.field, message: rule.errorMessage });
    }

    if (rule.validation && fieldValue !== undefined && fieldValue !== null) {
      if (!rule.validation(fieldValue)) {
        errors.push({ field: rule.field, message: rule.errorMessage });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
