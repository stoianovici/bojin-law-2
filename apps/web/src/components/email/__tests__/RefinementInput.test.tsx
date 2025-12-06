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
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render instruction input', () => {
      render(<RefinementInput {...defaultProps} />);

      expect(screen.getByPlaceholderText(/Instrucțiuni de rafinare/i)).toBeInTheDocument();
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
  });

  describe('Instruction input', () => {
    it('should allow typing instruction', async () => {
      render(<RefinementInput {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Instrucțiuni de rafinare/i);
      await userEvent.type(input, 'Make it more formal');

      expect(input).toHaveValue('Make it more formal');
    });

    it('should clear input after successful refinement', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      const input = screen.getByPlaceholderText(/Instrucțiuni de rafinare/i);
      await userEvent.type(input, 'Test instruction');
      fireEvent.click(screen.getByRole('button', { name: /Rafinează/i }));

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  describe('Refine action', () => {
    it('should call onRefine with instruction when button is clicked', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      const input = screen.getByPlaceholderText(/Instrucțiuni de rafinare/i);
      await userEvent.type(input, 'Make it shorter');
      fireEvent.click(screen.getByRole('button', { name: /Rafinează/i }));

      expect(onRefine).toHaveBeenCalledWith('Make it shorter');
    });

    it('should call onRefine when Enter is pressed', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      const input = screen.getByPlaceholderText(/Instrucțiuni de rafinare/i);
      await userEvent.type(input, 'Test{enter}');

      expect(onRefine).toHaveBeenCalledWith('Test');
    });

    it('should not call onRefine with empty instruction', () => {
      const onRefine = jest.fn();
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      fireEvent.click(screen.getByRole('button', { name: /Rafinează/i }));

      expect(onRefine).not.toHaveBeenCalled();
    });
  });

  describe('Quick actions', () => {
    it('should call onRefine with "shorter" instruction', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      fireEvent.click(screen.getByText(/Mai scurt/i));

      await waitFor(() => {
        expect(onRefine).toHaveBeenCalledWith(expect.stringContaining('scurt'));
      });
    });

    it('should call onRefine with "formal" instruction', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      fireEvent.click(screen.getByText(/Mai formal/i));

      await waitFor(() => {
        expect(onRefine).toHaveBeenCalledWith(expect.stringContaining('formal'));
      });
    });

    it('should call onRefine with "detailed" instruction', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      fireEvent.click(screen.getByText(/Mai detaliat/i));

      await waitFor(() => {
        expect(onRefine).toHaveBeenCalledWith(expect.stringContaining('detaliat'));
      });
    });
  });

  describe('Translation actions', () => {
    it('should render translation buttons', () => {
      render(<RefinementInput {...defaultProps} />);

      expect(screen.getByText(/În română/i)).toBeInTheDocument();
      expect(screen.getByText(/În engleză/i)).toBeInTheDocument();
    });

    it('should call onRefine with Romanian translation instruction', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      fireEvent.click(screen.getByText(/În română/i));

      await waitFor(() => {
        expect(onRefine).toHaveBeenCalledWith(expect.stringContaining('română'));
      });
    });

    it('should call onRefine with English translation instruction', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      fireEvent.click(screen.getByText(/În engleză/i));

      await waitFor(() => {
        expect(onRefine).toHaveBeenCalledWith(expect.stringContaining('engleză'));
      });
    });
  });

  describe('Loading state', () => {
    it('should disable input when loading', () => {
      render(<RefinementInput {...defaultProps} isLoading={true} />);

      expect(screen.getByPlaceholderText(/Instrucțiuni de rafinare/i)).toBeDisabled();
    });

    it('should disable buttons when loading', () => {
      render(<RefinementInput {...defaultProps} isLoading={true} />);

      expect(screen.getByRole('button', { name: /Rafinează/i })).toBeDisabled();
      expect(screen.getByText(/Mai scurt/i).closest('button')).toBeDisabled();
    });

    it('should show loading indicator on refine button', () => {
      render(<RefinementInput {...defaultProps} isLoading={true} />);

      expect(screen.getByRole('button', { name: /Rafinează/i })).toContainElement(
        document.querySelector('.animate-spin')
      );
    });
  });

  describe('Error handling', () => {
    it('should show error message when refinement fails', async () => {
      const onRefine = jest.fn().mockRejectedValue(new Error('Refinement failed'));
      render(<RefinementInput {...defaultProps} onRefine={onRefine} />);

      const input = screen.getByPlaceholderText(/Instrucțiuni de rafinare/i);
      await userEvent.type(input, 'Test');
      fireEvent.click(screen.getByRole('button', { name: /Rafinează/i }));

      await waitFor(() => {
        expect(screen.getByText(/eroare/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper label for input', () => {
      render(<RefinementInput {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Instrucțiuni de rafinare/i);
      expect(input).toHaveAttribute('aria-label');
    });

    it('should be keyboard navigable', () => {
      render(<RefinementInput {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Instrucțiuni de rafinare/i);
      input.focus();

      expect(document.activeElement).toBe(input);
    });
  });

  describe('Recent refinements', () => {
    it('should show recent refinements when available', () => {
      render(
        <RefinementInput
          {...defaultProps}
          recentRefinements={['Mai scurt', 'Adaugă detalii']}
        />
      );

      expect(screen.getByText(/Rafinări recente/i)).toBeInTheDocument();
    });

    it('should allow clicking recent refinement', async () => {
      const onRefine = jest.fn().mockResolvedValue(undefined);
      render(
        <RefinementInput
          {...defaultProps}
          onRefine={onRefine}
          recentRefinements={['Previous instruction']}
        />
      );

      fireEvent.click(screen.getByText('Previous instruction'));

      await waitFor(() => {
        expect(onRefine).toHaveBeenCalledWith('Previous instruction');
      });
    });
  });
});
