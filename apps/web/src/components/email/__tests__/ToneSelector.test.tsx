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
    selectedTone: 'Professional' as const,
    recommendedTone: 'Formal' as const,
    onToneChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all tone options', () => {
      render(<ToneSelector {...defaultProps} />);

      expect(screen.getByText(/Formal/i)).toBeInTheDocument();
      expect(screen.getByText(/Profesional/i)).toBeInTheDocument();
      expect(screen.getByText(/Concis/i)).toBeInTheDocument();
      expect(screen.getByText(/Detaliat/i)).toBeInTheDocument();
    });

    it('should display the selected tone with active styling', () => {
      render(<ToneSelector {...defaultProps} />);

      const professionalButton = screen.getByRole('button', { name: /Profesional/i });
      expect(professionalButton).toHaveClass('bg-blue-50', 'border-blue-500');
    });

    it('should show recommended badge on recommended tone', () => {
      render(<ToneSelector {...defaultProps} />);

      const formalButton = screen.getByRole('button', { name: /Formal/i });
      expect(formalButton).toContainElement(screen.getByText(/Recomandat/i));
    });

    it('should display tone descriptions', () => {
      render(<ToneSelector {...defaultProps} />);

      expect(screen.getByText(/Limbaj protocolar/i)).toBeInTheDocument();
      expect(screen.getByText(/Echilibrat și clar/i)).toBeInTheDocument();
      expect(screen.getByText(/Direct și la obiect/i)).toBeInTheDocument();
      expect(screen.getByText(/Explicații complete/i)).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onToneChange when clicking a tone', () => {
      const onToneChange = jest.fn();
      render(<ToneSelector {...defaultProps} onToneChange={onToneChange} />);

      fireEvent.click(screen.getByRole('button', { name: /Formal/i }));

      expect(onToneChange).toHaveBeenCalledWith('Formal');
    });

    it('should not call onToneChange when clicking selected tone', () => {
      const onToneChange = jest.fn();
      render(<ToneSelector {...defaultProps} onToneChange={onToneChange} />);

      fireEvent.click(screen.getByRole('button', { name: /Profesional/i }));

      expect(onToneChange).not.toHaveBeenCalled();
    });

    it('should support keyboard navigation', () => {
      const onToneChange = jest.fn();
      render(<ToneSelector {...defaultProps} onToneChange={onToneChange} />);

      const formalButton = screen.getByRole('button', { name: /Formal/i });
      formalButton.focus();
      fireEvent.keyDown(formalButton, { key: 'Enter' });

      expect(onToneChange).toHaveBeenCalledWith('Formal');
    });
  });

  describe('Edge cases', () => {
    it('should handle no recommended tone', () => {
      render(<ToneSelector {...defaultProps} recommendedTone={undefined} />);

      expect(screen.queryByText(/Recomandat/i)).not.toBeInTheDocument();
    });

    it('should handle recommendation reason', () => {
      render(
        <ToneSelector
          {...defaultProps}
          recommendedTone="Formal"
          recommendationReason="Corespondență instanță"
        />
      );

      expect(screen.getByText(/Corespondență instanță/i)).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should disable buttons when loading', () => {
      render(<ToneSelector {...defaultProps} isLoading={true} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });
});
