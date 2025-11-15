import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickTaskCreator } from './QuickTaskCreator';
import type { Task } from '@legal-platform/types';

describe('QuickTaskCreator', () => {
  const defaultProps = {
    extractedItemType: 'deadline' as const,
    extractedItemId: 'item-123',
    threadId: 'thread-456',
    messageId: 'msg-789',
    caseId: 'case-abc',
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering with pre-populated data', () => {
    it('should render inline form with all fields', () => {
      render(<QuickTaskCreator {...defaultProps} />);

      expect(screen.getByText(/Tip Task/i)).toBeInTheDocument();
      expect(screen.getByText(/Titlu/i)).toBeInTheDocument();
      expect(screen.getByText(/Descriere/i)).toBeInTheDocument();
      expect(screen.getByText(/Atribuit/i)).toBeInTheDocument();
      expect(screen.getByText(/Scadență/i)).toBeInTheDocument();
      expect(screen.getByText(/Prioritate/i)).toBeInTheDocument();
    });

    it('should pre-fill title from prefillTitle prop', () => {
      render(
        <QuickTaskCreator
          {...defaultProps}
          prefillTitle="Revizuire contract"
        />
      );

      const titleInput = screen.getByLabelText(/Titlu/i) as HTMLInputElement;
      expect(titleInput.value).toBe('Revizuire contract');
    });

    it('should pre-fill description from prefillDescription prop', () => {
      render(
        <QuickTaskCreator
          {...defaultProps}
          prefillDescription="Extras din comunicare"
        />
      );

      const descInput = screen.getByLabelText(/Descriere/i) as HTMLTextAreaElement;
      expect(descInput.value).toBe('Extras din comunicare');
    });

    it('should pre-fill due date from prefillDueDate prop', () => {
      const dueDate = new Date('2025-03-15');
      render(
        <QuickTaskCreator
          {...defaultProps}
          prefillDueDate={dueDate}
        />
      );

      const dateInput = screen.getByLabelText(/Scadență/i) as HTMLInputElement;
      expect(dateInput.value).toBe('2025-03-15');
    });

    it('should pre-fill priority from prefillPriority prop', () => {
      render(
        <QuickTaskCreator
          {...defaultProps}
          prefillPriority="High"
        />
      );

      const prioritySelect = screen.getByLabelText(/Prioritate/i) as HTMLSelectElement;
      expect(prioritySelect.value).toBe('High');
    });

    it('should map deadline to CourtDate task type', () => {
      render(
        <QuickTaskCreator
          {...defaultProps}
          extractedItemType="deadline"
        />
      );

      const typeSelect = screen.getByLabelText(/Tip Task/i) as HTMLSelectElement;
      expect(typeSelect.value).toBe('CourtDate');
    });

    it('should map commitment to Meeting task type', () => {
      render(
        <QuickTaskCreator
          {...defaultProps}
          extractedItemType="commitment"
        />
      );

      const typeSelect = screen.getByLabelText(/Tip Task/i) as HTMLSelectElement;
      expect(typeSelect.value).toBe('Meeting');
    });

    it('should map actionItem to Research task type', () => {
      render(
        <QuickTaskCreator
          {...defaultProps}
          extractedItemType="actionItem"
        />
      );

      const typeSelect = screen.getByLabelText(/Tip Task/i) as HTMLSelectElement;
      expect(typeSelect.value).toBe('Research');
    });
  });

  describe('Form validation', () => {
    it('should show error when title is empty', async () => {
      render(<QuickTaskCreator {...defaultProps} />);

      const saveButton = screen.getByText(/Salvează Task/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Titlul este obligatoriu/i)).toBeInTheDocument();
      });

      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('should show error when due date is empty', async () => {
      render(
        <QuickTaskCreator
          {...defaultProps}
          prefillTitle="Test Task"
        />
      );

      const saveButton = screen.getByText(/Salvează Task/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Scadența este obligatorie/i)).toBeInTheDocument();
      });

      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('should not show errors when form is valid', async () => {
      render(
        <QuickTaskCreator
          {...defaultProps}
          prefillTitle="Valid Task"
          prefillDueDate={new Date('2025-03-15')}
        />
      );

      const saveButton = screen.getByText(/Salvează Task/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
      });
    });
  });

  describe('Save and cancel actions', () => {
    it('should call onSave with correct task data when save is clicked', async () => {
      const onSave = jest.fn();
      render(
        <QuickTaskCreator
          {...defaultProps}
          onSave={onSave}
          prefillTitle="Test Task"
          prefillDescription="Test Description"
          prefillDueDate={new Date('2025-03-15')}
          prefillPriority="High"
        />
      );

      const saveButton = screen.getByText(/Salvează Task/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test Task',
            description: 'Test Description',
            priority: 'High',
            type: 'CourtDate',
            metadata: expect.objectContaining({
              sourceMessageId: 'msg-789',
              sourceThreadId: 'thread-456',
              extractedItemId: 'item-123',
              extractedItemType: 'deadline',
            }),
          })
        );
      });
    });

    it('should call onCancel when cancel button is clicked', () => {
      render(<QuickTaskCreator {...defaultProps} />);

      const cancelButton = screen.getByText(/Anulează/i);
      fireEvent.click(cancelButton);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('Keyboard shortcuts', () => {
    it('should call onCancel when Escape key is pressed', async () => {
      const onCancel = jest.fn();
      render(<QuickTaskCreator {...defaultProps} onCancel={onCancel} />);

      fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(() => {
        expect(onCancel).toHaveBeenCalled();
      });
    });

    it('should save task when Ctrl+Enter is pressed with valid data', async () => {
      const onSave = jest.fn();
      render(
        <QuickTaskCreator
          {...defaultProps}
          onSave={onSave}
          prefillTitle="Test Task"
          prefillDueDate={new Date('2025-03-15')}
        />
      );

      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });
    });

    it('should not save when Ctrl+Enter is pressed with invalid data', async () => {
      const onSave = jest.fn();
      render(<QuickTaskCreator {...defaultProps} onSave={onSave} />);

      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

      await waitFor(() => {
        expect(screen.getByText(/Titlul este obligatoriu/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('Romanian language labels', () => {
    it('should display Romanian labels throughout', () => {
      render(<QuickTaskCreator {...defaultProps} />);

      expect(screen.getByText(/Tip Task/i)).toBeInTheDocument();
      expect(screen.getByText(/Titlu/i)).toBeInTheDocument();
      expect(screen.getByText(/Descriere/i)).toBeInTheDocument();
      expect(screen.getByText(/Atribuit/i)).toBeInTheDocument();
      expect(screen.getByText(/Scadență/i)).toBeInTheDocument();
      expect(screen.getByText(/Prioritate/i)).toBeInTheDocument();
      expect(screen.getByText(/Salvează Task/i)).toBeInTheDocument();
      expect(screen.getByText(/Anulează/i)).toBeInTheDocument();
    });
  });
});
