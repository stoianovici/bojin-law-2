/**
 * TaskCreationBar Component Tests
 * Tests natural language task creation interface with parsing demonstration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskCreationBar } from './TaskCreationBar';

describe('TaskCreationBar', () => {
  const mockOnCreateTask = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the input field with Romanian placeholder', () => {
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByPlaceholderText(
        /Creează o sarcină de cercetare pentru contractul X până pe 15 noiembrie/i
      );
      expect(input).toBeInTheDocument();
    });

    it('should render the label "Creează o sarcină nouă"', () => {
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      expect(screen.getByText('Creează o sarcină nouă')).toBeInTheDocument();
    });

    it('should render the create button', () => {
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      expect(screen.getByRole('button', { name: /Creează/i })).toBeInTheDocument();
    });

    it('should render create button as disabled when input is empty', () => {
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const createButton = screen.getByRole('button', { name: /Creează/i });
      expect(createButton).toBeDisabled();
    });

    it('should render task suggestions when input is empty', () => {
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      expect(screen.getByText('Sugestii:')).toBeInTheDocument();
      expect(screen.getByText('Pregătește contract pentru client [Nume]')).toBeInTheDocument();
      expect(screen.getByText('Cercetare jurisprudență pentru cazul [Număr]')).toBeInTheDocument();
      expect(screen.getByText('Întâlnire cu client [Nume] pe data de [Dată]')).toBeInTheDocument();
      expect(screen.getByText('Redactare memoriu pentru dosar [Număr]')).toBeInTheDocument();
    });

    it('should render legend with entity type colors', () => {
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      expect(screen.getByText('Elemente care pot fi detectate:')).toBeInTheDocument();
      expect(screen.getByText('Tip sarcină')).toBeInTheDocument();
      expect(screen.getByText('Data')).toBeInTheDocument();
      expect(screen.getByText('Dosar/Contract')).toBeInTheDocument();
      expect(screen.getByText('Persoană')).toBeInTheDocument();
    });
  });

  describe('User Input', () => {
    it('should update input value when user types', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test task');

      expect(input).toHaveValue('Test task');
    });

    it('should enable create button when input has text', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test task');

      const createButton = screen.getByRole('button', { name: /Creează/i });
      expect(createButton).not.toBeDisabled();
    });

    it('should hide suggestions when input has text', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test task');

      expect(screen.queryByText('Sugestii:')).not.toBeInTheDocument();
    });

    it('should show clear button when input has text', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test task');

      const clearButton = screen.getByLabelText('Șterge text');
      expect(clearButton).toBeInTheDocument();
    });

    it('should clear input when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test task');

      const clearButton = screen.getByLabelText('Șterge text');
      await user.click(clearButton);

      expect(input).toHaveValue('');
    });
  });

  describe('Suggestion Interaction', () => {
    it('should populate input when suggestion is clicked', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const suggestion = screen.getByText('Pregătește contract pentru client [Nume]');
      await user.click(suggestion);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('Pregătește contract pentru client [Nume]');
    });

    it('should hide suggestions after one is clicked', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const suggestion = screen.getByText('Pregătește contract pentru client [Nume]');
      await user.click(suggestion);

      expect(screen.queryByText('Sugestii:')).not.toBeInTheDocument();
    });
  });

  describe('Natural Language Parsing', () => {
    it('should detect and highlight task type keywords', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Creează o cercetare despre contract');

      await waitFor(() => {
        expect(screen.getByText('Elemente detectate:')).toBeInTheDocument();
      });
    });

    it('should detect date patterns in Romanian', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Task până pe 15 noiembrie');

      await waitFor(() => {
        expect(screen.getByText('Elemente detectate:')).toBeInTheDocument();
      });
    });

    it('should detect case/contract references', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Cercetare pentru dosar 123/2025');

      await waitFor(() => {
        expect(screen.getByText('Elemente detectate:')).toBeInTheDocument();
      });
    });

    it('should detect person names after "client" keyword', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Întâlnire cu client Ion Popescu');

      await waitFor(() => {
        expect(screen.getByText('Elemente detectate:')).toBeInTheDocument();
      });
    });

    it('should show parsed entity badges with correct types', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Cercetare pentru contract X până pe 15 noiembrie');

      await waitFor(() => {
        expect(screen.getByText('Elemente detectate:')).toBeInTheDocument();
      });
    });

    it('should not show parsing preview when no entities detected', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Random text without keywords');

      expect(screen.queryByText('Elemente detectate:')).not.toBeInTheDocument();
    });
  });

  describe('Task Creation', () => {
    it('should call onCreateTask when create button is clicked', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'New task');

      const createButton = screen.getByRole('button', { name: /Creează/i });
      await user.click(createButton);

      expect(mockOnCreateTask).toHaveBeenCalledWith('New task');
    });

    it('should clear input after task creation', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'New task');

      const createButton = screen.getByRole('button', { name: /Creează/i });
      await user.click(createButton);

      expect(input).toHaveValue('');
    });

    it('should call onCreateTask when Enter key is pressed', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'New task{Enter}');

      expect(mockOnCreateTask).toHaveBeenCalledWith('New task');
    });

    it('should not call onCreateTask when Shift+Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'New task');

      fireEvent.keyPress(input, { key: 'Enter', shiftKey: true });

      expect(mockOnCreateTask).not.toHaveBeenCalled();
    });

    it('should not call onCreateTask when input is empty', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      fireEvent.keyPress(input, { key: 'Enter' });

      expect(mockOnCreateTask).not.toHaveBeenCalled();
    });

    it('should not call onCreateTask when input contains only whitespace', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '   ');

      const createButton = screen.getByRole('button', { name: /Creează/i });
      await user.click(createButton);

      expect(mockOnCreateTask).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper label association with input', () => {
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAccessibleName('Creează o sarcină nouă');
    });

    it('should have accessible label for clear button', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      const clearButton = screen.getByLabelText('Șterge text');
      expect(clearButton).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.tab();
      expect(input).toHaveFocus();
    });
  });

  describe('Romanian Language Support', () => {
    it('should handle Romanian diacritics in input', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Întâlnire cu client în șede');

      expect(input).toHaveValue('Întâlnire cu client în șede');
    });

    it('should detect Romanian month names in dates', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Task până pe 15 decembrie');

      await waitFor(() => {
        expect(screen.getByText('Elemente detectate:')).toBeInTheDocument();
      });
    });

    it('should detect Romanian task type keywords', async () => {
      const user = userEvent.setup();
      render(<TaskCreationBar onCreateTask={mockOnCreateTask} />);

      const taskTypeKeywords = [
        'cercetare',
        'redactare',
        'întâlnire',
        'termen',
        'deplasare',
      ];

      for (const keyword of taskTypeKeywords) {
        const input = screen.getByRole('textbox');
        await user.clear(input);
        await user.type(input, `Task cu ${keyword}`);

        await waitFor(() => {
          expect(screen.getByText('Elemente detectate:')).toBeInTheDocument();
        });
      }
    });
  });
});
