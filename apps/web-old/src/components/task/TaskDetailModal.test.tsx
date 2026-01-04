/**
 * TaskDetailModal Component Tests
 * Tests task creation and editing modal with type-specific fields
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDetailModal } from './TaskDetailModal';
import { createMockTask } from '@legal-platform/test-utils';
import type { Task } from '@legal-platform/types';

// Mock the time entry hooks that require Apollo Client
jest.mock('@/hooks/useTimeEntries', () => ({
  useLogTimeAgainstTask: () => [jest.fn(), { loading: false }],
  useTimeEntriesByTask: () => ({ data: null, loading: false }),
}));

// Mock child components that use Apollo Client (for unit testing TaskDetailModal only)
jest.mock('./TaskComments', () => ({
  TaskComments: () => <div data-testid="task-comments-mock">Task Comments</div>,
}));

jest.mock('./SubtaskPanel', () => ({
  SubtaskPanel: () => <div data-testid="subtask-panel-mock">Subtask Panel</div>,
}));

jest.mock('./TaskAttachments', () => ({
  TaskAttachments: () => <div data-testid="task-attachments-mock">Task Attachments</div>,
}));

jest.mock('./TaskHistoryTimeline', () => ({
  TaskHistoryTimeline: () => <div data-testid="task-history-mock">Task History</div>,
}));

describe('TaskDetailModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering - Create Mode', () => {
    it('should render modal when isOpen is true', () => {
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      expect(screen.getByText('Sarcină Nouă')).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      render(
        <TaskDetailModal isOpen={false} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      expect(screen.queryByText('Sarcină Nouă')).not.toBeInTheDocument();
    });

    it('should render all required form fields', () => {
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      expect(screen.getByLabelText(/Tip Sarcină/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Titlu/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Descriere/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Data Scadenței/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Prioritate/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Status/i)).toBeInTheDocument();
    });

    it('should render create button with Romanian text', () => {
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      expect(screen.getByRole('button', { name: /Creează Sarcina/i })).toBeInTheDocument();
    });

    it('should render cancel button', () => {
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      expect(screen.getByRole('button', { name: /Anulează/i })).toBeInTheDocument();
    });

    it('should not render delete button in create mode', () => {
      render(
        <TaskDetailModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          task={null}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.queryByText(/Șterge Sarcina/i)).not.toBeInTheDocument();
    });
  });

  describe('Rendering - Edit Mode', () => {
    const mockTask = createMockTask({ type: 'Research' });

    it('should render modal with edit title', () => {
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={mockTask} />
      );

      expect(screen.getByText('Editare Sarcină')).toBeInTheDocument();
    });

    it('should populate form fields with task data', () => {
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={mockTask} />
      );

      const titleInput = screen.getByRole('textbox', { name: /Titlu/i }) as HTMLInputElement;
      expect(titleInput.value).toBe(mockTask.title);

      const descriptionInput = screen.getByRole('textbox', {
        name: /Descriere/i,
      }) as HTMLTextAreaElement;
      expect(descriptionInput.value).toBe(mockTask.description);
    });

    it('should render save button with Romanian text', () => {
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={mockTask} />
      );

      expect(screen.getByRole('button', { name: /Salvează Modificările/i })).toBeInTheDocument();
    });

    it('should render delete button in edit mode', () => {
      render(
        <TaskDetailModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          task={mockTask}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText(/Șterge Sarcina/i)).toBeInTheDocument();
    });
  });

  describe('Task Type Selection', () => {
    it('should render all 6 task type options in Romanian', () => {
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const typeSelect = screen.getByLabelText(/Tip Sarcină/i);
      expect(typeSelect).toBeInTheDocument();

      const options = Array.from((typeSelect as HTMLSelectElement).options).map(
        (option) => option.textContent
      );

      expect(options).toContain('Cercetare');
      expect(options).toContain('Creare Document');
      expect(options).toContain('Recuperare Document');
      expect(options).toContain('Termen Instanță');
      expect(options).toContain('Întâlnire');
      expect(options).toContain('Deplasare');
    });

    it('should update type-specific fields when task type changes', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const typeSelect = screen.getByLabelText(/Tip Sarcină/i);
      await user.selectOptions(typeSelect, 'CourtDate');

      expect(screen.getByText(/Nume Instanță/i)).toBeInTheDocument();
      expect(screen.getByText(/Tip Ședință/i)).toBeInTheDocument();
      expect(screen.getByText(/Număr Dosar/i)).toBeInTheDocument();
    });
  });

  describe('Type-Specific Fields - Research', () => {
    it('should render Research-specific fields', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const typeSelect = screen.getByLabelText(/Tip Sarcină/i);
      await user.selectOptions(typeSelect, 'Research');

      expect(screen.getByText(/Subiect Cercetare/i)).toBeInTheDocument();
      expect(screen.getByText(/Domeniu Juridic/i)).toBeInTheDocument();
    });
  });

  describe('Type-Specific Fields - DocumentCreation', () => {
    it('should render DocumentCreation-specific fields', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const typeSelect = screen.getByLabelText(/Tip Sarcină/i);
      await user.selectOptions(typeSelect, 'DocumentCreation');

      expect(screen.getByText(/Tip Document/i)).toBeInTheDocument();
      expect(screen.getByText(/Nume Client/i)).toBeInTheDocument();
    });
  });

  describe('Type-Specific Fields - DocumentRetrieval', () => {
    it('should render DocumentRetrieval-specific fields', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const typeSelect = screen.getByLabelText(/Tip Sarcină/i);
      await user.selectOptions(typeSelect, 'DocumentRetrieval');

      expect(screen.getByText(/Nume Document/i)).toBeInTheDocument();
      expect(screen.getByText(/Locație Sursă/i)).toBeInTheDocument();
    });
  });

  describe('Type-Specific Fields - CourtDate', () => {
    it('should render CourtDate-specific fields', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const typeSelect = screen.getByLabelText(/Tip Sarcină/i);
      await user.selectOptions(typeSelect, 'CourtDate');

      expect(screen.getByText(/Nume Instanță/i)).toBeInTheDocument();
      expect(screen.getByText(/Tip Ședință/i)).toBeInTheDocument();
      expect(screen.getByText(/Număr Dosar/i)).toBeInTheDocument();
      expect(screen.getByText('Locație')).toBeInTheDocument();
    });
  });

  describe('Type-Specific Fields - Meeting', () => {
    it('should render Meeting-specific fields', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const typeSelect = screen.getByLabelText(/Tip Sarcină/i);
      await user.selectOptions(typeSelect, 'Meeting');

      expect(screen.getByText(/Tip Întâlnire/i)).toBeInTheDocument();
      expect(screen.getByText('Locație')).toBeInTheDocument();
      expect(screen.getByText(/Participanți/i)).toBeInTheDocument();
    });
  });

  describe('Type-Specific Fields - BusinessTrip', () => {
    it('should render BusinessTrip-specific fields', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const typeSelect = screen.getByLabelText(/Tip Sarcină/i);
      await user.selectOptions(typeSelect, 'BusinessTrip');

      expect(screen.getByText(/Destinație/i)).toBeInTheDocument();
      expect(screen.getByText(/Scop/i)).toBeInTheDocument();
      expect(screen.getByText(/Cazare/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error when title is empty on save', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const saveButton = screen.getByRole('button', { name: /Creează Sarcina/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Titlul este obligatoriu')).toBeInTheDocument();
      });
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should show error when description is empty on save', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const titleInput = screen.getByRole('textbox', { name: /Titlu/i });
      await user.type(titleInput, 'Test Task');

      const saveButton = screen.getByRole('button', { name: /Creează Sarcina/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Descrierea este obligatorie')).toBeInTheDocument();
      });
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should clear error when field is filled', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const saveButton = screen.getByRole('button', { name: /Creează Sarcina/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Titlul este obligatoriu')).toBeInTheDocument();
      });

      const titleInput = screen.getByRole('textbox', { name: /Titlu/i });
      await user.type(titleInput, 'Test Task');

      await waitFor(() => {
        expect(screen.queryByText('Titlul este obligatoriu')).not.toBeInTheDocument();
      });
    });
  });

  describe('Save Action', () => {
    it('should call onSave with form data when valid', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const titleInput = screen.getByRole('textbox', { name: /Titlu/i });
      await user.type(titleInput, 'Test Task');

      const descriptionInput = screen.getByRole('textbox', { name: /Descriere/i });
      await user.type(descriptionInput, 'Test Description');

      const saveButton = screen.getByRole('button', { name: /Creează Sarcina/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test Task',
            description: 'Test Description',
            type: 'Research',
            priority: 'Medium',
            status: 'Pending',
          })
        );
      });
    });

    it('should call onClose after successful save', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const titleInput = screen.getByRole('textbox', { name: /Titlu/i });
      await user.type(titleInput, 'Test Task');

      const descriptionInput = screen.getByRole('textbox', { name: /Descriere/i });
      await user.type(descriptionInput, 'Test Description');

      const saveButton = screen.getByRole('button', { name: /Creează Sarcina/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should include type-specific metadata in save data', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const titleInput = screen.getByRole('textbox', { name: /Titlu/i });
      await user.type(titleInput, 'Research Task');

      const descriptionInput = screen.getByRole('textbox', { name: /Descriere/i });
      await user.type(descriptionInput, 'Research Description');

      // Wait for Research-specific fields to render
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Jurisprudență CEDO/i)).toBeInTheDocument();
      });

      const researchTopicInput = screen.getByPlaceholderText(/Jurisprudență CEDO/i);
      await user.type(researchTopicInput, 'Legal Research Topic');

      const legalAreaInput = screen.getByPlaceholderText(/Drept Civil, Drept Penal/i);
      await user.type(legalAreaInput, 'Civil Law');

      const saveButton = screen.getByRole('button', { name: /Creează Sarcina/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              researchTopic: 'Legal Research Topic',
              legalArea: 'Civil Law',
            }),
          })
        );
      });
    });
  });

  describe('Delete Action', () => {
    const mockTask = createMockTask({ type: 'Research' });

    it('should show delete confirmation when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          task={mockTask}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByText(/Șterge Sarcina/i);
      await user.click(deleteButton);

      expect(screen.getByText(/Sigur doriți să ștergeți?/i)).toBeInTheDocument();
      expect(screen.getByText(/Da, Șterge/i)).toBeInTheDocument();
    });

    it('should call onDelete when confirmed', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          task={mockTask}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByText(/Șterge Sarcina/i);
      await user.click(deleteButton);

      const confirmButton = screen.getByText(/Da, Șterge/i);
      await user.click(confirmButton);

      expect(mockOnDelete).toHaveBeenCalledWith(mockTask.id);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should cancel delete confirmation', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          task={mockTask}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByText(/Șterge Sarcina/i);
      await user.click(deleteButton);

      const cancelButton = screen.getAllByRole('button', { name: /Anulează/i })[0]; // First cancel button in delete confirmation
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/Sigur doriți să ștergeți?/i)).not.toBeInTheDocument();
      });
      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });

  describe('Cancel Action', () => {
    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const cancelButton = screen.getByRole('button', { name: /Anulează/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when close icon is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const closeButton = screen.getByLabelText(/Închide/i);
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when escape key is pressed', () => {
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper dialog role', () => {
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have accessible title', () => {
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAccessibleName('Sarcină Nouă');
    });

    it('should indicate required fields with asterisk', () => {
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const requiredMarkers = screen.getAllByText('*');
      expect(requiredMarkers.length).toBeGreaterThan(0);
    });
  });

  describe('Romanian Language Support', () => {
    it('should display all Romanian labels correctly', () => {
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      expect(screen.getByText(/Tip Sarcină/i)).toBeInTheDocument();
      expect(screen.getByText(/Titlu/i)).toBeInTheDocument();
      expect(screen.getByText(/Descriere/i)).toBeInTheDocument();
      expect(screen.getByText(/Data Scadenței/i)).toBeInTheDocument();
      expect(screen.getByText(/Prioritate/i)).toBeInTheDocument();
      expect(screen.getByText(/Detalii Specifice/i)).toBeInTheDocument();
    });

    it('should handle Romanian diacritics in input fields', async () => {
      const user = userEvent.setup();
      render(
        <TaskDetailModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} task={null} />
      );

      const titleInput = screen.getByRole('textbox', { name: /Titlu/i });
      await user.type(titleInput, 'Întâlnire în șede');

      expect(titleInput).toHaveValue('Întâlnire în șede');
    });
  });
});
