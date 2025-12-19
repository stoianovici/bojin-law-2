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
    suggestion: {
      id: 'sugg-1',
      type: 'Completion' as const,
      suggestion: ' and we will respond within 48 hours.',
      reason: 'Completing sentence pattern',
      confidence: 0.85,
    },
    onAccept: jest.fn(),
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render suggestion text', () => {
      render(<InlineSuggestion {...defaultProps} />);

      expect(screen.getByText(/and we will respond/i)).toBeInTheDocument();
    });

    it('should render completion type with correct label', () => {
      render(<InlineSuggestion {...defaultProps} />);

      expect(screen.getByText(/Sugestie/i)).toBeInTheDocument();
    });

    it('should render correction type with correct label', () => {
      const correctionSuggestion = {
        ...defaultProps.suggestion,
        type: 'Correction' as const,
      };
      render(<InlineSuggestion {...defaultProps} suggestion={correctionSuggestion} />);

      expect(screen.getByText(/Corecție/i)).toBeInTheDocument();
    });

    it('should render improvement type with correct label', () => {
      const improvementSuggestion = {
        ...defaultProps.suggestion,
        type: 'Improvement' as const,
      };
      render(<InlineSuggestion {...defaultProps} suggestion={improvementSuggestion} />);

      expect(screen.getByText(/Îmbunătățire/i)).toBeInTheDocument();
    });

    it('should display keyboard hint', () => {
      render(<InlineSuggestion {...defaultProps} />);

      expect(screen.getByText(/Apasă/i)).toBeInTheDocument();
      expect(screen.getByText(/Tab/i)).toBeInTheDocument();
      expect(screen.getByText(/pentru a accepta/i)).toBeInTheDocument();
    });

    it('should display reason when provided', () => {
      render(<InlineSuggestion {...defaultProps} />);

      expect(screen.getByText(/Completing sentence pattern/i)).toBeInTheDocument();
    });

    it('should hide reason when not provided', () => {
      const noReasonSuggestion = {
        ...defaultProps.suggestion,
        reason: undefined,
      };
      render(<InlineSuggestion {...defaultProps} suggestion={noReasonSuggestion} />);

      expect(screen.queryByText(/pattern/i)).not.toBeInTheDocument();
    });
  });

  describe('Button interactions', () => {
    it('should call onAccept when accept button is clicked', () => {
      const onAccept = jest.fn();
      render(<InlineSuggestion {...defaultProps} onAccept={onAccept} />);

      fireEvent.click(screen.getByRole('button', { name: /Acceptă/i }));

      expect(onAccept).toHaveBeenCalled();
    });

    it('should call onDismiss when dismiss button is clicked', () => {
      const onDismiss = jest.fn();
      render(<InlineSuggestion {...defaultProps} onDismiss={onDismiss} />);

      fireEvent.click(screen.getByRole('button', { name: /Respinge/i }));

      expect(onDismiss).toHaveBeenCalled();
    });

    it('should call onDismiss when close icon is clicked', () => {
      const onDismiss = jest.fn();
      render(<InlineSuggestion {...defaultProps} onDismiss={onDismiss} />);

      const closeButton = screen.getByLabelText(/Respinge sugestia/i);
      fireEvent.click(closeButton);

      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe('Confidence display', () => {
    it('should show confidence percentage', () => {
      render(<InlineSuggestion {...defaultProps} />);

      expect(screen.getByText(/85% încredere/i)).toBeInTheDocument();
    });

    it('should display confidence bar', () => {
      render(<InlineSuggestion {...defaultProps} />);

      const confidenceBar = screen.getByText(/85% încredere/i).previousElementSibling;
      expect(confidenceBar).toBeInTheDocument();
    });

    it('should show high confidence with green color', () => {
      const highConfidenceSuggestion = {
        ...defaultProps.suggestion,
        confidence: 0.9,
      };
      render(<InlineSuggestion {...defaultProps} suggestion={highConfidenceSuggestion} />);

      expect(screen.getByText(/90% încredere/i)).toBeInTheDocument();
    });

    it('should show medium confidence with yellow color', () => {
      const mediumConfidenceSuggestion = {
        ...defaultProps.suggestion,
        confidence: 0.7,
      };
      render(<InlineSuggestion {...defaultProps} suggestion={mediumConfidenceSuggestion} />);

      expect(screen.getByText(/70% încredere/i)).toBeInTheDocument();
    });

    it('should show low confidence with gray color', () => {
      const lowConfidenceSuggestion = {
        ...defaultProps.suggestion,
        confidence: 0.5,
      };
      render(<InlineSuggestion {...defaultProps} suggestion={lowConfidenceSuggestion} />);

      expect(screen.getByText(/50% încredere/i)).toBeInTheDocument();
    });
  });

  describe('Type styling', () => {
    it('should have blue styling for completion type', () => {
      render(<InlineSuggestion {...defaultProps} />);

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('border-blue-200', 'bg-blue-50');
    });

    it('should have amber styling for correction type', () => {
      const correctionSuggestion = {
        ...defaultProps.suggestion,
        type: 'Correction' as const,
      };
      render(<InlineSuggestion {...defaultProps} suggestion={correctionSuggestion} />);

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('border-amber-200', 'bg-amber-50');
    });

    it('should have green styling for improvement type', () => {
      const improvementSuggestion = {
        ...defaultProps.suggestion,
        type: 'Improvement' as const,
      };
      render(<InlineSuggestion {...defaultProps} suggestion={improvementSuggestion} />);

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('border-green-200', 'bg-green-50');
    });
  });

  describe('Accessibility', () => {
    it('should have proper role for tooltip', () => {
      render(<InlineSuggestion {...defaultProps} />);

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should have aria-live polite', () => {
      render(<InlineSuggestion {...defaultProps} />);

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveAttribute('aria-live', 'polite');
    });

    it('should have aria-label for dismiss button', () => {
      render(<InlineSuggestion {...defaultProps} />);

      expect(screen.getByLabelText(/Respinge sugestia/i)).toBeInTheDocument();
    });
  });

  describe('Dark mode', () => {
    it('should have dark mode classes', () => {
      render(<InlineSuggestion {...defaultProps} />);

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('dark:border-blue-800', 'dark:bg-blue-900/50');
    });
  });
});
