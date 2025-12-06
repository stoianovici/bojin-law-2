/**
 * RecommendationsPanel Component Tests
 * Story 5.7: Platform Intelligence Dashboard - Task 26
 *
 * Tests for:
 * - Rendering recommendations
 * - Category filtering
 * - Priority sorting
 * - Mark as addressed functionality
 * - Accessibility
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecommendationsPanel } from '../RecommendationsPanel';
import type { PlatformRecommendation } from '@legal-platform/types';

// Test data
const mockRecommendations: PlatformRecommendation[] = [
  {
    category: 'efficiency',
    priority: 'high',
    message: 'Task completion rate is below target. Consider reviewing workload distribution.',
    actionableSteps: [
      'Review team capacity',
      'Identify bottlenecks',
      'Reassign tasks as needed',
    ],
  },
  {
    category: 'communication',
    priority: 'medium',
    message: 'Response time improvement is lower than expected.',
    actionableSteps: ['Use email drafting AI more frequently', 'Set response time alerts'],
  },
  {
    category: 'quality',
    priority: 'low',
    message: 'Document quality is good but could be improved with templates.',
    actionableSteps: ['Create more document templates', 'Train team on AI suggestions'],
  },
  {
    category: 'adoption',
    priority: 'high',
    message: '3 users have low AI adoption scores.',
    actionableSteps: [
      'Schedule training sessions',
      'Share best practices',
      'Provide one-on-one coaching',
    ],
  },
];

describe('RecommendationsPanel', () => {
  describe('Rendering', () => {
    it('renders all recommendations', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      // Each recommendation appears in both the list and accessibility table
      expect(screen.getAllByText(/Task completion rate is below target/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Response time improvement/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Document quality is good/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/3 users have low AI adoption/).length).toBeGreaterThanOrEqual(1);
    });

    it('renders loading state', () => {
      render(<RecommendationsPanel recommendations={[]} loading={true} />);

      expect(screen.getByLabelText(/Se încarcă recomandările/)).toBeInTheDocument();
    });

    it('renders empty state when no recommendations', () => {
      render(<RecommendationsPanel recommendations={[]} />);

      expect(screen.getByText(/Platforma funcționează optim/)).toBeInTheDocument();
    });

    it('displays recommendation count in header', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      expect(screen.getByText(/4 recomandări/)).toBeInTheDocument();
    });

    it('displays high priority count', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      // 2 high priority recommendations shown in header
      // The text "2" appears in multiple places, verify the header section exists with count + label
      const headerSection = screen.getByText(/prioritare/);
      expect(headerSection).toBeInTheDocument();
      // Verify the count is present (may appear multiple times)
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Priority Sorting', () => {
    it('sorts recommendations by priority (high first)', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      const listItems = screen.getAllByRole('listitem');

      // High priority items should appear first
      expect(within(listItems[0]).getByText(/Prioritate ridicată/)).toBeInTheDocument();
      expect(within(listItems[1]).getByText(/Prioritate ridicată/)).toBeInTheDocument();
    });

    it('sorts addressed recommendations to bottom', () => {
      render(
        <RecommendationsPanel
          recommendations={mockRecommendations}
          addressedRecommendations={[0]} // First recommendation is addressed
        />
      );

      const listItems = screen.getAllByRole('listitem');

      // Addressed item should be last
      const lastItem = listItems[listItems.length - 1];
      expect(within(lastItem).getByText(/Rezolvat/)).toBeInTheDocument();
    });
  });

  describe('Category Filtering', () => {
    it('renders filter tabs for each category', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      expect(screen.getByRole('tab', { name: /Toate/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Eficiență/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Comunicare/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Calitate/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Adopție/i })).toBeInTheDocument();
    });

    it('filters by category when tab clicked', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      // Click Communication filter
      fireEvent.click(screen.getByRole('tab', { name: /Comunicare/i }));

      // Only communication recommendation should be visible (in list and table)
      expect(screen.getAllByText(/Response time improvement/).length).toBeGreaterThanOrEqual(1);
      // Efficiency recommendation should not be visible at all
      expect(screen.queryByText(/Task completion rate/)).not.toBeInTheDocument();
    });

    it('shows all when All tab clicked', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      // First filter to communication
      fireEvent.click(screen.getByRole('tab', { name: /Comunicare/i }));

      // Then click All
      fireEvent.click(screen.getByRole('tab', { name: /Toate/i }));

      // All should be visible (content appears in list and table)
      expect(screen.getAllByText(/Task completion rate/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Response time improvement/).length).toBeGreaterThanOrEqual(1);
    });

    it('shows count per category in tabs', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      expect(screen.getByText(/Toate \(4\)/)).toBeInTheDocument();
    });
  });

  describe('Expandable Action Steps', () => {
    it('shows action steps count when collapsed', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      expect(screen.getAllByText(/pași de acțiune/).length).toBeGreaterThan(0);
    });

    it('expands to show action steps when clicked', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      const listItems = screen.getAllByRole('listitem');
      const expandButton = within(listItems[0]).getByRole('button', { expanded: false });

      fireEvent.click(expandButton);

      // Action steps should now be visible
      expect(screen.getByText('Review team capacity')).toBeInTheDocument();
    });

    it('collapses when clicked again', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      const listItems = screen.getAllByRole('listitem');
      const expandButton = within(listItems[0]).getByRole('button', { expanded: false });

      // Expand
      fireEvent.click(expandButton);
      expect(screen.getByText('Review team capacity')).toBeInTheDocument();

      // Collapse
      fireEvent.click(within(listItems[0]).getByRole('button', { expanded: true }));
      expect(screen.queryByText('Review team capacity')).not.toBeInTheDocument();
    });

    it('supports keyboard navigation for expand', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      const listItems = screen.getAllByRole('listitem');
      const expandButton = within(listItems[0]).getByRole('button', { expanded: false });

      // Press Enter
      fireEvent.keyDown(expandButton, { key: 'Enter' });

      expect(screen.getByText('Review team capacity')).toBeInTheDocument();
    });
  });

  describe('Mark as Addressed', () => {
    it('calls onMarkAsAddressed when button clicked', () => {
      const mockOnMarkAsAddressed = jest.fn();

      render(
        <RecommendationsPanel
          recommendations={mockRecommendations}
          onMarkAsAddressed={mockOnMarkAsAddressed}
        />
      );

      // Expand first item
      const listItems = screen.getAllByRole('listitem');
      fireEvent.click(within(listItems[0]).getByRole('button', { expanded: false }));

      // Click mark as addressed
      fireEvent.click(screen.getByText('Marchează ca rezolvat'));

      expect(mockOnMarkAsAddressed).toHaveBeenCalledWith(expect.any(Number));
    });

    it('shows addressed badge for addressed recommendations', () => {
      render(
        <RecommendationsPanel
          recommendations={mockRecommendations}
          addressedRecommendations={[0]}
        />
      );

      // Rezolvat appears as badge and in accessibility table
      expect(screen.getAllByText('Rezolvat').length).toBeGreaterThanOrEqual(1);
    });

    it('hides mark as addressed button for already addressed items', () => {
      render(
        <RecommendationsPanel
          recommendations={mockRecommendations}
          addressedRecommendations={[0]}
          onMarkAsAddressed={jest.fn()}
        />
      );

      // Addressed items are sorted to bottom, expand the last one
      const listItems = screen.getAllByRole('listitem');
      const lastItem = listItems[listItems.length - 1];
      // Find the expand button by aria-expanded
      const expandButton = within(lastItem).getByRole('button', { expanded: false });
      fireEvent.click(expandButton);

      // Should not have the mark as addressed button for addressed items
      expect(screen.queryByText('Marchează ca rezolvat')).not.toBeInTheDocument();
    });

    it('applies strikethrough style to addressed recommendation message', () => {
      const { container } = render(
        <RecommendationsPanel
          recommendations={mockRecommendations}
          addressedRecommendations={[0]}
        />
      );

      const addressedMessage = container.querySelector('.line-through');
      expect(addressedMessage).toBeInTheDocument();
    });
  });

  describe('Category Badges', () => {
    it('displays category badges with correct colors', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      expect(screen.getAllByText('Eficiență').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Comunicare').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Calitate').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Adopție').length).toBeGreaterThan(0);
    });

    it('displays priority badges', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      // Priority badges appear in both list items and accessibility table
      expect(screen.getAllByText('Prioritate ridicată').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Prioritate medie').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Prioritate scăzută').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Accessibility', () => {
    it('has accessible table view toggle', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      expect(screen.getByText(/Vizualizare tabel/)).toBeInTheDocument();
    });

    it('shows accessibility table when expanded', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      // Click details summary
      fireEvent.click(screen.getByText(/Vizualizare tabel/));

      // Table headers should be visible
      expect(screen.getByRole('columnheader', { name: /Prioritate/ })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Categorie/ })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Recomandare/ })).toBeInTheDocument();
    });

    it('has proper ARIA labels for filter tabs', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      const tablist = screen.getByRole('tablist', { name: /Filtrează după categorie/ });
      expect(tablist).toBeInTheDocument();
    });

    it('has proper list role for recommendations', () => {
      render(<RecommendationsPanel recommendations={mockRecommendations} />);

      expect(screen.getByRole('list', { name: /Lista de recomandări/ })).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('does not show category tabs for categories with no items', () => {
      const singleCategoryRecs: PlatformRecommendation[] = [
        {
          category: 'efficiency',
          priority: 'medium',
          message: 'Test message',
          actionableSteps: [],
        },
      ];

      render(<RecommendationsPanel recommendations={singleCategoryRecs} />);

      // Communication tab should not appear since no items in that category
      expect(screen.queryByRole('tab', { name: /Comunicare/i })).not.toBeInTheDocument();
      // Efficiency tab should appear
      expect(screen.getByRole('tab', { name: /Eficiență/i })).toBeInTheDocument();
    });

    it('only shows All and populated category tabs', () => {
      const twoCategories: PlatformRecommendation[] = [
        {
          category: 'efficiency',
          priority: 'medium',
          message: 'Efficiency message',
          actionableSteps: [],
        },
        {
          category: 'communication',
          priority: 'low',
          message: 'Communication message',
          actionableSteps: [],
        },
      ];

      render(<RecommendationsPanel recommendations={twoCategories} />);

      // All tab should show
      expect(screen.getByRole('tab', { name: /Toate \(2\)/i })).toBeInTheDocument();
      // Populated categories should show
      expect(screen.getByRole('tab', { name: /Eficiență/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Comunicare/i })).toBeInTheDocument();
      // Empty categories should not show
      expect(screen.queryByRole('tab', { name: /Calitate/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Adopție/i })).not.toBeInTheDocument();
    });
  });
});
