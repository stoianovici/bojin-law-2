/**
 * DraftIndicator Component Tests
 * Story 5.3: AI-Powered Email Drafting - Task 29
 *
 * Tests draft status display and confidence indicators
 */

import { render, screen } from '@testing-library/react';
import { DraftIndicator } from '../DraftIndicator';

describe('DraftIndicator', () => {
  describe('Status Display', () => {
    it('should render Generated status with correct styling', () => {
      render(<DraftIndicator status="Generated" confidence={0.85} />);

      expect(screen.getByText(/Generat/i)).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-blue-100', 'text-blue-800');
    });

    it('should render Editing status with correct styling', () => {
      render(<DraftIndicator status="Editing" confidence={0.85} />);

      expect(screen.getByText(/Editare/i)).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });

    it('should render Ready status with correct styling', () => {
      render(<DraftIndicator status="Ready" confidence={0.85} />);

      expect(screen.getByText(/Pregătit/i)).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('should render Sent status with correct styling', () => {
      render(<DraftIndicator status="Sent" confidence={0.85} />);

      expect(screen.getByText(/Trimis/i)).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-gray-100', 'text-gray-800');
    });

    it('should render Discarded status with correct styling', () => {
      render(<DraftIndicator status="Discarded" confidence={0.85} />);

      expect(screen.getByText(/Anulat/i)).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-red-100', 'text-red-800');
    });
  });

  describe('Confidence Display', () => {
    it('should display high confidence (>= 0.8) with green indicator', () => {
      render(<DraftIndicator status="Generated" confidence={0.90} />);

      expect(screen.getByText(/90%/i)).toBeInTheDocument();
      expect(screen.getByText(/90%/i)).toHaveClass('text-green-600');
    });

    it('should display medium confidence (0.6-0.8) with yellow indicator', () => {
      render(<DraftIndicator status="Generated" confidence={0.70} />);

      expect(screen.getByText(/70%/i)).toBeInTheDocument();
      expect(screen.getByText(/70%/i)).toHaveClass('text-yellow-600');
    });

    it('should display low confidence (< 0.6) with red indicator', () => {
      render(<DraftIndicator status="Generated" confidence={0.50} />);

      expect(screen.getByText(/50%/i)).toBeInTheDocument();
      expect(screen.getByText(/50%/i)).toHaveClass('text-red-600');
    });

    it('should hide confidence when not provided', () => {
      render(<DraftIndicator status="Generated" />);

      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });
  });

  describe('Compact variant', () => {
    it('should render compact version without confidence', () => {
      render(<DraftIndicator status="Generated" confidence={0.85} variant="compact" />);

      expect(screen.getByText(/Generat/i)).toBeInTheDocument();
      expect(screen.queryByText(/85%/i)).not.toBeInTheDocument();
    });

    it('should have smaller padding in compact mode', () => {
      render(<DraftIndicator status="Generated" variant="compact" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('px-2', 'py-0.5');
    });
  });

  describe('Icons', () => {
    it('should display appropriate icon for each status', () => {
      const { rerender } = render(<DraftIndicator status="Generated" />);
      expect(screen.getByRole('status').querySelector('svg')).toBeInTheDocument();

      rerender(<DraftIndicator status="Ready" />);
      expect(screen.getByRole('status').querySelector('svg')).toBeInTheDocument();

      rerender(<DraftIndicator status="Sent" />);
      expect(screen.getByRole('status').querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper role and aria-label', () => {
      render(<DraftIndicator status="Generated" confidence={0.85} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label', expect.stringContaining('Generat'));
    });
  });

  describe('Dark mode', () => {
    it('should have dark mode classes', () => {
      render(<DraftIndicator status="Generated" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('dark:bg-blue-900/30', 'dark:text-blue-400');
    });
  });
});
