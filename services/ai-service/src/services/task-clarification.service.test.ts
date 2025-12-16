/**
 * Task Clarification Service Tests
 * Story 4.1: Natural Language Task Parser - Task 15
 */

import { taskClarification, ClarificationContext } from './task-clarification.service';
import type { NLPTaskParseResponse, ClarificationQuestion } from '@legal-platform/types';

describe('TaskClarificationService', () => {
  // Mock parsed response with low confidence values
  const createMockParsedResponse = (
    overrides?: Partial<NLPTaskParseResponse>
  ): NLPTaskParseResponse => ({
    parseId: 'parse-123',
    originalText: 'Test task input',
    detectedLanguage: 'ro',
    parsedTask: {
      taskType: { value: 'Meeting', confidence: 0.8 },
      title: { value: 'Test Task', confidence: 0.9 },
      description: { value: null, confidence: 0 },
      dueDate: { value: null, confidence: 0 },
      dueTime: { value: null, confidence: 0 },
      priority: { value: 'Medium', confidence: 0.7 },
      assigneeName: { value: null, confidence: 0 },
      assigneeId: { value: null, confidence: 0 },
      caseReference: { value: null, confidence: 0 },
      caseId: { value: null, confidence: 0 },
    },
    entities: [],
    overallConfidence: 0.7,
    clarificationsNeeded: [],
    isComplete: true,
    ...overrides,
  });

  const mockContext: ClarificationContext = {
    activeCases: [
      { id: 'case-1', caseNumber: '123/2024', title: 'Contract Dispute', clientName: 'ABC Corp' },
      { id: 'case-2', caseNumber: '456/2024', title: 'Employment Case', clientName: 'XYZ Ltd' },
      { id: 'case-3', caseNumber: '789/2024', title: 'Property Claim', clientName: 'John Doe' },
    ],
    teamMembers: [
      { id: 'user-1', name: 'Ion Popescu', role: 'Partner' },
      { id: 'user-2', name: 'Maria Ionescu', role: 'Associate' },
      { id: 'user-3', name: 'Andrei Pop', role: 'Paralegal' },
    ],
  };

  describe('detectAmbiguities', () => {
    it('should not add clarifications when all fields are confident and caseId is set', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          caseReference: { value: 'case-123', confidence: 0.9 },
          caseId: { value: 'case-123', confidence: 0.9 },
        },
      });
      // Context with single case - no case clarification needed
      const singleCaseContext: ClarificationContext = {
        ...mockContext,
        activeCases: [mockContext.activeCases![0]],
      };
      const result = taskClarification.detectAmbiguities(parsed, singleCaseContext);

      expect(result).toEqual([]);
    });

    it('should add case clarification when no case reference and multiple active cases', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          caseReference: { value: null, confidence: 0 },
          caseId: { value: null, confidence: 0 },
        },
      });

      const result = taskClarification.detectAmbiguities(parsed, mockContext);

      const caseQuestion = result.find((q) => q.entityType === 'case');
      expect(caseQuestion).toBeDefined();
      expect(caseQuestion?.question).toContain('dosar');
      expect(caseQuestion?.options).toHaveLength(3);
      expect(caseQuestion?.allowFreeText).toBe(true);
    });

    it('should not add case clarification when user has only one active case', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          caseReference: { value: null, confidence: 0 },
        },
      });

      const singleCaseContext: ClarificationContext = {
        ...mockContext,
        activeCases: [mockContext.activeCases![0]],
      };

      const result = taskClarification.detectAmbiguities(parsed, singleCaseContext);

      const caseQuestion = result.find((q) => q.entityType === 'case');
      expect(caseQuestion).toBeUndefined();
    });

    it('should add assignee clarification when assignee name has low confidence', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          caseReference: { value: 'case-123', confidence: 0.9 },
          assigneeName: { value: 'Pop', confidence: 0.3 },
        },
      });

      // Single case context to avoid case clarification
      const singleCaseContext: ClarificationContext = {
        ...mockContext,
        activeCases: [mockContext.activeCases![0]],
      };

      const result = taskClarification.detectAmbiguities(parsed, singleCaseContext);

      const assigneeQuestion = result.find((q) => q.entityType === 'assignee');
      expect(assigneeQuestion).toBeDefined();
      expect(assigneeQuestion?.question).toContain('aloc');
    });

    it('should add assignee clarification when multiple team members match', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          caseReference: { value: 'case-123', confidence: 0.9 },
          assigneeName: { value: 'Ion', confidence: 0.7 },
        },
      });

      const contextWithSimilarNames: ClarificationContext = {
        activeCases: [{ id: 'case-1', caseNumber: '123/2024', title: 'Test', clientName: 'Test' }],
        teamMembers: [
          { id: 'user-1', name: 'Ion Popescu', role: 'Partner' },
          { id: 'user-2', name: 'Ion Ionescu', role: 'Associate' },
        ],
      };

      const result = taskClarification.detectAmbiguities(parsed, contextWithSimilarNames);

      const assigneeQuestion = result.find((q) => q.entityType === 'assignee');
      expect(assigneeQuestion).toBeDefined();
      expect(assigneeQuestion?.options).toHaveLength(2);
    });

    it('should add task type clarification when task type has low confidence', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          caseReference: { value: 'case-123', confidence: 0.9 },
          taskType: { value: null, confidence: 0.3 },
        },
      });

      // Single case context to avoid case clarification
      const singleCaseContext: ClarificationContext = {
        ...mockContext,
        activeCases: [mockContext.activeCases![0]],
      };

      const result = taskClarification.detectAmbiguities(parsed, singleCaseContext);

      const taskTypeQuestion = result.find((q) => q.entityType === 'taskType');
      expect(taskTypeQuestion).toBeDefined();
      expect(taskTypeQuestion?.question).toContain('tip');
      expect(taskTypeQuestion?.options).toBeDefined();
      expect(taskTypeQuestion?.options!.length).toBeGreaterThan(0);
    });

    it('should add date clarification when date entity exists but low confidence', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          caseReference: { value: 'case-123', confidence: 0.9 },
          dueDate: { value: null, confidence: 0.3 },
        },
        entities: [
          {
            type: 'date',
            value: 'maybe tomorrow',
            normalizedValue: null,
            startIndex: 0,
            endIndex: 14,
            confidence: 0.3,
          },
        ],
      });

      // Single case context to avoid case clarification
      const singleCaseContext: ClarificationContext = {
        ...mockContext,
        activeCases: [mockContext.activeCases![0]],
      };

      const result = taskClarification.detectAmbiguities(parsed, singleCaseContext);

      const dateQuestion = result.find((q) => q.entityType === 'date');
      expect(dateQuestion).toBeDefined();
      expect(dateQuestion?.allowFreeText).toBe(true);
    });

    it('should not add date clarification when no date entity exists', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          caseReference: { value: 'case-123', confidence: 0.9 },
          dueDate: { value: null, confidence: 0 },
        },
        entities: [],
      });

      // Single case context
      const singleCaseContext: ClarificationContext = {
        ...mockContext,
        activeCases: [mockContext.activeCases![0]],
      };

      const result = taskClarification.detectAmbiguities(parsed, singleCaseContext);

      const dateQuestion = result.find((q) => q.entityType === 'date');
      expect(dateQuestion).toBeUndefined();
    });

    it('should generate questions in English when detected language is English', () => {
      const parsed = createMockParsedResponse({
        detectedLanguage: 'en',
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          caseReference: { value: 'case-123', confidence: 0.9 },
          taskType: { value: null, confidence: 0.3 },
        },
      });

      // Single case context
      const singleCaseContext: ClarificationContext = {
        ...mockContext,
        activeCases: [mockContext.activeCases![0]],
      };

      const result = taskClarification.detectAmbiguities(parsed, singleCaseContext);

      const taskTypeQuestion = result.find((q) => q.entityType === 'taskType');
      expect(taskTypeQuestion?.question).toContain('type');
    });

    it('should limit case options to 4', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          caseReference: { value: null, confidence: 0 },
        },
      });

      const manyCase: ClarificationContext = {
        ...mockContext,
        activeCases: [
          { id: 'case-1', caseNumber: '1/2024', title: 'Case 1', clientName: 'Client 1' },
          { id: 'case-2', caseNumber: '2/2024', title: 'Case 2', clientName: 'Client 2' },
          { id: 'case-3', caseNumber: '3/2024', title: 'Case 3', clientName: 'Client 3' },
          { id: 'case-4', caseNumber: '4/2024', title: 'Case 4', clientName: 'Client 4' },
          { id: 'case-5', caseNumber: '5/2024', title: 'Case 5', clientName: 'Client 5' },
          { id: 'case-6', caseNumber: '6/2024', title: 'Case 6', clientName: 'Client 6' },
        ],
      };

      const result = taskClarification.detectAmbiguities(parsed, manyCase);

      const caseQuestion = result.find((q) => q.entityType === 'case');
      expect(caseQuestion?.options).toHaveLength(4);
    });
  });

  describe('applyClarification', () => {
    it('should apply case clarification answer', () => {
      const parsed = createMockParsedResponse({
        clarificationsNeeded: [
          {
            id: 'q1',
            entityType: 'case',
            question: 'Which case?',
            options: [],
            allowFreeText: true,
          },
        ],
        isComplete: false,
      });

      const result = taskClarification.applyClarification(parsed, 'q1', 'case-1', mockContext);

      expect(result.parsedTask.caseId.value).toBe('case-1');
      expect(result.parsedTask.caseId.confidence).toBe(1.0);
      expect(result.clarificationsNeeded).toHaveLength(0);
    });

    it('should apply assignee clarification answer and resolve name', () => {
      const parsed = createMockParsedResponse({
        clarificationsNeeded: [
          { id: 'q1', entityType: 'assignee', question: 'Who?', options: [], allowFreeText: true },
        ],
        isComplete: false,
      });

      const result = taskClarification.applyClarification(parsed, 'q1', 'user-1', mockContext);

      expect(result.parsedTask.assigneeId.value).toBe('user-1');
      expect(result.parsedTask.assigneeId.confidence).toBe(1.0);
      expect(result.parsedTask.assigneeName.value).toBe('Ion Popescu');
    });

    it('should apply task type clarification answer', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          taskType: { value: null, confidence: 0 },
          title: { value: 'Test', confidence: 0.8 },
        },
        clarificationsNeeded: [
          {
            id: 'q1',
            entityType: 'taskType',
            question: 'What type?',
            options: [],
            allowFreeText: false,
          },
        ],
        isComplete: false,
      });

      const result = taskClarification.applyClarification(parsed, 'q1', 'Meeting');

      expect(result.parsedTask.taskType.value).toBe('Meeting');
      expect(result.parsedTask.taskType.confidence).toBe(1.0);
    });

    it('should apply date clarification answer', () => {
      const parsed = createMockParsedResponse({
        clarificationsNeeded: [
          {
            id: 'q1',
            entityType: 'date',
            question: 'When?',
            options: undefined,
            allowFreeText: true,
          },
        ],
        isComplete: false,
      });

      const result = taskClarification.applyClarification(parsed, 'q1', '2024-12-15');

      expect(result.parsedTask.dueDate.value).toEqual(new Date('2024-12-15'));
      expect(result.parsedTask.dueDate.confidence).toBe(1.0);
    });

    it('should handle invalid date gracefully', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          dueDate: { value: new Date('2024-12-01'), confidence: 0.5 },
        },
        clarificationsNeeded: [
          {
            id: 'q1',
            entityType: 'date',
            question: 'When?',
            options: undefined,
            allowFreeText: true,
          },
        ],
        isComplete: false,
      });

      const result = taskClarification.applyClarification(parsed, 'q1', 'invalid-date');

      // Should keep original date
      expect(result.parsedTask.dueDate.value).toEqual(new Date('2024-12-01'));
    });

    it('should not modify response for unknown question ID', () => {
      const parsed = createMockParsedResponse({
        clarificationsNeeded: [
          {
            id: 'q1',
            entityType: 'case',
            question: 'Which case?',
            options: [],
            allowFreeText: true,
          },
        ],
      });

      const result = taskClarification.applyClarification(parsed, 'unknown-id', 'case-1');

      expect(result).toEqual(parsed);
    });

    it('should update isComplete when all clarifications resolved and required fields present', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          taskType: { value: null, confidence: 0 },
          title: { value: 'Test Task', confidence: 0.9 },
        },
        clarificationsNeeded: [
          {
            id: 'q1',
            entityType: 'taskType',
            question: 'What type?',
            options: [],
            allowFreeText: false,
          },
        ],
        isComplete: false,
      });

      const result = taskClarification.applyClarification(parsed, 'q1', 'Meeting');

      expect(result.isComplete).toBe(true);
    });

    it('should not set isComplete if required fields still missing', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          taskType: { value: null, confidence: 0 },
          title: { value: null, confidence: 0 },
        },
        clarificationsNeeded: [
          {
            id: 'q1',
            entityType: 'taskType',
            question: 'What type?',
            options: [],
            allowFreeText: false,
          },
        ],
        isComplete: false,
      });

      const result = taskClarification.applyClarification(parsed, 'q1', 'Meeting');

      expect(result.isComplete).toBe(false);
    });
  });

  describe('getLocalizedStrings', () => {
    it('should return Romanian strings for ro language', () => {
      const strings = taskClarification.getLocalizedStrings('ro');

      expect(strings.caseQuestion).toContain('dosar');
      expect(strings.taskTypes.Meeting).toBe('Întâlnire');
    });

    it('should return English strings for en language', () => {
      const strings = taskClarification.getLocalizedStrings('en');

      expect(strings.caseQuestion).toContain('case');
      expect(strings.taskTypes.Meeting).toBe('Meeting');
    });
  });

  describe('question generation', () => {
    it('should include case context in options', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          caseReference: { value: null, confidence: 0 },
        },
      });

      const result = taskClarification.detectAmbiguities(parsed, mockContext);

      const caseQuestion = result.find((q) => q.entityType === 'case');
      const firstOption = caseQuestion?.options?.[0];
      expect(firstOption?.context).toContain('Contract Dispute');
      expect(firstOption?.context).toContain('ABC Corp');
    });

    it('should include team member role in assignee options context', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          assigneeName: { value: 'Ion', confidence: 0.3 },
        },
      });

      const result = taskClarification.detectAmbiguities(parsed, mockContext);

      const assigneeQuestion = result.find((q) => q.entityType === 'assignee');
      const firstOption = assigneeQuestion?.options?.[0];
      expect(firstOption?.context).toBeDefined();
    });

    it('should generate unique IDs for each question', () => {
      // Use multiple active cases to trigger case clarification
      // Use low confidence task type to trigger taskType clarification
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          taskType: { value: null, confidence: 0 },
          caseReference: { value: null, confidence: 0 },
        },
      });

      const result = taskClarification.detectAmbiguities(parsed, mockContext);

      const ids = result.map((q) => q.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds).toHaveLength(ids.length);
    });

    it('should add hint about multiple matches for assignee', () => {
      const parsed = createMockParsedResponse({
        parsedTask: {
          ...createMockParsedResponse().parsedTask,
          caseReference: { value: 'case-123', confidence: 0.9 },
          assigneeName: { value: 'Ion', confidence: 0.7 },
        },
      });

      const contextWithSimilarNames: ClarificationContext = {
        activeCases: [{ id: 'case-1', caseNumber: '123/2024', title: 'Test', clientName: 'Test' }],
        teamMembers: [
          { id: 'user-1', name: 'Ion Popescu', role: 'Partner' },
          { id: 'user-2', name: 'Ion Ionescu', role: 'Associate' },
        ],
      };

      const result = taskClarification.detectAmbiguities(parsed, contextWithSimilarNames);

      const assigneeQuestion = result.find((q) => q.entityType === 'assignee');
      expect(assigneeQuestion?.question).toContain('potriviri');
    });
  });
});
