/**
 * RecipientTypeIndicator Component Tests
 * Story 5.3: AI-Powered Email Drafting - Task 29
 *
 * Tests recipient type display and styling
 */

import { render, screen } from '@testing-library/react';
import { RecipientTypeIndicator } from '../RecipientTypeIndicator';

describe('RecipientTypeIndicator', () => {
  describe('Rendering', () => {
    it('should render Client type with correct styling', () => {
      render(<RecipientTypeIndicator type="Client" />);

      expect(screen.getByText(/Client/i)).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-blue-100', 'text-blue-800');
    });

    it('should render OpposingCounsel type with correct styling', () => {
      render(<RecipientTypeIndicator type="OpposingCounsel" />);

      expect(screen.getByText(/Parte adversă/i)).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-red-100', 'text-red-800');
    });

    it('should render Court type with correct styling', () => {
      render(<RecipientTypeIndicator type="Court" />);

      expect(screen.getByText(/Instanță/i)).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-purple-100', 'text-purple-800');
    });

    it('should render ThirdParty type with correct styling', () => {
      render(<RecipientTypeIndicator type="ThirdParty" />);

      expect(screen.getByText(/Terț/i)).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-gray-100', 'text-gray-800');
    });

    it('should render Internal type with correct styling', () => {
      render(<RecipientTypeIndicator type="Internal" />);

      expect(screen.getByText(/Intern/i)).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-green-100', 'text-green-800');
    });
  });

  describe('Icons', () => {
    it('should display icon for each type', () => {
      const { rerender } = render(<RecipientTypeIndicator type="Client" />);
      expect(screen.getByRole('status').querySelector('svg')).toBeInTheDocument();

      rerender(<RecipientTypeIndicator type="Court" />);
      expect(screen.getByRole('status').querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Size variants', () => {
    it('should render small variant correctly', () => {
      render(<RecipientTypeIndicator type="Client" size="sm" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('text-xs', 'px-2', 'py-0.5');
    });

    it('should render medium variant correctly', () => {
      render(<RecipientTypeIndicator type="Client" size="md" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('text-sm', 'px-2.5', 'py-1');
    });

    it('should default to medium size', () => {
      render(<RecipientTypeIndicator type="Client" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('text-sm');
    });
  });

  describe('Dark mode', () => {
    it('should have dark mode classes', () => {
      render(<RecipientTypeIndicator type="Client" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('dark:bg-blue-900/30', 'dark:text-blue-400');
    });
  });

  describe('Accessibility', () => {
    it('should have proper role and label', () => {
      render(<RecipientTypeIndicator type="Court" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label');
    });
  });
});
