/**
 * CompletenessIndicator Component Tests
 * Story 5.4: Proactive AI Suggestions System - Task 38
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  CompletenessIndicator,
  CompletenessIndicatorInline,
  CompletenessStatusBadge,
} from './CompletenessIndicator';
import type { MissingItem } from '@legal-platform/types';

const mockMissingItems: MissingItem[] = [
  {
    item: 'Witness signatures',
    severity: 'recommended' as const,
    section: 'SIGNATURES',
    suggestion: 'Add witness signatures for additional legal protection.',
  },
  {
    item: 'Notarization clause',
    severity: 'optional' as const,
    section: 'CLAUSES',
    suggestion: 'Consider adding notarization for stronger validity.',
  },
  {
    item: 'Second party address',
    severity: 'required' as const,
    section: 'PARTIES',
    suggestion: 'Add complete address for the second party.',
  },
];

const mockSuggestions = ['Add dispute resolution mechanism.', 'Include force majeure clause.'];

describe('CompletenessIndicator', () => {
  describe('rendering', () => {
    it('should render completeness percentage', () => {
      render(<CompletenessIndicator completenessScore={0.75} missingItems={mockMissingItems} />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should render progress ring', () => {
      render(<CompletenessIndicator completenessScore={0.75} missingItems={mockMissingItems} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show correct aria-valuenow', () => {
      render(<CompletenessIndicator completenessScore={0.85} missingItems={[]} />);

      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '85');
    });
  });

  describe('color coding', () => {
    it('should show green for score >= 90%', () => {
      render(<CompletenessIndicator completenessScore={0.95} missingItems={[]} />);

      const label = screen.getByText(/complet/i);
      expect(label.className).toMatch(/green/i);
    });

    it('should show yellow for score 70-90%', () => {
      render(<CompletenessIndicator completenessScore={0.75} missingItems={mockMissingItems} />);

      const label = screen.getByText(/parțial/i);
      expect(label.className).toMatch(/yellow/i);
    });

    it('should show red for score < 70%', () => {
      render(<CompletenessIndicator completenessScore={0.45} missingItems={mockMissingItems} />);

      const label = screen.getByText(/incomplet/i);
      expect(label.className).toMatch(/red/i);
    });
  });

  describe('expandable details', () => {
    it('should expand to show missing items', async () => {
      render(
        <CompletenessIndicator
          completenessScore={0.75}
          missingItems={mockMissingItems}
          showDetails
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Witness signatures')).toBeInTheDocument();
        expect(screen.getByText('Second party address')).toBeInTheDocument();
      });
    });

    it('should show suggestions when expanded', async () => {
      render(
        <CompletenessIndicator
          completenessScore={0.75}
          missingItems={mockMissingItems}
          suggestions={mockSuggestions}
          showDetails
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText(/Add dispute resolution/i)).toBeInTheDocument();
      });
    });
  });

  describe('missing items count', () => {
    it('should show badge with count', () => {
      render(<CompletenessIndicator completenessScore={0.75} missingItems={mockMissingItems} />);

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should count required items separately', () => {
      render(<CompletenessIndicator completenessScore={0.75} missingItems={mockMissingItems} />);

      expect(screen.getByText(/1 element obligatoriu/i)).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('should render sm size', () => {
      render(<CompletenessIndicator completenessScore={0.75} missingItems={[]} size="sm" />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render lg size', () => {
      render(<CompletenessIndicator completenessScore={0.75} missingItems={[]} size="lg" />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper aria-label', () => {
      render(<CompletenessIndicator completenessScore={0.75} missingItems={mockMissingItems} />);

      expect(screen.getByLabelText(/completitudine document/i)).toBeInTheDocument();
    });

    it('should have aria-expanded state', async () => {
      render(
        <CompletenessIndicator
          completenessScore={0.75}
          missingItems={mockMissingItems}
          showDetails
        />
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
    });
  });

  describe('callbacks', () => {
    it('should call onItemCheck when item is checked', async () => {
      const mockOnItemCheck = jest.fn();

      render(
        <CompletenessIndicator
          completenessScore={0.75}
          missingItems={mockMissingItems}
          onItemCheck={mockOnItemCheck}
          showDetails
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);
        expect(mockOnItemCheck).toHaveBeenCalled();
      });
    });

    it('should call onItemNavigate when navigate is clicked', async () => {
      const mockOnNavigate = jest.fn();

      render(
        <CompletenessIndicator
          completenessScore={0.75}
          missingItems={mockMissingItems}
          onItemNavigate={mockOnNavigate}
          showDetails
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        const navigateButtons = screen.getAllByRole('button', { name: /navighează la secțiune/i });
        fireEvent.click(navigateButtons[0]);
        expect(mockOnNavigate).toHaveBeenCalled();
      });
    });
  });
});

describe('CompletenessIndicatorInline', () => {
  it('should render inline version', () => {
    render(<CompletenessIndicatorInline completenessScore={0.75} missingCount={3} />);

    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('should show label when showLabel is true', () => {
    render(<CompletenessIndicatorInline completenessScore={0.75} showLabel />);

    expect(screen.getByText(/parțial/i)).toBeInTheDocument();
  });
});

describe('CompletenessStatusBadge', () => {
  it('should render status badge', () => {
    render(<CompletenessStatusBadge completenessScore={0.95} />);

    expect(screen.getByText(/95% complet/i)).toBeInTheDocument();
  });

  it('should apply correct color for score', () => {
    render(<CompletenessStatusBadge completenessScore={0.45} />);

    const badge = screen.getByText(/45%/);
    expect(badge.className).toMatch(/red/i);
  });
});
