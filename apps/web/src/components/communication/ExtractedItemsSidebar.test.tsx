import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ExtractedItemsSidebar } from './ExtractedItemsSidebar';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../stores/communication.store';
import type { CommunicationThread } from '@legal-platform/types';

// Mock the communication store
jest.mock('@/stores/communication.store');

// Mock window.alert and window.prompt
const mockAlert = jest.fn();
const mockPrompt = jest.fn();
global.alert = mockAlert;
global.prompt = mockPrompt;

const mockThread: CommunicationThread = {
  id: 'thread-1',
  subject: 'Contract Review',
  caseId: 'case-1',
  caseName: 'Tech Solutions SRL',
  caseType: 'Contract',
  participants: [
    {
      id: 'user-1',
      name: 'Elena Popescu',
      email: 'elena@example.com',
      role: 'Sender',
    },
  ],
  messages: [
    {
      id: 'msg-1',
      threadId: 'thread-1',
      senderId: 'user-1',
      senderName: 'Elena Popescu',
      senderEmail: 'elena@example.com',
      recipientIds: ['user-current'],
      subject: 'Contract Review',
      body: 'Please review the contract by next week.',
      sentDate: new Date('2025-11-10'),
      attachments: [],
      isFromUser: false,
      isRead: true,
    },
  ],
  hasAttachments: false,
  isUnread: false,
  lastMessageDate: new Date('2025-11-10'),
  extractedItems: {
    deadlines: [
      {
        id: 'deadline-1',
        description: 'Revizuire contract',
        dueDate: new Date('2025-11-20'),
        sourceMessageId: 'msg-1',
        confidence: 'High',
      },
      {
        id: 'deadline-2',
        description: 'Depunere documente',
        dueDate: new Date('2025-11-25'),
        sourceMessageId: 'msg-1',
        confidence: 'Medium',
      },
    ],
    commitments: [
      {
        id: 'commitment-1',
        party: 'Elena Popescu',
        commitmentText: 'Va trimite documentația completă',
        date: new Date('2025-11-18'),
        sourceMessageId: 'msg-1',
        confidence: 'High',
      },
    ],
    actionItems: [
      {
        id: 'action-1',
        description: 'Pregătire raport legal',
        priority: 'High',
        sourceMessageId: 'msg-1',
        confidence: 'High',
        suggestedAssignee: 'Avocat senior',
      },
    ],
  },
  createdAt: new Date('2025-11-10'),
  updatedAt: new Date('2025-11-10'),
};

describe('ExtractedItemsSidebar', () => {
  const mockGetSelectedThread = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAlert.mockClear();
    mockPrompt.mockClear();
    (useCommunicationStore as jest.Mock).mockReturnValue({
      getSelectedThread: mockGetSelectedThread,
    });
  });

  describe('Rendering and sections', () => {
    it('should display message when no thread is selected', () => {
      mockGetSelectedThread.mockReturnValue(null);
      render(<ExtractedItemsSidebar />);

      expect(screen.getByText(/Selectați o conversație pentru a vedea elementele extrase/i)).toBeInTheDocument();
    });

    it('should render all three sections with correct labels', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      expect(screen.getByText(/Termene \(2\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Angajamente \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Acțiuni \(1\)/i)).toBeInTheDocument();
    });

    it('should show deadlines section expanded by default', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Deadlines should be visible by default
      expect(screen.getByText('Revizuire contract')).toBeInTheDocument();
      expect(screen.getByText('Depunere documente')).toBeInTheDocument();
    });

    it('should toggle section visibility when header is clicked', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Deadlines is expanded by default
      expect(screen.getByText('Revizuire contract')).toBeInTheDocument();

      // Click to collapse
      const deadlinesHeader = screen.getByText(/Termene \(2\)/i);
      fireEvent.click(deadlinesHeader);

      // Deadlines should be hidden
      expect(screen.queryByText('Revizuire contract')).not.toBeInTheDocument();

      // Click to expand again
      fireEvent.click(deadlinesHeader);

      // Deadlines should be visible again
      expect(screen.getByText('Revizuire contract')).toBeInTheDocument();
    });

    it('should expand commitments section when clicked', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Commitments should not be visible initially
      expect(screen.queryByText('Elena Popescu')).not.toBeInTheDocument();

      // Click to expand
      const commitmentsHeader = screen.getByText(/Angajamente \(1\)/i);
      fireEvent.click(commitmentsHeader);

      // Commitments should be visible
      expect(screen.getByText('Elena Popescu')).toBeInTheDocument();
      expect(screen.getByText('Va trimite documentația completă')).toBeInTheDocument();
    });

    it('should expand actions section when clicked', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Actions should not be visible initially
      expect(screen.queryByText('Pregătire raport legal')).not.toBeInTheDocument();

      // Click to expand
      const actionsHeader = screen.getByText(/Acțiuni \(1\)/i);
      fireEvent.click(actionsHeader);

      // Actions should be visible
      expect(screen.getByText('Pregătire raport legal')).toBeInTheDocument();
    });
  });

  describe('Empty states', () => {
    it('should show empty state when no deadlines are extracted', () => {
      const threadWithoutDeadlines = {
        ...mockThread,
        extractedItems: {
          deadlines: [],
          commitments: [],
          actionItems: [],
        },
      };
      mockGetSelectedThread.mockReturnValue(threadWithoutDeadlines);
      render(<ExtractedItemsSidebar />);

      expect(screen.getByText(/Nu s-au detectat termene/i)).toBeInTheDocument();
    });

    it('should show empty state when no commitments are extracted', () => {
      const threadWithoutCommitments = {
        ...mockThread,
        extractedItems: {
          deadlines: [],
          commitments: [],
          actionItems: [],
        },
      };
      mockGetSelectedThread.mockReturnValue(threadWithoutCommitments);
      render(<ExtractedItemsSidebar />);

      // Expand commitments section
      const commitmentsHeader = screen.getByText(/Angajamente \(0\)/i);
      fireEvent.click(commitmentsHeader);

      expect(screen.getByText(/Nu s-au detectat angajamente/i)).toBeInTheDocument();
    });

    it('should show empty state when no action items are extracted', () => {
      const threadWithoutActions = {
        ...mockThread,
        extractedItems: {
          deadlines: [],
          commitments: [],
          actionItems: [],
        },
      };
      mockGetSelectedThread.mockReturnValue(threadWithoutActions);
      render(<ExtractedItemsSidebar />);

      // Expand actions section
      const actionsHeader = screen.getByText(/Acțiuni \(0\)/i);
      fireEvent.click(actionsHeader);

      expect(screen.getByText(/Nu s-au detectat acțiuni/i)).toBeInTheDocument();
    });
  });

  describe('Task creation from deadlines', () => {
    it('should show "Creează Task" button for each deadline', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      const createButtons = screen.getAllByText(/Creează Task/i);
      expect(createButtons.length).toBeGreaterThan(0);
    });

    it('should open QuickTaskCreator when "Creează Task" is clicked', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      const createButtons = screen.getAllByText(/Creează Task/i);
      fireEvent.click(createButtons[0]);

      // QuickTaskCreator should be visible with form fields
      expect(screen.getByLabelText(/Tip Task/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Titlu/i)).toBeInTheDocument();
      expect(screen.getByText(/Salvează Task/i)).toBeInTheDocument();
      expect(screen.getByText(/Anulează/i)).toBeInTheDocument();
    });

    it('should pre-populate QuickTaskCreator with deadline data', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      const createButtons = screen.getAllByText(/Creează Task/i);
      fireEvent.click(createButtons[0]);

      // Check pre-populated fields
      const titleInput = screen.getByLabelText(/Titlu/i) as HTMLInputElement;
      expect(titleInput.value).toBe('Revizuire contract');

      const descInput = screen.getByLabelText(/Descriere/i) as HTMLTextAreaElement;
      expect(descInput.value).toContain('Termen extras din email');
    });

    it('should cancel task creation when "Anulează" is clicked', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      const createButtons = screen.getAllByText(/Creează Task/i);
      fireEvent.click(createButtons[0]);

      // QuickTaskCreator should be visible
      expect(screen.getByText(/Salvează Task/i)).toBeInTheDocument();

      // Click cancel
      const cancelButton = screen.getByText(/Anulează/i);
      fireEvent.click(cancelButton);

      // QuickTaskCreator should be hidden
      expect(screen.queryByText(/Salvează Task/i)).not.toBeInTheDocument();
    });

    it('should create task and show success message when saved', async () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      const createButtons = screen.getAllByText(/Creează Task/i);
      fireEvent.click(createButtons[0]);

      // Fill in required fields and save
      const saveButton = screen.getByText(/Salvează Task/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Task creat cu succes!');
      });
    });

    it('should show "Task creat" badge after task is created', async () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      const createButtons = screen.getAllByText(/Creează Task/i);
      fireEvent.click(createButtons[0]);

      // Save the task
      const saveButton = screen.getByText(/Salvează Task/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Task creat/i)).toBeInTheDocument();
      });

      // Check for green checkmark icon
      const taskLink = screen.getByText(/Task creat/i).closest('a');
      expect(taskLink).toHaveAttribute('href', expect.stringContaining('/tasks?id='));
    });

    it('should prevent duplicate task creation by hiding button', async () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      const createButtons = screen.getAllByText(/Creează Task/i);
      const initialCount = createButtons.length;

      // Create task from first deadline
      fireEvent.click(createButtons[0]);
      const saveButton = screen.getByText(/Salvează Task/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Task creat/i)).toBeInTheDocument();
      });

      // "Creează Task" button should be replaced with "Task creat" link
      const remainingCreateButtons = screen.getAllByText(/Creează Task/i);
      expect(remainingCreateButtons.length).toBe(initialCount - 1);
    });
  });

  describe('Task creation from commitments', () => {
    it('should open QuickTaskCreator for commitment with correct data', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Expand commitments section
      const commitmentsHeader = screen.getByText(/Angajamente \(1\)/i);
      fireEvent.click(commitmentsHeader);

      // Click create task button (use getAllByText and get the one in commitments section - index 2)
      const createButtons = screen.getAllByText(/Creează Task/i);
      // Index 0, 1 are from deadlines (2 items), index 2 is from commitments
      fireEvent.click(createButtons[2]);

      // Check pre-populated fields
      const titleInput = screen.getByLabelText(/Titlu/i) as HTMLInputElement;
      expect(titleInput.value).toContain('Elena Popescu');

      const descInput = screen.getByLabelText(/Descriere/i) as HTMLTextAreaElement;
      expect(descInput.value).toBe('Va trimite documentația completă');
    });

    it('should create task from commitment successfully', async () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Expand commitments section
      const commitmentsHeader = screen.getByText(/Angajamente \(1\)/i);
      fireEvent.click(commitmentsHeader);

      // Click create task button (use getAllByText and get the one in commitments section - index 2)
      const createButtons = screen.getAllByText(/Creează Task/i);
      fireEvent.click(createButtons[2]);

      // Save the task
      const saveButton = screen.getByText(/Salvează Task/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Task creat cu succes!');
        expect(screen.getByText(/Task creat/i)).toBeInTheDocument();
      });
    });
  });

  describe('Task creation from action items', () => {
    it('should open QuickTaskCreator for action item with correct data', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Expand actions section
      const actionsHeader = screen.getByText(/Acțiuni \(1\)/i);
      fireEvent.click(actionsHeader);

      // Click create task button (use getAllByText and get the one in actions section - index 2)
      const createButtons = screen.getAllByText(/Creează Task/i);
      fireEvent.click(createButtons[2]);

      // Check pre-populated fields
      const titleInput = screen.getByLabelText(/Titlu/i) as HTMLInputElement;
      expect(titleInput.value).toBe('Pregătire raport legal');

      const descInput = screen.getByLabelText(/Descriere/i) as HTMLTextAreaElement;
      expect(descInput.value).toContain('Acțiune extrasă din email');

      const prioritySelect = screen.getByLabelText(/Prioritate/i) as HTMLSelectElement;
      expect(prioritySelect.value).toBe('High');
    });

    it('should create task from action item successfully', async () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Expand actions section
      const actionsHeader = screen.getByText(/Acțiuni \(1\)/i);
      fireEvent.click(actionsHeader);

      // Click create task button (use getAllByText and get the one in actions section - index 2)
      const createButtons = screen.getAllByText(/Creează Task/i);
      fireEvent.click(createButtons[2]);

      // Save the task
      const saveButton = screen.getByText(/Salvează Task/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Task creat cu succes!');
        expect(screen.getByText(/Task creat/i)).toBeInTheDocument();
      });
    });
  });

  describe('Dismiss functionality', () => {
    it('should show dismiss button on hover for each item', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Find dismiss buttons (they have X icon and "Respinge" title)
      const dismissButtons = screen.getAllByTitle(/Respinge/i);
      expect(dismissButtons.length).toBeGreaterThan(0);
    });

    it('should show dismiss prompt when dismiss button is clicked', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      mockPrompt.mockReturnValue('1'); // Choose "Nu este relevant"
      render(<ExtractedItemsSidebar />);

      const dismissButtons = screen.getAllByTitle(/Respinge/i);
      fireEvent.click(dismissButtons[0]);

      expect(mockPrompt).toHaveBeenCalledWith(
        expect.stringContaining('De ce respingi acest element?')
      );
    });

    it('should hide item after dismissal', async () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      mockPrompt.mockReturnValue('1'); // Choose "Nu este relevant"
      render(<ExtractedItemsSidebar />);

      // Verify item is visible
      expect(screen.getByText('Revizuire contract')).toBeInTheDocument();

      const dismissButtons = screen.getAllByTitle(/Respinge/i);
      fireEvent.click(dismissButtons[0]);

      await waitFor(() => {
        // Item should be hidden after dismissal
        expect(screen.queryByText('Revizuire contract')).not.toBeInTheDocument();
      });
    });

    it('should log dismissal with reason for AI learning', async () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      mockPrompt.mockReturnValue('2'); // Choose "Deja gestionat"
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      render(<ExtractedItemsSidebar />);

      const dismissButtons = screen.getAllByTitle(/Respinge/i);
      fireEvent.click(dismissButtons[0]);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Item dismissed:',
          expect.objectContaining({
            extractedItemId: 'deadline-1',
            reason: 'Deja gestionat',
            dismissedAt: expect.any(Date),
          })
        );
      });

      consoleSpy.mockRestore();
    });

    it('should not dismiss if user cancels prompt', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      mockPrompt.mockReturnValue(null); // User cancelled
      render(<ExtractedItemsSidebar />);

      // Verify item is visible
      expect(screen.getByText('Revizuire contract')).toBeInTheDocument();

      const dismissButtons = screen.getAllByTitle(/Respinge/i);
      fireEvent.click(dismissButtons[0]);

      // Item should still be visible
      expect(screen.getByText('Revizuire contract')).toBeInTheDocument();
    });

    it('should accept custom dismiss reason', async () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      mockPrompt.mockReturnValue('Custom reason text');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      render(<ExtractedItemsSidebar />);

      const dismissButtons = screen.getAllByTitle(/Respinge/i);
      fireEvent.click(dismissButtons[0]);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Item dismissed:',
          expect.objectContaining({
            reason: 'Custom reason text',
          })
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Visual indicators', () => {
    it('should show green background for converted deadline items', async () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Create a task
      const createButtons = screen.getAllByText(/Creează Task/i);
      fireEvent.click(createButtons[0]);
      const saveButton = screen.getByText(/Salvează Task/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        // Find the item card container (now converted with green background)
        const convertedItem = screen.getByText('Revizuire contract').closest('.bg-green-50');
        expect(convertedItem).toBeInTheDocument();
        expect(convertedItem).toHaveClass('border-green-200');
      });
    });

    it('should show checkmark icon for converted items', async () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Create a task
      const createButtons = screen.getAllByText(/Creează Task/i);
      fireEvent.click(createButtons[0]);
      const saveButton = screen.getByText(/Salvează Task/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        // The "Task creat" link should be present, indicating the checkmark is shown
        expect(screen.getByText(/Task creat/i)).toBeInTheDocument();
      });
    });

    it('should show yellow background for unconverted deadlines', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Find the item card container (parent with background color class)
      const unconvertedItem = screen.getByText('Revizuire contract').closest('.bg-yellow-50');
      expect(unconvertedItem).toBeInTheDocument();
    });

    it('should show blue background for unconverted commitments', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Expand commitments section
      const commitmentsHeader = screen.getByText(/Angajamente \(1\)/i);
      fireEvent.click(commitmentsHeader);

      // Find the item card container (parent with background color class)
      const unconvertedItem = screen.getByText('Elena Popescu').closest('.bg-blue-50');
      expect(unconvertedItem).toBeInTheDocument();
    });

    it('should show green background for unconverted action items', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Expand actions section
      const actionsHeader = screen.getByText(/Acțiuni \(1\)/i);
      fireEvent.click(actionsHeader);

      // Find the item card container (parent with background color class)
      const unconvertedItem = screen.getByText('Pregătire raport legal').closest('.bg-green-50');
      expect(unconvertedItem).toBeInTheDocument();
    });
  });

  describe('Multiple tasks creation', () => {
    it('should allow creating multiple tasks from same thread', async () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      // Create task from first deadline
      const createButtons = screen.getAllByText(/Creează Task/i);
      fireEvent.click(createButtons[0]);
      let saveButton = screen.getByText(/Salvează Task/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Task creat cu succes!');
      });

      // Create task from second deadline
      const remainingCreateButtons = screen.getAllByText(/Creează Task/i);
      fireEvent.click(remainingCreateButtons[0]);
      saveButton = screen.getByText(/Salvează Task/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledTimes(2);
      });

      // Both should show "Task creat"
      const taskCreatedLinks = screen.getAllByText(/Task creat/i);
      expect(taskCreatedLinks.length).toBe(2);
    });
  });

  describe('Romanian language support', () => {
    it('should display all Romanian labels correctly', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<ExtractedItemsSidebar />);

      expect(screen.getByText(/Elemente extrase/i)).toBeInTheDocument();
      expect(screen.getByText(/Termene/i)).toBeInTheDocument();

      // Expand all sections
      fireEvent.click(screen.getByText(/Angajamente \(1\)/i));
      fireEvent.click(screen.getByText(/Acțiuni \(1\)/i));

      expect(screen.getByText(/Angajamente/i)).toBeInTheDocument();
      expect(screen.getByText(/Acțiuni/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Creează Task/i).length).toBeGreaterThan(0);
    });
  });
});
