/**
 * RefinementInput Component Tests
 * Story 5.3: AI-Powered Email Drafting - Task 29
 *
 * Tests refinement instruction input and quick actions
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RefinementInput } from '../RefinementInput';

describe('RefinementInput', () => {
  const defaultProps = {
    onRefine: jest.fn().mockResolvedValue(undefined),
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render instruction input', () => {
      render(<RefinementInput {...defaultProps} />);

      expect(
        screen.getByPlaceholderText(/Instrucțiuni de rafinare personalizate/i)
      ).toBeInTheDocument();
    });

    it('should render refine button', () => {
      render(<RefinementInput {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Rafinează/i })).toBeInTheDocument();
    });

    it('should render quick action buttons', () => {
      render(<RefinementInput {...defaultProps} />);

      expect(screen.getByText(/Mai scurt/i)).toBeInTheDocument();
      expect(screen.getByText(/Mai formal/i)).toBeInTheDocument();
      expect(screen.getByText(/Mai detaliat/i)).toBeInTheDocument();
    });

    it('should render translation buttons', () => {
      render(<RefinementInput {...defaultProps} />);

      expect(screen.getByText(/În română/i)).toBeInTheDocument();
      expect(screen.getByText(/În engleză/i)).toBeInTheDocument();
    });

    it('should render header', () => {
      render(<RefinementInput {...defaultProps} />);

      expect(screen.getByText(/Rafinare AI/i)).toBeInTheDocument();
    });
  });

  describe('Instruction input', () => {
    it('should allow typing instruction', async () => {
      const user = userEvent.setup();
      render(<RefinementInput {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Instrucțiuni de rafinare personalizate/i);
      await user.type(input, 'Make it more formal');

      expect(input).toHaveValue('Make it more formal');
    });

    it('should clear input after successful refinement', async () => {
      const user = userEvent.setup();
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      const input = screen.getByPlaceholderText(/Instrucțiuni de rafinare personalizate/i);
      await user.type(input, 'Test instruction');
      fireEvent.click(screen.getByRole('button', { name: /Rafinează/i }));

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  describe('Refine action', () => {
    it('should call onRefine with instruction when button is clicked', async () => {
      const user = userEvent.setup();
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      const input = screen.getByPlaceholderText(/Instrucțiuni de rafinare personalizate/i);
      await user.type(input, 'Make it shorter');
      fireEvent.click(screen.getByRole('button', { name: /Rafinează/i }));

      expect(onRefine).toHaveBeenCalledWith('Make it shorter');
    });

    it('should call onRefine when Enter is pressed', async () => {
      const user = userEvent.setup();
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      const input = screen.getByPlaceholderText(/Instrucțiuni de rafinare personalizate/i);
      await user.type(input, 'Test{enter}');

      await waitFor(() => {
        expect(onRefine).toHaveBeenCalledWith('Test');
      });
    });

    it('should not call onRefine with empty instruction', () => {
      const onRefine = jest.fn();
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      fireEvent.click(screen.getByRole('button', { name: /Rafinează/i }));

      expect(onRefine).not.toHaveBeenCalled();
    });

    it('should disable button when input is empty', () => {
      render(<RefinementInput {...defaultProps} />);

      const button = screen.getByRole('button', { name: /Rafinează/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Quick actions', () => {
    it('should call onRefine with "shorter" instruction', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      fireEvent.click(screen.getByText(/Mai scurt/i));

      await waitFor(() => {
        expect(onRefine).toHaveBeenCalledWith('Fă-l mai scurt');
      });
    });

    it('should call onRefine with "formal" instruction', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      fireEvent.click(screen.getByText(/Mai formal/i));

      await waitFor(() => {
        expect(onRefine).toHaveBeenCalledWith('Fă-l mai formal');
      });
    });

    it('should call onRefine with "detailed" instruction', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      fireEvent.click(screen.getByText(/Mai detaliat/i));

      await waitFor(() => {
        expect(onRefine).toHaveBeenCalledWith('Adaugă mai multe detalii');
      });
    });
  });

  describe('Translation actions', () => {
    it('should call onRefine with Romanian translation instruction', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      fireEvent.click(screen.getByText(/În română/i));

      await waitFor(() => {
        expect(onRefine).toHaveBeenCalledWith('Traduce în română');
      });
    });

    it('should call onRefine with English translation instruction', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      fireEvent.click(screen.getByText(/În engleză/i));

      await waitFor(() => {
        expect(onRefine).toHaveBeenCalledWith('Traduce în engleză');
      });
    });
  });

  describe('Loading state', () => {
    it('should disable input when loading', () => {
      render(<RefinementInput {...defaultProps} loading={true} />);

      expect(screen.getByPlaceholderText(/Instrucțiuni de rafinare personalizate/i)).toBeDisabled();
    });

    it('should disable buttons when loading', () => {
      render(<RefinementInput {...defaultProps} loading={true} />);

      expect(screen.getByRole('button', { name: /Se rafinează/i })).toBeDisabled();
      expect(screen.getByText(/Mai scurt/i).closest('button')).toBeDisabled();
    });

    it('should show loading indicator on refine button', () => {
      render(<RefinementInput {...defaultProps} loading={true} />);

      expect(screen.getByText(/Se rafinează/i)).toBeInTheDocument();
    });

    it('should have aria-busy when loading', () => {
      render(<RefinementInput {...defaultProps} loading={true} />);

      const button = screen.getByRole('button', { name: /Se rafinează/i });
      expect(button).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Refinement history', () => {
    const mockHistory = [
      {
        id: 'ref-1',
        instruction: 'Make it shorter',
        createdAt: new Date().toISOString(),
        tokensUsed: 150,
      },
      {
        id: 'ref-2',
        instruction: 'Add more details',
        createdAt: new Date().toISOString(),
        tokensUsed: 200,
      },
    ];

    it('should show history toggle button when history exists', () => {
      render(<RefinementInput {...defaultProps} refinementHistory={mockHistory} />);

      expect(screen.getByText(/Arată istoric/i)).toBeInTheDocument();
    });

    it('should hide history toggle when no history', () => {
      render(<RefinementInput {...defaultProps} refinementHistory={[]} />);

      expect(screen.queryByText(/istoric/i)).not.toBeInTheDocument();
    });

    it('should toggle history visibility', () => {
      render(<RefinementInput {...defaultProps} refinementHistory={mockHistory} />);

      fireEvent.click(screen.getByText(/Arată istoric/i));

      expect(screen.getByText(/Rafinări recente/i)).toBeInTheDocument();
      expect(screen.getByText(/Make it shorter/i)).toBeInTheDocument();
    });

    it('should show hide text when history is visible', () => {
      render(<RefinementInput {...defaultProps} refinementHistory={mockHistory} />);

      fireEvent.click(screen.getByText(/Arată istoric/i));

      expect(screen.getByText(/Ascunde istoric/i)).toBeInTheDocument();
    });

    it('should display token usage', () => {
      render(<RefinementInput {...defaultProps} refinementHistory={mockHistory} />);

      fireEvent.click(screen.getByText(/Arată istoric/i));

      expect(screen.getByText(/150 token-uri utilizați/i)).toBeInTheDocument();
      expect(screen.getByText(/200 token-uri utilizați/i)).toBeInTheDocument();
    });

    it('should limit history to 5 items', () => {
      const longHistory = Array.from({ length: 10 }, (_, i) => ({
        id: `ref-${i}`,
        instruction: `Instruction ${i}`,
        createdAt: new Date().toISOString(),
        tokensUsed: 100,
      }));

      render(<RefinementInput {...defaultProps} refinementHistory={longHistory} />);

      fireEvent.click(screen.getByText(/Arată istoric/i));

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(5);
    });
  });

  describe('Accessibility', () => {
    it('should have proper label for input', () => {
      render(<RefinementInput {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Instrucțiuni de rafinare personalizate/i);
      expect(input).toHaveAttribute('aria-label', 'Instrucțiune personalizată de rafinare');
    });

    it('should have proper group role for quick actions', () => {
      render(<RefinementInput {...defaultProps} />);

      expect(screen.getByRole('group', { name: /Quick refinement actions/i })).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      render(<RefinementInput {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Instrucțiuni de rafinare personalizate/i);
      input.focus();

      expect(document.activeElement).toBe(input);
    });

    it('should have list role for history', () => {
      const mockHistory = [
        {
          id: 'ref-1',
          instruction: 'Test',
          createdAt: new Date().toISOString(),
          tokensUsed: 100,
        },
      ];

      render(<RefinementInput {...defaultProps} refinementHistory={mockHistory} />);

      fireEvent.click(screen.getByText(/Arată istoric/i));

      expect(screen.getByRole('list', { name: /Istoric rafinări/i })).toBeInTheDocument();
    });
  });
});
