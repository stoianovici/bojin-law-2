/**
 * InlineSuggestion Component Tests
 * Story 5.3: AI-Powered Email Drafting - Task 29
 *
 * Tests inline AI suggestion overlay and keyboard interactions
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { InlineSuggestion } from '../InlineSuggestion';

describe('InlineSuggestion', () => {
  const defaultProps = {
    suggestion: ' and we will respond within 48 hours.',
    type: 'completion' as const,
    confidence: 0.85,
    onAccept: jest.fn(),
    onDismiss: jest.fn(),
    position: { top: 100, left: 200 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render suggestion text', () => {
      render(<InlineSuggestion {...defaultProps} />);

      expect(screen.getByText(/and we will respond/i)).toBeInTheDocument();
    });

    it('should render completion type styling', () => {
      render(<InlineSuggestion {...defaultProps} />);

      const suggestionElement = screen.getByRole('tooltip');
      expect(suggestionElement).toHaveClass('text-gray-400');
    });

    it('should render correction type styling', () => {
      render(<InlineSuggestion {...defaultProps} type="correction" />);

      const suggestionElement = screen.getByRole('tooltip');
      expect(suggestionElement).toHaveClass('text-yellow-600');
    });

    it('should render improvement type styling', () => {
      render(<InlineSuggestion {...defaultProps} type="improvement" />);

      const suggestionElement = screen.getByRole('tooltip');
      expect(suggestionElement).toHaveClass('text-blue-600');
    });

    it('should display keyboard hint', () => {
      render(<InlineSuggestion {...defaultProps} />);

      expect(screen.getByText(/Tab/i)).toBeInTheDocument();
      expect(screen.getByText(/Esc/i)).toBeInTheDocument();
    });

    it('should position suggestion correctly', () => {
      render(<InlineSuggestion {...defaultProps} position={{ top: 150, left: 250 }} />);

      const container = screen.getByRole('tooltip').closest('div');
      expect(container).toHaveStyle({ top: '150px', left: '250px' });
    });
  });

  describe('Keyboard interactions', () => {
    it('should call onAccept when Tab is pressed', () => {
      const onAccept = jest.fn();
      render(<InlineSuggestion {...defaultProps} onAccept={onAccept} />);

      fireEvent.keyDown(document, { key: 'Tab' });

      expect(onAccept).toHaveBeenCalledWith(defaultProps.suggestion);
    });

    it('should call onDismiss when Escape is pressed', () => {
      const onDismiss = jest.fn();
      render(<InlineSuggestion {...defaultProps} onDismiss={onDismiss} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onDismiss).toHaveBeenCalled();
    });

    it('should prevent default Tab behavior', () => {
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      render(<InlineSuggestion {...defaultProps} />);

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Click interactions', () => {
    it('should call onAccept when suggestion is clicked', () => {
      const onAccept = jest.fn();
      render(<InlineSuggestion {...defaultProps} onAccept={onAccept} />);

      fireEvent.click(screen.getByRole('tooltip'));

      expect(onAccept).toHaveBeenCalledWith(defaultProps.suggestion);
    });

    it('should call onDismiss when clicking outside', () => {
      const onDismiss = jest.fn();
      render(
        <div>
          <InlineSuggestion {...defaultProps} onDismiss={onDismiss} />
          <button>Outside</button>
        </div>
      );

      fireEvent.click(screen.getByText('Outside'));

      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe('Confidence display', () => {
    it('should show high confidence indicator', () => {
      render(<InlineSuggestion {...defaultProps} confidence={0.9} />);

      expect(screen.getByText(/90%/i)).toBeInTheDocument();
    });

    it('should style confidence based on level', () => {
      const { rerender } = render(<InlineSuggestion {...defaultProps} confidence={0.9} />);
      expect(screen.getByText(/90%/i)).toHaveClass('text-green-600');

      rerender(<InlineSuggestion {...defaultProps} confidence={0.7} />);
      expect(screen.getByText(/70%/i)).toHaveClass('text-yellow-600');

      rerender(<InlineSuggestion {...defaultProps} confidence={0.4} />);
      expect(screen.getByText(/40%/i)).toHaveClass('text-red-600');
    });
  });

  describe('Type icons', () => {
    it('should show completion icon for completion type', () => {
      render(<InlineSuggestion {...defaultProps} type="completion" />);

      expect(screen.getByRole('tooltip').querySelector('svg')).toBeInTheDocument();
    });

    it('should show different icon for correction type', () => {
      render(<InlineSuggestion {...defaultProps} type="correction" />);

      expect(screen.getByRole('tooltip').querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('should have fade-in animation class', () => {
      render(<InlineSuggestion {...defaultProps} />);

      const container = screen.getByRole('tooltip').closest('div');
      expect(container).toHaveClass('animate-fade-in');
    });
  });

  describe('Reason display', () => {
    it('should show reason when provided', () => {
      render(<InlineSuggestion {...defaultProps} reason="Completing sentence pattern" />);

      expect(screen.getByText(/Completing sentence/i)).toBeInTheDocument();
    });

    it('should not show reason when not provided', () => {
      render(<InlineSuggestion {...defaultProps} reason={undefined} />);

      // Only suggestion text should be present
      expect(screen.queryByText(/reason/i)).not.toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      const { unmount } = render(<InlineSuggestion {...defaultProps} />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });
});
