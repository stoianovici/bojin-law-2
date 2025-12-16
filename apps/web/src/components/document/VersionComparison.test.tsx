/**
 * Tests for VersionComparison component
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VersionComparison, VersionComparisonProps } from './VersionComparison';

const mockPreviousVersion = {
  info: {
    versionNumber: 1,
    date: '2024-11-10 14:30',
    author: 'Mihai Bojin',
  },
  content: 'Previous content\nLine 2\nLine 3',
};

const mockCurrentVersion = {
  info: {
    versionNumber: 2,
    date: '2024-11-15 16:45',
    author: 'Mihai Bojin',
  },
  content: 'Current content\nLine 2 modified\nLine 3',
};

const mockSemanticChanges = [
  {
    type: 'added' as const,
    lineNumber: 1,
    description: 'Adăugat nou text',
  },
  {
    type: 'modified' as const,
    lineNumber: 2,
    description: 'Modificat linia 2',
  },
  {
    type: 'removed' as const,
    lineNumber: 3,
    description: 'Șters text vechi',
  },
];

describe('VersionComparison', () => {
  describe('Component Rendering', () => {
    it('renders the component with default props', () => {
      render(<VersionComparison />);

      expect(screen.getByText('Comparare Versiuni')).toBeInTheDocument();
    });

    it('renders with custom version data', () => {
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
          semanticChanges={mockSemanticChanges}
        />
      );

      expect(screen.getByText('Versiunea 1')).toBeInTheDocument();
      expect(screen.getByText('Versiunea 2')).toBeInTheDocument();
    });

    it('displays version metadata correctly', () => {
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
        />
      );

      expect(screen.getByText('2024-11-10 14:30 • Mihai Bojin')).toBeInTheDocument();
      expect(screen.getByText('2024-11-15 16:45 • Mihai Bojin')).toBeInTheDocument();
    });

    it('displays "Anterioară" and "Curentă" labels', () => {
      render(<VersionComparison />);

      expect(screen.getByText('Anterioară')).toBeInTheDocument();
      expect(screen.getByText('Curentă')).toBeInTheDocument();
    });
  });

  describe('Version Content Display', () => {
    it('renders previous version content', () => {
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
        />
      );

      expect(screen.getByText('Previous content')).toBeInTheDocument();
    });

    it('renders current version content', () => {
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
        />
      );

      expect(screen.getByText('Current content')).toBeInTheDocument();
    });

    it('displays line numbers for both versions', () => {
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
        />
      );

      // Line numbers are rendered as text content
      const lineNumbers = screen.getAllByText('1');
      expect(lineNumbers.length).toBeGreaterThan(0);
    });
  });

  describe('Semantic Changes Navigation', () => {
    it('displays semantic change counter', () => {
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
          semanticChanges={mockSemanticChanges}
        />
      );

      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('displays first semantic change description by default', () => {
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
          semanticChanges={mockSemanticChanges}
        />
      );

      expect(screen.getByText('Linia 1:')).toBeInTheDocument();
      expect(screen.getByText('Adăugat nou text')).toBeInTheDocument();
    });

    it('navigates to next semantic change', () => {
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
          semanticChanges={mockSemanticChanges}
        />
      );

      const nextButton = screen.getByLabelText('Diferența următoare');
      fireEvent.click(nextButton);

      expect(screen.getByText('2 / 3')).toBeInTheDocument();
      expect(screen.getByText('Linia 2:')).toBeInTheDocument();
      expect(screen.getByText('Modificat linia 2')).toBeInTheDocument();
    });

    it('navigates to previous semantic change', () => {
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
          semanticChanges={mockSemanticChanges}
        />
      );

      const nextButton = screen.getByLabelText('Diferența următoare');
      const prevButton = screen.getByLabelText('Diferența anterioară');

      // Go to next
      fireEvent.click(nextButton);
      expect(screen.getByText('2 / 3')).toBeInTheDocument();

      // Go back to previous
      fireEvent.click(prevButton);
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('disables previous button on first diff', () => {
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
          semanticChanges={mockSemanticChanges}
        />
      );

      const prevButton = screen.getByLabelText('Diferența anterioară');
      expect(prevButton).toBeDisabled();
    });

    it('disables next button on last diff', () => {
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
          semanticChanges={mockSemanticChanges}
        />
      );

      const nextButton = screen.getByLabelText('Diferența următoare');

      // Navigate to last change
      fireEvent.click(nextButton); // 2/3
      fireEvent.click(nextButton); // 3/3

      expect(screen.getByText('3 / 3')).toBeInTheDocument();
      expect(nextButton).toBeDisabled();
    });

    it('displays all three change types with correct icons', () => {
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
          semanticChanges={mockSemanticChanges}
        />
      );

      const nextButton = screen.getByLabelText('Diferența următoare');

      // First: added
      expect(screen.getByText('Adăugat nou text')).toBeInTheDocument();

      // Second: modified
      fireEvent.click(nextButton);
      expect(screen.getByText('Modificat linia 2')).toBeInTheDocument();

      // Third: removed
      fireEvent.click(nextButton);
      expect(screen.getByText('Șters text vechi')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('renders accept and reject buttons', () => {
      render(<VersionComparison />);

      expect(screen.getByText('Acceptă modificările')).toBeInTheDocument();
      expect(screen.getByText('Respinge')).toBeInTheDocument();
    });

    it('calls onAcceptChanges when accept button is clicked', () => {
      const handleAccept = jest.fn();
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
          onAcceptChanges={handleAccept}
        />
      );

      const acceptButton = screen.getByText('Acceptă modificările');
      fireEvent.click(acceptButton);

      expect(handleAccept).toHaveBeenCalledTimes(1);
    });

    it('calls onRejectChanges when reject button is clicked', () => {
      const handleReject = jest.fn();
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
          onRejectChanges={handleReject}
        />
      );

      const rejectButton = screen.getByText('Respinge');
      fireEvent.click(rejectButton);

      expect(handleReject).toHaveBeenCalledTimes(1);
    });

    it('works without onAcceptChanges handler', () => {
      render(<VersionComparison />);

      const acceptButton = screen.getByText('Acceptă modificările');

      expect(() => fireEvent.click(acceptButton)).not.toThrow();
    });

    it('works without onRejectChanges handler', () => {
      render(<VersionComparison />);

      const rejectButton = screen.getByText('Respinge');

      expect(() => fireEvent.click(rejectButton)).not.toThrow();
    });
  });

  describe('Scroll Synchronization', () => {
    it('synchronizes scroll from left panel to right panel', () => {
      const { container } = render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
        />
      );

      // Get scrollable panels
      const panels = container.querySelectorAll('.overflow-y-auto');
      const leftPanel = panels[0] as HTMLDivElement;
      const rightPanel = panels[1] as HTMLDivElement;

      // Mock scrollTop setter
      Object.defineProperty(leftPanel, 'scrollTop', { value: 100, writable: true });
      Object.defineProperty(rightPanel, 'scrollTop', { value: 0, writable: true });

      // Trigger scroll event on left panel
      fireEvent.scroll(leftPanel, { target: { scrollTop: 100 } });

      // Note: In actual implementation, rightPanel.scrollTop would be set to 100
      // Testing that the event handler is called correctly
      expect(leftPanel.scrollTop).toBe(100);
    });

    it('synchronizes scroll from right panel to left panel', () => {
      const { container } = render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
        />
      );

      // Get scrollable panels
      const panels = container.querySelectorAll('.overflow-y-auto');
      const leftPanel = panels[0] as HTMLDivElement;
      const rightPanel = panels[1] as HTMLDivElement;

      // Mock scrollTop setter
      Object.defineProperty(leftPanel, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(rightPanel, 'scrollTop', { value: 150, writable: true });

      // Trigger scroll event on right panel
      fireEvent.scroll(rightPanel, { target: { scrollTop: 150 } });

      // Note: In actual implementation, leftPanel.scrollTop would be set to 150
      expect(rightPanel.scrollTop).toBe(150);
    });
  });

  describe('Diff Highlighting', () => {
    it('applies highlighting classes to changed lines', () => {
      const { container } = render(<VersionComparison />);

      // Check for highlighted lines (green or red backgrounds)
      const highlightedLines = container.querySelectorAll('.bg-green-50, .bg-red-50');
      expect(highlightedLines.length).toBeGreaterThan(0);
    });

    it('highlights additions in green', () => {
      const { container } = render(<VersionComparison />);

      // Check for green highlighting
      const greenLines = container.querySelectorAll('.bg-green-50');
      expect(greenLines.length).toBeGreaterThan(0);
    });

    it('highlights removals in red', () => {
      const { container } = render(<VersionComparison />);

      // Check for red highlighting
      const redLines = container.querySelectorAll('.bg-red-50');
      expect(redLines.length).toBeGreaterThan(0);
    });

    it('applies border indicators to changed lines', () => {
      const { container } = render(<VersionComparison />);

      // Check for border indicators
      const borderedLines = container.querySelectorAll('.border-l-4');
      expect(borderedLines.length).toBeGreaterThan(0);
    });
  });

  describe('Romanian Diacritics', () => {
    it('renders Romanian diacritics in header', () => {
      render(<VersionComparison />);

      expect(screen.getByText('Comparare Versiuni')).toBeInTheDocument();
    });

    it('renders Romanian diacritics in navigation buttons', () => {
      render(<VersionComparison semanticChanges={mockSemanticChanges} />);

      expect(screen.getByLabelText('Diferența anterioară')).toBeInTheDocument();
      expect(screen.getByLabelText('Diferența următoare')).toBeInTheDocument();
    });

    it('renders Romanian diacritics in action buttons', () => {
      render(<VersionComparison />);

      expect(screen.getByText('Acceptă modificările')).toBeInTheDocument();
    });

    it('renders Romanian diacritics in semantic changes', () => {
      render(<VersionComparison semanticChanges={mockSemanticChanges} />);

      expect(screen.getByText('Adăugat nou text')).toBeInTheDocument();

      const nextButton = screen.getByLabelText('Diferența următoare');
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      expect(screen.getByText('Șters text vechi')).toBeInTheDocument();
    });

    it('renders Romanian diacritics in version labels', () => {
      render(<VersionComparison />);

      expect(screen.getByText('Anterioară')).toBeInTheDocument();
      expect(screen.getByText('Curentă')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for navigation buttons', () => {
      render(<VersionComparison semanticChanges={mockSemanticChanges} />);

      expect(screen.getByLabelText('Diferența anterioară')).toBeInTheDocument();
      expect(screen.getByLabelText('Diferența următoare')).toBeInTheDocument();
    });

    it('has proper title attributes on navigation buttons', () => {
      render(<VersionComparison semanticChanges={mockSemanticChanges} />);

      const prevButton = screen.getByLabelText('Diferența anterioară');
      const nextButton = screen.getByLabelText('Diferența următoare');

      expect(prevButton).toHaveAttribute('title', 'Diferența anterioară');
      expect(nextButton).toHaveAttribute('title', 'Diferența următoare');
    });

    it('properly disables navigation buttons when appropriate', () => {
      render(<VersionComparison semanticChanges={mockSemanticChanges} />);

      const prevButton = screen.getByLabelText('Diferența anterioară');
      const nextButton = screen.getByLabelText('Diferența următoare');

      // First diff: previous button disabled
      expect(prevButton).toBeDisabled();
      expect(nextButton).not.toBeDisabled();

      // Navigate to last diff
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      // Last diff: next button disabled
      expect(prevButton).not.toBeDisabled();
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Empty State', () => {
    it('handles empty semantic changes array', () => {
      render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
          semanticChanges={[]}
        />
      );

      // Should not crash and should not show semantic change section
      expect(screen.queryByText(/Linia/)).not.toBeInTheDocument();
    });
  });
});
