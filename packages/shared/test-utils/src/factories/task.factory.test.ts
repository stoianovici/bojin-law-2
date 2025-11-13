/**
 * Task Factory Tests
 */

import {
  createTask,
  createResearchTask,
  createDocumentCreationTask,
  createDocumentRetrievalTask,
  createCourtDateTask,
  createMeetingTask,
  createBusinessTripTask,
  createTasks,
} from './task.factory';

describe('Task Factory', () => {
  describe('createTask', () => {
    it('should create a valid Task entity', () => {
      const task = createTask();

      expect(task).toMatchObject({
        id: expect.any(String),
        caseId: expect.any(String),
        type: expect.stringMatching(
          /^(Research|DocumentCreation|DocumentRetrieval|CourtDate|Meeting|BusinessTrip)$/
        ),
        title: expect.any(String),
        description: expect.any(String),
        assignedTo: expect.any(String),
        dueDate: expect.any(Date),
        status: expect.stringMatching(/^(Pending|InProgress|Completed|Cancelled)$/),
        priority: expect.stringMatching(/^(Low|Medium|High|Urgent)$/),
        metadata: expect.any(Object),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should generate appropriate metadata for each task type', () => {
      const research = createTask({ type: 'Research' });
      const documentCreation = createTask({ type: 'DocumentCreation' });
      const documentRetrieval = createTask({ type: 'DocumentRetrieval' });
      const courtDate = createTask({ type: 'CourtDate' });
      const meeting = createTask({ type: 'Meeting' });
      const businessTrip = createTask({ type: 'BusinessTrip' });

      expect(research.metadata).toHaveProperty('jurisdiction');
      expect(research.metadata).toHaveProperty('legalArea');

      expect(documentCreation.metadata).toHaveProperty('documentType');
      expect(documentCreation.metadata).toHaveProperty('aiAssisted');

      expect(documentRetrieval.metadata).toHaveProperty('source');
      expect(documentRetrieval.metadata).toHaveProperty('urgent');

      expect(courtDate.metadata).toHaveProperty('courtName');
      expect(courtDate.metadata).toHaveProperty('hearingType');

      expect(meeting.metadata).toHaveProperty('location');
      expect(meeting.metadata).toHaveProperty('attendees');

      expect(businessTrip.metadata).toHaveProperty('destination');
      expect(businessTrip.metadata).toHaveProperty('transportType');
    });

    it('should accept overrides', () => {
      const customTitle = 'Custom Task Title';
      const task = createTask({
        title: customTitle,
        type: 'Research',
        priority: 'High',
      });

      expect(task.title).toBe(customTitle);
      expect(task.type).toBe('Research');
      expect(task.priority).toBe('High');
    });

    it('should set dueDate in the future', () => {
      const task = createTask();
      const now = new Date();
      expect(task.dueDate.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should include Romanian task titles', () => {
      // Run multiple times to increase chance of getting Romanian titles
      const tasks = Array.from({ length: 50 }, () => createTask());
      const hasRomanianTitle = tasks.some((t) => /[ăâîșț]/i.test(t.title));

      expect(hasRomanianTitle).toBe(true);
    });
  });

  describe('createResearchTask', () => {
    it('should create a Task with Research type', () => {
      const task = createResearchTask();
      expect(task.type).toBe('Research');
    });

    it('should have research-specific metadata', () => {
      const task = createResearchTask();
      expect(task.metadata).toHaveProperty('jurisdiction');
      expect(task.metadata).toHaveProperty('legalArea');
      expect(task.metadata).toHaveProperty('estimatedHours');
    });

    it('should accept overrides while maintaining Research type', () => {
      const task = createResearchTask({ title: 'Legal Research Task' });
      expect(task.type).toBe('Research');
      expect(task.title).toBe('Legal Research Task');
    });
  });

  describe('createDocumentCreationTask', () => {
    it('should create a Task with DocumentCreation type', () => {
      const task = createDocumentCreationTask();
      expect(task.type).toBe('DocumentCreation');
    });

    it('should have document creation-specific metadata', () => {
      const task = createDocumentCreationTask();
      expect(task.metadata).toHaveProperty('documentType');
      expect(task.metadata).toHaveProperty('template');
      expect(task.metadata).toHaveProperty('aiAssisted');
    });

    it('should accept overrides while maintaining DocumentCreation type', () => {
      const task = createDocumentCreationTask({ title: 'Draft Contract' });
      expect(task.type).toBe('DocumentCreation');
      expect(task.title).toBe('Draft Contract');
    });
  });

  describe('createDocumentRetrievalTask', () => {
    it('should create a Task with DocumentRetrieval type', () => {
      const task = createDocumentRetrievalTask();
      expect(task.type).toBe('DocumentRetrieval');
    });

    it('should have document retrieval-specific metadata', () => {
      const task = createDocumentRetrievalTask();
      expect(task.metadata).toHaveProperty('source');
      expect(task.metadata).toHaveProperty('urgent');
      expect(task.metadata).toHaveProperty('estimatedDays');
    });

    it('should accept overrides while maintaining DocumentRetrieval type', () => {
      const task = createDocumentRetrievalTask({ title: 'Retrieve Court Files' });
      expect(task.type).toBe('DocumentRetrieval');
      expect(task.title).toBe('Retrieve Court Files');
    });
  });

  describe('createCourtDateTask', () => {
    it('should create a Task with CourtDate type', () => {
      const task = createCourtDateTask();
      expect(task.type).toBe('CourtDate');
    });

    it('should have court date-specific metadata', () => {
      const task = createCourtDateTask();
      expect(task.metadata).toHaveProperty('courtName');
      expect(task.metadata).toHaveProperty('courtroom');
      expect(task.metadata).toHaveProperty('hearingType');
      expect(task.metadata).toHaveProperty('requiresPreparation');
    });

    it('should accept overrides while maintaining CourtDate type', () => {
      const task = createCourtDateTask({ title: 'Initial Hearing' });
      expect(task.type).toBe('CourtDate');
      expect(task.title).toBe('Initial Hearing');
    });
  });

  describe('createMeetingTask', () => {
    it('should create a Task with Meeting type', () => {
      const task = createMeetingTask();
      expect(task.type).toBe('Meeting');
    });

    it('should have meeting-specific metadata', () => {
      const task = createMeetingTask();
      expect(task.metadata).toHaveProperty('location');
      expect(task.metadata).toHaveProperty('attendees');
      expect(task.metadata).toHaveProperty('duration');
    });

    it('should accept overrides while maintaining Meeting type', () => {
      const task = createMeetingTask({ title: 'Client Consultation' });
      expect(task.type).toBe('Meeting');
      expect(task.title).toBe('Client Consultation');
    });
  });

  describe('createBusinessTripTask', () => {
    it('should create a Task with BusinessTrip type', () => {
      const task = createBusinessTripTask();
      expect(task.type).toBe('BusinessTrip');
    });

    it('should have business trip-specific metadata', () => {
      const task = createBusinessTripTask();
      expect(task.metadata).toHaveProperty('destination');
      expect(task.metadata).toHaveProperty('transportType');
      expect(task.metadata).toHaveProperty('overnight');
      expect(task.metadata).toHaveProperty('estimatedCost');
    });

    it('should accept overrides while maintaining BusinessTrip type', () => {
      const task = createBusinessTripTask({ title: 'Court Appearance' });
      expect(task.type).toBe('BusinessTrip');
      expect(task.title).toBe('Court Appearance');
    });
  });

  describe('createTasks', () => {
    it('should create specified number of tasks', () => {
      const tasks = createTasks(5);
      expect(tasks).toHaveLength(5);
    });

    it('should create tasks with different IDs', () => {
      const tasks = createTasks(10);
      const ids = tasks.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    it('should apply overrides to all tasks', () => {
      const tasks = createTasks(3, { type: 'Research' });
      tasks.forEach((task) => {
        expect(task.type).toBe('Research');
      });
    });

    it('should create variety of task types when no override', () => {
      const tasks = createTasks(30);
      const types = new Set(tasks.map((t) => t.type));
      // Should have multiple different types
      expect(types.size).toBeGreaterThan(1);
    });
  });
});
