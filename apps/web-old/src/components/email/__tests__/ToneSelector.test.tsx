/**
 * ToneSelector Component Tests
 * Story 5.3: AI-Powered Email Drafting - Task 29
 *
 * Tests tone selection functionality and visual feedback
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ToneSelector } from '../ToneSelector';

describe('ToneSelector', () => {
  const defaultProps = {
    tones: ['Formal', 'Professional', 'Brief', 'Detailed'] as const,
    selectedTone: 'Professional' as const,
    onSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all tone options', () => {
      render(<ToneSelector {...defaultProps} />);

      expect(screen.getByText(/Formal/i)).toBeInTheDocument();
      expect(screen.getByText(/Professional/i)).toBeInTheDocument();
      expect(screen.getByText(/Brief/i)).toBeInTheDocument();
      expect(screen.getByText(/Detailed/i)).toBeInTheDocument();
    });

    it('should display the selected tone with active styling', () => {
      render(<ToneSelector {...defaultProps} />);

      const professionalButton = screen.getByRole('radio', { name: /Professional/i });
      expect(professionalButton).toHaveClass('border-blue-500', 'bg-blue-50');
    });

    it('should show AI badge on recommended tone', () => {
      render(<ToneSelector {...defaultProps} recommendedTone="Formal" />);

      const formalButton = screen.getByRole('radio', { name: /Formal/i });
      expect(formalButton.querySelector('span')).toHaveTextContent('AI');
    });

    it('should display tone descriptions for screen readers', () => {
      render(<ToneSelector {...defaultProps} />);

      expect(screen.getByText(/Court or official correspondence/i)).toBeInTheDocument();
      expect(screen.getByText(/Standard business communication/i)).toBeInTheDocument();
      expect(screen.getByText(/Quick and concise acknowledgment/i)).toBeInTheDocument();
      expect(screen.getByText(/Comprehensive with full explanations/i)).toBeInTheDocument();
    });

    it('should show selected tone description', () => {
      render(<ToneSelector {...defaultProps} selectedTone="Brief" />);

      expect(screen.getByText(/Quick and concise acknowledgment/i)).toBeInTheDocument();
    });
  });

  describe('Recommendation display', () => {
    it('should show recommendation reason when provided', () => {
      render(
        <ToneSelector
          {...defaultProps}
          recommendedTone="Formal"
          recommendationReason="Court correspondence requires formal tone"
        />
      );

      expect(screen.getByText(/Court correspondence requires formal tone/i)).toBeInTheDocument();
    });

    it('should show recommended label', () => {
      render(
        <ToneSelector
          {...defaultProps}
          recommendedTone="Formal"
          recommendationReason="Test reason"
        />
      );

      expect(screen.getByText(/Recommended: Formal/i)).toBeInTheDocument();
    });

    it('should not show recommendation without reason', () => {
      render(<ToneSelector {...defaultProps} recommendedTone="Formal" />);

      expect(screen.queryByText(/Recommended/i)).not.toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onSelect when clicking a tone', () => {
      const onSelect = jest.fn();
      render(<ToneSelector {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('radio', { name: /Formal/i }));

      expect(onSelect).toHaveBeenCalledWith('Formal');
    });

    it('should allow selecting already selected tone', () => {
      const onSelect = jest.fn();
      render(<ToneSelector {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('radio', { name: /Professional/i }));

      expect(onSelect).toHaveBeenCalledWith('Professional');
    });

    it('should support keyboard navigation with arrow keys', () => {
      const onSelect = jest.fn();
      render(<ToneSelector {...defaultProps} onSelect={onSelect} selectedTone="Formal" />);

      const formalButton = screen.getByRole('radio', { name: /Formal/i });
      formalButton.focus();
      fireEvent.keyDown(formalButton, { key: 'ArrowRight' });

      expect(onSelect).toHaveBeenCalledWith('Professional');
    });

    it('should support ArrowDown navigation', () => {
      const onSelect = jest.fn();
      render(<ToneSelector {...defaultProps} onSelect={onSelect} selectedTone="Formal" />);

      const formalButton = screen.getByRole('radio', { name: /Formal/i });
      fireEvent.keyDown(formalButton, { key: 'ArrowDown' });

      expect(onSelect).toHaveBeenCalledWith('Professional');
    });

    it('should support ArrowLeft navigation', () => {
      const onSelect = jest.fn();
      render(<ToneSelector {...defaultProps} onSelect={onSelect} selectedTone="Professional" />);

      const professionalButton = screen.getByRole('radio', { name: /Professional/i });
      fireEvent.keyDown(professionalButton, { key: 'ArrowLeft' });

      expect(onSelect).toHaveBeenCalledWith('Formal');
    });

    it('should support ArrowUp navigation', () => {
      const onSelect = jest.fn();
      render(<ToneSelector {...defaultProps} onSelect={onSelect} selectedTone="Professional" />);

      const professionalButton = screen.getByRole('radio', { name: /Professional/i });
      fireEvent.keyDown(professionalButton, { key: 'ArrowUp' });

      expect(onSelect).toHaveBeenCalledWith('Formal');
    });

    it('should wrap around at end with ArrowRight', () => {
      const onSelect = jest.fn();
      render(<ToneSelector {...defaultProps} onSelect={onSelect} selectedTone="Detailed" />);

      const detailedButton = screen.getByRole('radio', { name: /Detailed/i });
      fireEvent.keyDown(detailedButton, { key: 'ArrowRight' });

      expect(onSelect).toHaveBeenCalledWith('Formal');
    });

    it('should wrap around at start with ArrowLeft', () => {
      const onSelect = jest.fn();
      render(<ToneSelector {...defaultProps} onSelect={onSelect} selectedTone="Formal" />);

      const formalButton = screen.getByRole('radio', { name: /Formal/i });
      fireEvent.keyDown(formalButton, { key: 'ArrowLeft' });

      expect(onSelect).toHaveBeenCalledWith('Detailed');
    });
  });

  describe('Icons', () => {
    it('should display appropriate icon for each tone', () => {
      render(<ToneSelector {...defaultProps} />);

      const formalButton = screen.getByRole('radio', { name: /Formal/i });
      const professionalButton = screen.getByRole('radio', { name: /Professional/i });
      const briefButton = screen.getByRole('radio', { name: /Brief/i });
      const detailedButton = screen.getByRole('radio', { name: /Detailed/i });

      expect(formalButton.querySelector('svg')).toBeInTheDocument();
      expect(professionalButton.querySelector('svg')).toBeInTheDocument();
      expect(briefButton.querySelector('svg')).toBeInTheDocument();
      expect(detailedButton.querySelector('svg')).toBeInTheDocument();
    });

    it('should highlight icon for selected tone', () => {
      render(<ToneSelector {...defaultProps} selectedTone="Professional" />);

      const professionalButton = screen.getByRole('radio', { name: /Professional/i });
      const icon = professionalButton.querySelector('svg');

      expect(icon).toHaveClass('text-blue-600');
    });
  });

  describe('Accessibility', () => {
    it('should have proper radiogroup role', () => {
      render(<ToneSelector {...defaultProps} />);

      expect(screen.getByRole('radiogroup', { name: /Select email tone/i })).toBeInTheDocument();
    });

    it('should have proper aria-checked on selected tone', () => {
      render(<ToneSelector {...defaultProps} selectedTone="Professional" />);

      const professionalButton = screen.getByRole('radio', { name: /Professional/i });
      expect(professionalButton).toHaveAttribute('aria-checked', 'true');
    });

    it('should have aria-checked false on non-selected tones', () => {
      render(<ToneSelector {...defaultProps} selectedTone="Professional" />);

      const formalButton = screen.getByRole('radio', { name: /Formal/i });
      expect(formalButton).toHaveAttribute('aria-checked', 'false');
    });

    it('should have aria-describedby for each tone', () => {
      render(<ToneSelector {...defaultProps} />);

      const formalButton = screen.getByRole('radio', { name: /Formal/i });
      expect(formalButton).toHaveAttribute('aria-describedby', 'tone-desc-Formal');
    });

    it('should link to recommendation reason when present', () => {
      render(
        <ToneSelector
          {...defaultProps}
          recommendedTone="Formal"
          recommendationReason="Test reason"
        />
      );

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toHaveAttribute('aria-describedby', 'tone-recommendation');
    });

    it('should have focus ring', () => {
      render(<ToneSelector {...defaultProps} />);

      const formalButton = screen.getByRole('radio', { name: /Formal/i });
      expect(formalButton).toHaveClass('focus:ring-2', 'focus:ring-blue-500');
    });
  });

  describe('Dark mode', () => {
    it('should have dark mode classes', () => {
      render(<ToneSelector {...defaultProps} />);

      const formalButton = screen.getByRole('radio', { name: /Formal/i });
      expect(formalButton).toHaveClass('dark:border-gray-700', 'dark:bg-gray-800');
    });

    it('should have dark mode classes for selected state', () => {
      render(<ToneSelector {...defaultProps} selectedTone="Formal" />);

      const formalButton = screen.getByRole('radio', { name: /Formal/i });
      expect(formalButton).toHaveClass('dark:border-blue-400', 'dark:bg-blue-900/30');
    });
  });

  describe('Grid layout', () => {
    it('should use responsive grid layout', () => {
      render(<ToneSelector {...defaultProps} />);

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toHaveClass('grid', 'grid-cols-2', 'sm:grid-cols-4');
    });
  });
});
