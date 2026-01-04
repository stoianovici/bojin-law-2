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
      render(<RecipientTypeIndicator recipientType="Client" />);

      expect(screen.getByText(/Client/i)).toBeInTheDocument();
      const indicator = screen.getByText(/Client/i).parentElement;
      expect(indicator).toHaveClass('bg-green-100', 'text-green-700');
    });

    it('should render OpposingCounsel type with correct styling', () => {
      render(<RecipientTypeIndicator recipientType="OpposingCounsel" />);

      expect(screen.getByText(/Avocat Parte Adversă/i)).toBeInTheDocument();
      const indicator = screen.getByText(/Avocat Parte Adversă/i).parentElement;
      expect(indicator).toHaveClass('bg-red-100', 'text-red-700');
    });

    it('should render Court type with correct styling', () => {
      render(<RecipientTypeIndicator recipientType="Court" />);

      expect(screen.getByText(/Instanță/i)).toBeInTheDocument();
      const indicator = screen.getByText(/Instanță/i).parentElement;
      expect(indicator).toHaveClass('bg-purple-100', 'text-purple-700');
    });

    it('should render ThirdParty type with correct styling', () => {
      render(<RecipientTypeIndicator recipientType="ThirdParty" />);

      expect(screen.getByText(/Terț/i)).toBeInTheDocument();
      const indicator = screen.getByText(/Terț/i).parentElement;
      expect(indicator).toHaveClass('bg-blue-100', 'text-blue-700');
    });

    it('should render Internal type with correct styling', () => {
      render(<RecipientTypeIndicator recipientType="Internal" />);

      expect(screen.getByText(/Intern/i)).toBeInTheDocument();
      const indicator = screen.getByText(/Intern/i).parentElement;
      expect(indicator).toHaveClass('bg-gray-100', 'text-gray-700');
    });
  });

  describe('Icons', () => {
    it('should display icon for each type', () => {
      const { rerender } = render(<RecipientTypeIndicator recipientType="Client" />);
      expect(screen.getByText(/Client/i).parentElement?.querySelector('svg')).toBeInTheDocument();

      rerender(<RecipientTypeIndicator recipientType="Court" />);
      expect(screen.getByText(/Instanță/i).parentElement?.querySelector('svg')).toBeInTheDocument();

      rerender(<RecipientTypeIndicator recipientType="OpposingCounsel" />);
      expect(
        screen.getByText(/Avocat Parte Adversă/i).parentElement?.querySelector('svg')
      ).toBeInTheDocument();
    });
  });

  describe('Size variants', () => {
    it('should render small variant correctly', () => {
      render(<RecipientTypeIndicator recipientType="Client" size="sm" />);

      const indicator = screen.getByText(/Client/i).parentElement;
      expect(indicator).toHaveClass('text-xs', 'px-2', 'py-0.5');
    });

    it('should render medium variant correctly', () => {
      render(<RecipientTypeIndicator recipientType="Client" size="md" />);

      const indicator = screen.getByText(/Client/i).parentElement;
      expect(indicator).toHaveClass('text-sm', 'px-2.5', 'py-1');
    });

    it('should render large variant correctly', () => {
      render(<RecipientTypeIndicator recipientType="Client" size="lg" />);

      const indicator = screen.getByText(/Client/i).parentElement;
      expect(indicator).toHaveClass('text-base', 'px-3', 'py-1.5');
    });

    it('should default to medium size', () => {
      render(<RecipientTypeIndicator recipientType="Client" />);

      const indicator = screen.getByText(/Client/i).parentElement;
      expect(indicator).toHaveClass('text-sm');
    });
  });

  describe('Label display', () => {
    it('should show label by default', () => {
      render(<RecipientTypeIndicator recipientType="Client" />);

      expect(screen.getByText(/Client/i)).toBeInTheDocument();
    });

    it('should hide label when showLabel is false', () => {
      render(<RecipientTypeIndicator recipientType="Client" showLabel={false} />);

      expect(screen.queryByText(/Client/i)).not.toBeInTheDocument();
    });

    it('should still show icon when label is hidden', () => {
      render(<RecipientTypeIndicator recipientType="Client" showLabel={false} />);

      const container = document.querySelector('span[title]');
      expect(container?.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Dark mode', () => {
    it('should have dark mode classes', () => {
      render(<RecipientTypeIndicator recipientType="Client" />);

      const indicator = screen.getByText(/Client/i).parentElement;
      expect(indicator).toHaveClass('dark:bg-green-900/30', 'dark:text-green-300');
    });
  });

  describe('Accessibility', () => {
    it('should have title attribute with full description', () => {
      render(<RecipientTypeIndicator recipientType="Court" />);

      const indicator = screen.getByText(/Instanță/i).parentElement;
      expect(indicator).toHaveAttribute('title');
    });
  });
});
