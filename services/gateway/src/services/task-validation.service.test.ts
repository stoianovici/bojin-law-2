/**
 * Task Validation Service Unit Tests
 * Story 4.2: Task Type System Implementation - Task 22
 *
 * Tests for task validation with type-specific requirements
 */

import {
  validateTaskByType,
  validateTypeMetadata,
  CreateTaskInput,
} from './task-validation.service';

describe('TaskValidationService', () => {
  describe('validateTaskByType', () => {
    const validBaseTask: CreateTaskInput = {
      caseId: 'case-123',
      type: 'Research',
      title: 'Research case law',
      assignedTo: 'user-123',
      dueDate: new Date('2025-12-31'),
      priority: 'High',
    };

    it('should validate required base fields', () => {
      const result = validateTaskByType(validBaseTask);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'typeMetadata',
            message: 'Type-specific metadata is required for Research tasks',
          }),
        ])
      );
    });

    it('should reject task with missing title', () => {
      const task = { ...validBaseTask, title: '' };
      const result = validateTaskByType(task);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'title',
        message: 'Title is required',
      });
    });

    it('should reject task with missing caseId', () => {
      const task = { ...validBaseTask, caseId: '' };
      const result = validateTaskByType(task);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'caseId',
        message: 'Case ID is required',
      });
    });

    it('should reject task with missing assignedTo', () => {
      const task = { ...validBaseTask, assignedTo: '' };
      const result = validateTaskByType(task);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'assignedTo',
        message: 'Assignee is required',
      });
    });

    it('should validate dueTime format (HH:mm)', () => {
      const invalidTimes = ['9:00', '25:00', '12:60', 'noon', '12:00:00'];

      invalidTimes.forEach((time) => {
        const task = { ...validBaseTask, dueTime: time, typeMetadata: { researchTopic: 'Test' } };
        const result = validateTaskByType(task);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'dueTime',
          message: 'Due time must be in HH:mm format (00:00 to 23:59)',
        });
      });
    });

    it('should accept valid dueTime format', () => {
      const validTimes = ['00:00', '09:30', '12:00', '23:59'];

      validTimes.forEach((time) => {
        const task = {
          ...validBaseTask,
          dueTime: time,
          typeMetadata: { researchTopic: 'Test' },
        };
        const result = validateTaskByType(task);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    // Research task validation
    it('should validate Research task requires researchTopic', () => {
      const task: CreateTaskInput = {
        ...validBaseTask,
        type: 'Research',
        typeMetadata: {},
      };

      const result = validateTaskByType(task);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'researchTopic',
        message: 'Research topic is required',
      });
    });

    it('should accept valid Research task', () => {
      const task: CreateTaskInput = {
        ...validBaseTask,
        type: 'Research',
        typeMetadata: {
          researchTopic: 'Patent law precedents',
          jurisdiction: 'Federal',
        },
      };

      const result = validateTaskByType(task);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    // DocumentCreation task validation
    it('should validate DocumentCreation task requires documentType', () => {
      const task: CreateTaskInput = {
        ...validBaseTask,
        type: 'DocumentCreation',
        typeMetadata: {},
      };

      const result = validateTaskByType(task);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'documentType',
        message: 'Document type is required',
      });
    });

    it('should accept valid DocumentCreation task', () => {
      const task: CreateTaskInput = {
        ...validBaseTask,
        type: 'DocumentCreation',
        typeMetadata: {
          documentType: 'Contract',
          templateId: 'template-123',
        },
      };

      const result = validateTaskByType(task);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    // DocumentRetrieval task validation
    it('should validate DocumentRetrieval task requires documentDescription', () => {
      const task: CreateTaskInput = {
        ...validBaseTask,
        type: 'DocumentRetrieval',
        typeMetadata: {},
      };

      const result = validateTaskByType(task);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'documentDescription',
        message: 'Document description is required',
      });
    });

    it('should accept valid DocumentRetrieval task', () => {
      const task: CreateTaskInput = {
        ...validBaseTask,
        type: 'DocumentRetrieval',
        typeMetadata: {
          documentDescription: 'Certificate of incorporation',
          sourceLocation: 'Court Registry',
        },
      };

      const result = validateTaskByType(task);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    // CourtDate task validation
    it('should validate CourtDate task requires all mandatory fields', () => {
      const task: CreateTaskInput = {
        ...validBaseTask,
        type: 'CourtDate',
        typeMetadata: {},
      };

      const result = validateTaskByType(task);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          { field: 'courtName', message: 'Court name is required' },
          { field: 'caseNumber', message: 'Court case number is required' },
          { field: 'hearingType', message: 'Hearing type is required' },
        ])
      );
    });

    it('should accept valid CourtDate task', () => {
      const task: CreateTaskInput = {
        ...validBaseTask,
        type: 'CourtDate',
        typeMetadata: {
          courtName: 'Superior Court of Justice',
          caseNumber: 'CV-2025-001234',
          hearingType: 'Motion',
          judge: 'Justice Smith',
        },
      };

      const result = validateTaskByType(task);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    // Meeting task validation
    it('should validate Meeting task requires meetingType', () => {
      const task: CreateTaskInput = {
        ...validBaseTask,
        type: 'Meeting',
        typeMetadata: {},
      };

      const result = validateTaskByType(task);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'meetingType',
        message: 'Meeting type is required',
      });
    });

    it('should accept valid Meeting task', () => {
      const task: CreateTaskInput = {
        ...validBaseTask,
        type: 'Meeting',
        typeMetadata: {
          meetingType: 'Client',
          location: 'Conference Room A',
          agenda: 'Discuss settlement options',
        },
      };

      const result = validateTaskByType(task);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    // BusinessTrip task validation
    it('should validate BusinessTrip task requires destination and purpose', () => {
      const task: CreateTaskInput = {
        ...validBaseTask,
        type: 'BusinessTrip',
        typeMetadata: {},
      };

      const result = validateTaskByType(task);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          { field: 'destination', message: 'Destination is required' },
          { field: 'purpose', message: 'Trip purpose is required' },
        ])
      );
    });

    it('should accept valid BusinessTrip task', () => {
      const task: CreateTaskInput = {
        ...validBaseTask,
        type: 'BusinessTrip',
        typeMetadata: {
          destination: 'Toronto, ON',
          purpose: 'Court appearance',
          delegationRequired: true,
        },
      };

      const result = validateTaskByType(task);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('validateTypeMetadata', () => {
    it('should validate Research metadata', () => {
      const result = validateTypeMetadata('Research', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'researchTopic',
        message: 'Research topic is required',
      });
    });

    it('should accept valid Research metadata', () => {
      const result = validateTypeMetadata('Research', {
        researchTopic: 'Environmental regulations',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate CourtDate metadata', () => {
      const result = validateTypeMetadata('CourtDate', {
        courtName: 'Court of Appeal',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should accept valid CourtDate metadata', () => {
      const result = validateTypeMetadata('CourtDate', {
        courtName: 'Court of Appeal',
        caseNumber: 'CA-2025-5678',
        hearingType: 'Appeal',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
