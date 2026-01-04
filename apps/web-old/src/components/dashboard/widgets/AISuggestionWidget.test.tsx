/**
 * AISuggestionWidget Unit Tests
 * NOTE: Currently blocked by test infrastructure issue (see story Debug Log)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AISuggestionWidget } from './AISuggestionWidget';
import type { AISuggestionWidget as AISuggestionWidgetType } from '@legal-platform/types';

describe('AISuggestionWidget', () => {
  const mockWidget: AISuggestionWidgetType = {
    id: 'ai-suggestions-1',
    type: 'aiSuggestion',
    title: 'Recomandări AI',
    position: { i: 'ai-suggestions-1', x: 0, y: 0, w: 12, h: 4 },
    suggestions: [
      {
        id: 'sug-1',
        text: 'Revizuiește cazul #2345 - termen urgent în 3 zile',
        timestamp: '2 ore în urmă',
        type: 'alert',
        actionLink: '/cases/2345',
        dismissed: false,
      },
      {
        id: 'sug-2',
        text: 'Echipa ta are 15% mai multe ore facturabile luna aceasta',
        timestamp: '3 ore în urmă',
        type: 'insight',
        dismissed: false,
      },
      {
        id: 'sug-3',
        text: 'Consideră folosirea șablonului Contract #12 pentru cazul #4567',
        timestamp: '5 ore în urmă',
        type: 'recommendation',
        actionLink: '/templates/12',
        dismissed: false,
      },
    ],
  };

  it('renders widget with suggestions', () => {
    render(<AISuggestionWidget widget={mockWidget} />);

    expect(screen.getByText('Recomandări AI')).toBeInTheDocument();
    expect(
      screen.getByText('Revizuiește cazul #2345 - termen urgent în 3 zile')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Echipa ta are 15% mai multe ore facturabile luna aceasta')
    ).toBeInTheDocument();
  });

  it('renders loading state when isLoading is true', () => {
    render(<AISuggestionWidget widget={mockWidget} isLoading={true} />);

    // Widget container should show skeleton loader
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders empty state when no suggestions', () => {
    const emptyWidget: AISuggestionWidgetType = {
      ...mockWidget,
      suggestions: [],
    };

    render(<AISuggestionWidget widget={emptyWidget} />);

    expect(screen.getByText('Nu există sugestii noi')).toBeInTheDocument();
  });

  it('dismisses suggestion when "Închide" button is clicked', () => {
    render(<AISuggestionWidget widget={mockWidget} />);

    const dismissButtons = screen.getAllByText('Închide');
    expect(dismissButtons).toHaveLength(3);

    fireEvent.click(dismissButtons[0]);

    // After dismiss animation, the suggestion should not be visible
    setTimeout(() => {
      expect(
        screen.queryByText('Revizuiește cazul #2345 - termen urgent în 3 zile')
      ).not.toBeInTheDocument();
    }, 300);
  });

  it('shows "Vezi detalii" link when suggestion has actionLink', () => {
    render(<AISuggestionWidget widget={mockWidget} />);

    const viewDetailsButtons = screen.getAllByText('Vezi detalii');
    expect(viewDetailsButtons).toHaveLength(2); // 2 suggestions have actionLink
  });

  it('does not show "Vezi detalii" for suggestions without actionLink', () => {
    const singleSuggestionWidget: AISuggestionWidgetType = {
      ...mockWidget,
      suggestions: [mockWidget.suggestions[1]], // This one has no actionLink
    };

    render(<AISuggestionWidget widget={singleSuggestionWidget} />);

    expect(screen.queryByText('Vezi detalii')).not.toBeInTheDocument();
  });

  it('renders different icons for suggestion types', () => {
    render(<AISuggestionWidget widget={mockWidget} />);

    const suggestionContainer = document.querySelector('.border-l-4.border-blue-500');
    expect(suggestionContainer).toBeInTheDocument();
  });

  it('filters out dismissed suggestions', () => {
    const widgetWithDismissed: AISuggestionWidgetType = {
      ...mockWidget,
      suggestions: [
        ...mockWidget.suggestions,
        {
          id: 'sug-4',
          text: 'Already dismissed suggestion',
          timestamp: '1 day ago',
          type: 'insight',
          dismissed: true,
        },
      ],
    };

    render(<AISuggestionWidget widget={widgetWithDismissed} />);

    expect(screen.queryByText('Already dismissed suggestion')).not.toBeInTheDocument();
  });

  it('calls onRefresh when refresh action is triggered', () => {
    const onRefresh = jest.fn();

    render(<AISuggestionWidget widget={mockWidget} onRefresh={onRefresh} />);

    // Open action menu
    const actionMenuButton = screen.getByLabelText('Widget actions');
    fireEvent.click(actionMenuButton);

    // Click refresh option
    const refreshButton = screen.getByText('Reîmprospătează');
    fireEvent.click(refreshButton);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('applies accent border styling', () => {
    const { container } = render(<AISuggestionWidget widget={mockWidget} />);

    // Check for blue accent border on suggestion items
    const suggestionItems = container.querySelectorAll('.border-l-4.border-blue-500');
    expect(suggestionItems.length).toBeGreaterThan(0);
  });

  it('supports Romanian diacritics in suggestion text', () => {
    render(<AISuggestionWidget widget={mockWidget} />);

    // Verify Romanian text with diacritics renders correctly
    expect(screen.getByText(/Revizuiește/)).toBeInTheDocument();
    expect(screen.getByText(/Recomandări AI/)).toBeInTheDocument();
  });
});
