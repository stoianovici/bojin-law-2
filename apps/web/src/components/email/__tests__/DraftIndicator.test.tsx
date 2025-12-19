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

      expect(screen.getByText(/Draft AI/i)).toBeInTheDocument();
      const indicator = screen.getByText(/Draft AI/i).parentElement;
      expect(indicator).toHaveClass('bg-blue-100', 'text-blue-700');
    });

    it('should render Editing status with correct styling', () => {
      render(<DraftIndicator status="Editing" confidence={0.85} />);

      expect(screen.getByText(/În editare/i)).toBeInTheDocument();
      const indicator = screen.getByText(/În editare/i).parentElement;
      expect(indicator).toHaveClass('bg-amber-100', 'text-amber-700');
    });

    it('should render Ready status with correct styling', () => {
      render(<DraftIndicator status="Ready" confidence={0.85} />);

      expect(screen.getByText(/Gata/i)).toBeInTheDocument();
      const indicator = screen.getByText(/Gata/i).parentElement;
      expect(indicator).toHaveClass('bg-green-100', 'text-green-700');
    });

    it('should render Sent status with correct styling', () => {
      render(<DraftIndicator status="Sent" confidence={0.85} />);

      expect(screen.getByText(/Trimis/i)).toBeInTheDocument();
      const indicator = screen.getByText(/Trimis/i).parentElement;
      expect(indicator).toHaveClass('bg-gray-100', 'text-gray-700');
    });

    it('should render Discarded status with correct styling', () => {
      render(<DraftIndicator status="Discarded" confidence={0.85} />);

      expect(screen.getByText(/Anulat/i)).toBeInTheDocument();
      const indicator = screen.getByText(/Anulat/i).parentElement;
      expect(indicator).toHaveClass('bg-red-100', 'text-red-700');
    });
  });

  describe('Confidence Display', () => {
    it('should display high confidence (>= 0.8) with green indicator', () => {
      render(<DraftIndicator status="Generated" confidence={0.9} showDetails={true} />);

      expect(screen.getByText(/90%/i)).toBeInTheDocument();
      expect(screen.getByText(/90%/i)).toHaveClass('text-green-700');
    });

    it('should display medium confidence (0.6-0.8) with amber indicator', () => {
      render(<DraftIndicator status="Generated" confidence={0.7} showDetails={true} />);

      expect(screen.getByText(/70%/i)).toBeInTheDocument();
      expect(screen.getByText(/70%/i)).toHaveClass('text-amber-700');
    });

    it('should display low confidence (< 0.6) with gray indicator', () => {
      render(<DraftIndicator status="Generated" confidence={0.5} showDetails={true} />);

      expect(screen.getByText(/50%/i)).toBeInTheDocument();
      expect(screen.getByText(/50%/i)).toHaveClass('text-gray-600');
    });

    it('should hide confidence when not provided', () => {
      render(<DraftIndicator status="Generated" />);

      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('should hide confidence when showDetails is false', () => {
      render(<DraftIndicator status="Generated" confidence={0.85} showDetails={false} />);

      expect(screen.queryByText(/85%/)).not.toBeInTheDocument();
    });
  });

  describe('Size variants', () => {
    it('should render small size correctly', () => {
      render(<DraftIndicator status="Generated" size="sm" />);

      const indicator = screen.getByText(/Draft AI/i).parentElement;
      expect(indicator).toHaveClass('text-xs', 'px-1.5', 'py-0.5');
    });

    it('should render medium size correctly', () => {
      render(<DraftIndicator status="Generated" size="md" />);

      const indicator = screen.getByText(/Draft AI/i).parentElement;
      expect(indicator).toHaveClass('text-sm', 'px-2', 'py-1');
    });

    it('should default to medium size', () => {
      render(<DraftIndicator status="Generated" />);

      const indicator = screen.getByText(/Draft AI/i).parentElement;
      expect(indicator).toHaveClass('text-sm');
    });
  });

  describe('Icons', () => {
    it('should display appropriate icon for each status', () => {
      const { rerender } = render(<DraftIndicator status="Generated" />);
      expect(screen.getByText(/Draft AI/i).parentElement?.querySelector('svg')).toBeInTheDocument();

      rerender(<DraftIndicator status="Ready" />);
      expect(screen.getByText(/Gata/i).parentElement?.querySelector('svg')).toBeInTheDocument();

      rerender(<DraftIndicator status="Sent" />);
      expect(screen.getByText(/Trimis/i).parentElement?.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Tone display', () => {
    it('should show tone when provided and showDetails is true', () => {
      render(<DraftIndicator status="Generated" tone="Formal" showDetails={true} />);

      expect(screen.getByText(/Formal/i)).toBeInTheDocument();
    });

    it('should hide tone when showDetails is false', () => {
      render(<DraftIndicator status="Generated" tone="Formal" showDetails={false} />);

      expect(screen.queryByText(/Formal/i)).not.toBeInTheDocument();
    });

    it('should hide tone for Sent status', () => {
      render(<DraftIndicator status="Sent" tone="Formal" showDetails={true} />);

      expect(screen.queryByText(/Formal/i)).not.toBeInTheDocument();
    });
  });

  describe('Timestamp display', () => {
    it('should show timestamp when provided and showDetails is true', () => {
      const updatedAt = new Date().toISOString();
      render(<DraftIndicator status="Generated" updatedAt={updatedAt} showDetails={true} />);

      expect(screen.getByText(/ago/i)).toBeInTheDocument();
    });

    it('should hide timestamp when showDetails is false', () => {
      const updatedAt = new Date().toISOString();
      render(<DraftIndicator status="Generated" updatedAt={updatedAt} showDetails={false} />);

      expect(screen.queryByText(/ago/i)).not.toBeInTheDocument();
    });
  });

  describe('Dark mode', () => {
    it('should have dark mode classes', () => {
      render(<DraftIndicator status="Generated" />);

      const indicator = screen.getByText(/Draft AI/i).parentElement;
      expect(indicator).toHaveClass('dark:bg-blue-900/30', 'dark:text-blue-300');
    });
  });
});
