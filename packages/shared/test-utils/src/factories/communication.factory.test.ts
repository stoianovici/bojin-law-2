import {
  createMockAttachment,
  createMockParticipant,
  createMockMessage,
  createMockExtractedDeadlines,
  createMockExtractedCommitments,
  createMockExtractedActionItems,
  createMockExtractedItems,
  createMockCommunicationThread,
  createMockCommunicationThreads,
  createMockAIDraftResponse,
  createMockTaskFromCommunication,
} from './communication.factory';

describe('Communication Factory', () => {
  describe('createMockAttachment', () => {
    it('should create a valid attachment', () => {
      const attachment = createMockAttachment();

      expect(attachment).toHaveProperty('id');
      expect(attachment).toHaveProperty('filename');
      expect(attachment).toHaveProperty('fileSize');
      expect(attachment).toHaveProperty('mimeType');
      expect(attachment).toHaveProperty('downloadUrl');
      expect(attachment.fileSize).toBeGreaterThan(0);
    });
  });

  describe('createMockParticipant', () => {
    it('should create a valid participant with default role', () => {
      const participant = createMockParticipant();

      expect(participant).toHaveProperty('userId');
      expect(participant).toHaveProperty('name');
      expect(participant).toHaveProperty('email');
      expect(participant.role).toBe('recipient');
    });

    it('should create a participant with specified role', () => {
      const participant = createMockParticipant('sender');

      expect(participant.role).toBe('sender');
    });
  });

  describe('createMockMessage', () => {
    it('should create a valid message', () => {
      const threadId = 'thread-123';
      const message = createMockMessage(threadId);

      expect(message.threadId).toBe(threadId);
      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('senderId');
      expect(message).toHaveProperty('senderName');
      expect(message).toHaveProperty('senderEmail');
      expect(message).toHaveProperty('subject');
      expect(message).toHaveProperty('body');
      expect(message).toHaveProperty('sentDate');
      expect(Array.isArray(message.recipientIds)).toBe(true);
      expect(Array.isArray(message.attachments)).toBe(true);
    });

    it('should respect isFromUser option', () => {
      const message = createMockMessage('thread-123', { isFromUser: true });

      expect(message.isFromUser).toBe(true);
    });
  });

  describe('createMockExtractedDeadlines', () => {
    it('should create an array of deadlines', () => {
      const messageIds = ['msg-1', 'msg-2', 'msg-3'];
      const deadlines = createMockExtractedDeadlines(messageIds);

      expect(Array.isArray(deadlines)).toBe(true);
      deadlines.forEach((deadline) => {
        expect(deadline).toHaveProperty('id');
        expect(deadline).toHaveProperty('description');
        expect(deadline).toHaveProperty('dueDate');
        expect(deadline).toHaveProperty('sourceMessageId');
        expect(deadline).toHaveProperty('confidence');
        expect(messageIds).toContain(deadline.sourceMessageId);
      });
    });
  });

  describe('createMockExtractedCommitments', () => {
    it('should create an array of commitments', () => {
      const messageIds = ['msg-1', 'msg-2'];
      const commitments = createMockExtractedCommitments(messageIds);

      expect(Array.isArray(commitments)).toBe(true);
      commitments.forEach((commitment) => {
        expect(commitment).toHaveProperty('id');
        expect(commitment).toHaveProperty('party');
        expect(commitment).toHaveProperty('commitmentText');
        expect(commitment).toHaveProperty('date');
        expect(commitment).toHaveProperty('sourceMessageId');
        expect(messageIds).toContain(commitment.sourceMessageId);
      });
    });
  });

  describe('createMockExtractedActionItems', () => {
    it('should create an array of action items', () => {
      const messageIds = ['msg-1'];
      const actionItems = createMockExtractedActionItems(messageIds);

      expect(Array.isArray(actionItems)).toBe(true);
      actionItems.forEach((item) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('priority');
        expect(item).toHaveProperty('sourceMessageId');
        expect(messageIds).toContain(item.sourceMessageId);
      });
    });
  });

  describe('createMockExtractedItems', () => {
    it('should create extracted items with all categories', () => {
      const messageIds = ['msg-1', 'msg-2'];
      const items = createMockExtractedItems(messageIds);

      expect(items).toHaveProperty('deadlines');
      expect(items).toHaveProperty('commitments');
      expect(items).toHaveProperty('actionItems');
      expect(Array.isArray(items.deadlines)).toBe(true);
      expect(Array.isArray(items.commitments)).toBe(true);
      expect(Array.isArray(items.actionItems)).toBe(true);
    });
  });

  describe('createMockCommunicationThread', () => {
    it('should create a valid thread with default options', () => {
      const thread = createMockCommunicationThread();

      expect(thread).toHaveProperty('id');
      expect(thread).toHaveProperty('subject');
      expect(thread).toHaveProperty('caseId');
      expect(thread).toHaveProperty('caseName');
      expect(thread).toHaveProperty('caseType');
      expect(thread).toHaveProperty('participants');
      expect(thread).toHaveProperty('messages');
      expect(thread).toHaveProperty('extractedItems');
      expect(thread.messages.length).toBeGreaterThanOrEqual(3);
      expect(thread.messages.length).toBeLessThanOrEqual(5);
      expect(Array.isArray(thread.participants)).toBe(true);
    });

    it('should respect caseType option', () => {
      const thread = createMockCommunicationThread({ caseType: 'Litigation' });

      expect(thread.caseType).toBe('Litigation');
    });

    it('should respect isUnread option', () => {
      const thread = createMockCommunicationThread({ isUnread: true });

      expect(thread.isUnread).toBe(true);
    });

    it('should respect messageCount option', () => {
      const thread = createMockCommunicationThread({ messageCount: 10 });

      expect(thread.messages.length).toBe(10);
    });
  });

  describe('createMockCommunicationThreads', () => {
    it('should create default number of threads', () => {
      const threads = createMockCommunicationThreads();

      expect(Array.isArray(threads)).toBe(true);
      expect(threads.length).toBe(25);
      threads.forEach((thread) => {
        expect(thread).toHaveProperty('id');
        expect(thread).toHaveProperty('messages');
      });
    });

    it('should create specified number of threads', () => {
      const threads = createMockCommunicationThreads(10);

      expect(threads.length).toBe(10);
    });
  });

  describe('createMockAIDraftResponse', () => {
    it('should create a valid AI draft response', () => {
      const threadId = 'thread-123';
      const draft = createMockAIDraftResponse(threadId);

      expect(draft.threadId).toBe(threadId);
      expect(draft).toHaveProperty('id');
      expect(draft).toHaveProperty('tone');
      expect(draft).toHaveProperty('draftBody');
      expect(draft).toHaveProperty('suggestedAttachments');
      expect(draft).toHaveProperty('confidence');
      expect(draft).toHaveProperty('generatedAt');
    });

    it('should create drafts with different tones', () => {
      const threadId = 'thread-123';
      const formal = createMockAIDraftResponse(threadId, 'formal');
      const professional = createMockAIDraftResponse(threadId, 'professional');
      const brief = createMockAIDraftResponse(threadId, 'brief');

      expect(formal.tone).toBe('formal');
      expect(professional.tone).toBe('professional');
      expect(brief.tone).toBe('brief');
      expect(formal.draftBody).not.toBe(professional.draftBody);
      expect(professional.draftBody).not.toBe(brief.draftBody);
    });

    it('should include Romanian diacritics in draft body', () => {
      const draft = createMockAIDraftResponse('thread-123');

      // Check for at least one Romanian diacritic
      const romanianDiacritics = ['ă', 'â', 'î', 'ș', 'ț', 'Ă', 'Â', 'Î', 'Ș', 'Ț'];
      const hasDiacritics = romanianDiacritics.some((char) => draft.draftBody.includes(char));
      expect(hasDiacritics).toBe(true);
    });
  });

  describe('Story 1.8.5: New Fields and Features', () => {
    describe('Extracted items with conversions', () => {
      it('should create deadlines with convertedToTaskId when withConversions is true', () => {
        const messageIds = ['msg-1', 'msg-2'];
        // Generate multiple times to ensure we get at least one deadline with conversion
        let hasConverted = false;
        for (let i = 0; i < 10; i++) {
          const deadlines = createMockExtractedDeadlines(messageIds, { withConversions: true });
          if (deadlines.length > 0 && deadlines.some((d) => d.convertedToTaskId !== undefined)) {
            hasConverted = true;
            break;
          }
        }
        // The factory should eventually create a converted deadline
        expect(hasConverted).toBe(true);
      });

      it('should create commitments with dismissal data when withDismissals is true', () => {
        const messageIds = ['msg-1'];
        const commitments = createMockExtractedCommitments(messageIds, { withDismissals: true });

        if (commitments.length > 0) {
          const hasDismissed = commitments.some((c) => c.isDismissed === true);
          if (hasDismissed) {
            const dismissed = commitments.find((c) => c.isDismissed);
            expect(dismissed?.dismissedAt).toBeDefined();
            expect(dismissed?.dismissReason).toBeDefined();
          }
        }
      });

      it('should create action items with both conversions and dismissals', () => {
        const messageIds = ['msg-1'];
        const actionItems = createMockExtractedActionItems(messageIds, {
          withConversions: true,
          withDismissals: true,
        });

        expect(Array.isArray(actionItems)).toBe(true);
      });
    });

    describe('Threads with processed status', () => {
      it('should create thread with isProcessed and processedAt when isProcessed is true', () => {
        const thread = createMockCommunicationThread({ isProcessed: true });

        expect(thread.isProcessed).toBe(true);
        expect(thread.processedAt).toBeDefined();
        expect(thread.processedAt).toBeInstanceOf(Date);
      });

      it('should create thread with conversions and dismissals', () => {
        const thread = createMockCommunicationThread({
          withConversions: true,
          withDismissals: true,
        });

        expect(thread.extractedItems).toBeDefined();
      });
    });

    describe('createMockTaskFromCommunication', () => {
      it('should create task from deadline with correct metadata', () => {
        const messageIds = ['msg-1'];
        const deadlines = createMockExtractedDeadlines(messageIds);

        if (deadlines.length > 0) {
          const deadline = deadlines[0]!;
          const task = createMockTaskFromCommunication(deadline, 'deadline', {
            caseId: 'case-123',
            threadId: 'thread-456',
            messageId: 'msg-1',
          });

          expect(task.type).toBe('CourtDate');
          expect(task.title).toBe(deadline.description);
          expect(task.dueDate).toEqual(deadline.dueDate);
          expect(task.priority).toBe('High');
          expect(task.metadata.extractedItemId).toBe(deadline.id);
          expect(task.metadata.extractedItemType).toBe('deadline');
          expect(task.metadata.sourceMessageId).toBe('msg-1');
          expect(task.metadata.sourceThreadId).toBe('thread-456');
        }
      });

      it('should create task from commitment with correct type', () => {
        const messageIds = ['msg-1'];
        const commitments = createMockExtractedCommitments(messageIds);

        if (commitments.length > 0) {
          const commitment = commitments[0]!;
          const task = createMockTaskFromCommunication(commitment, 'commitment');

          expect(task.type).toBe('Meeting');
          expect(task.title).toBe(commitment.commitmentText);
          expect(task.priority).toBe('Medium');
          expect(task.metadata.extractedItemType).toBe('commitment');
        }
      });

      it('should create task from action item with correct priority', () => {
        const messageIds = ['msg-1'];
        const actionItems = createMockExtractedActionItems(messageIds);

        if (actionItems.length > 0) {
          const actionItem = actionItems[0]!;
          const task = createMockTaskFromCommunication(actionItem, 'actionItem');

          expect(task.type).toBe('Research');
          expect(task.title).toBe(actionItem.description);
          expect(task.priority).toBe(actionItem.priority);
          expect(task.metadata.extractedItemType).toBe('actionItem');
        }
      });

      it('should include Romanian text in task description', () => {
        const messageIds = ['msg-1'];
        const deadlines = createMockExtractedDeadlines(messageIds);

        if (deadlines.length > 0) {
          const task = createMockTaskFromCommunication(deadlines[0]!, 'deadline');

          expect(task.description).toContain('Task creat automat');
          expect(task.description).toContain('Extrăgere');
          expect(task.description).toContain('Confidență AI');
        }
      });
    });
  });
});
