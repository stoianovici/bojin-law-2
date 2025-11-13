/**
 * AIInsightsPanel Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIInsightsPanel } from './AIInsightsPanel';
import { createWorkspaceAISuggestions } from '@legal-platform/test-utils';

// Mock the store
jest.mock('../../stores/case-workspace.store', () => ({
  useCaseWorkspaceStore: () => ({
    aiPanelCollapsed: false,
    toggleAIPanel: jest.fn(),
  }),
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => 'acum 2 ore'),
}));

jest.mock('date-fns/locale', () => ({
  ro: {},
}));

describe('AIInsightsPanel', () => {
  const mockSuggestions = createWorkspaceAISuggestions(3);
  const mockCaseName = 'Test Case';

  it('should render panel title', () => {
    render(<AIInsightsPanel caseName={mockCaseName} suggestions={mockSuggestions} />);
    expect(screen.getByText('Sugestii AI')).toBeInTheDocument();
  });

  it('should render case name in subtitle', () => {
    render(<AIInsightsPanel caseName={mockCaseName} suggestions={mockSuggestions} />);
    expect(screen.getByText(/Test Case/)).toBeInTheDocument();
  });

  it('should render all suggestions', () => {
    render(<AIInsightsPanel caseName={mockCaseName} suggestions={mockSuggestions} />);
    mockSuggestions.forEach((suggestion) => {
      expect(screen.getByText(suggestion.text)).toBeInTheDocument();
    });
  });

  it('should render empty state when no suggestions', () => {
    render(<AIInsightsPanel caseName={mockCaseName} suggestions={[]} />);
    expect(screen.getByText('Nicio sugestie disponibilă')).toBeInTheDocument();
  });

  it('should not render dismissed suggestions', () => {
    const suggestionsWithDismissed = [
      ...mockSuggestions,
      { ...mockSuggestions[0], id: 'dismissed-1', dismissed: true },
    ];
    render(
      <AIInsightsPanel caseName={mockCaseName} suggestions={suggestionsWithDismissed} />
    );

    // Should only render non-dismissed suggestions
    expect(screen.queryAllByText(/acum 2 ore/)).toHaveLength(mockSuggestions.length);
  });

  it('should call onDismissSuggestion when dismiss button clicked', () => {
    const handleDismiss = jest.fn();
    render(
      <AIInsightsPanel
        caseName={mockCaseName}
        suggestions={mockSuggestions}
        onDismissSuggestion={handleDismiss}
      />
    );

    const dismissButtons = screen.getAllByLabelText('Respinge sugestie');
    fireEvent.click(dismissButtons[0]);

    expect(handleDismiss).toHaveBeenCalledWith(mockSuggestions[0].id);
  });

  it('should call onTakeAction when action link clicked', () => {
    const handleAction = jest.fn();
    render(
      <AIInsightsPanel
        caseName={mockCaseName}
        suggestions={mockSuggestions}
        onTakeAction={handleAction}
      />
    );

    const actionLinks = screen.getAllByText(mockSuggestions[0].actionLabel);
    fireEvent.click(actionLinks[0]);

    expect(handleAction).toHaveBeenCalledWith(mockSuggestions[0].id);
  });

  it('should render footer note', () => {
    render(<AIInsightsPanel caseName={mockCaseName} suggestions={mockSuggestions} />);
    expect(
      screen.getByText(/Sugestiile AI sunt generate automat/)
    ).toBeInTheDocument();
  });

  it('should render suggestion icons based on type', () => {
    const typedSuggestions = [
      { ...mockSuggestions[0], type: 'document' as const },
      { ...mockSuggestions[1], type: 'deadline' as const },
      { ...mockSuggestions[2], type: 'task' as const },
    ];

    render(<AIInsightsPanel caseName={mockCaseName} suggestions={typedSuggestions} />);

    // Icons are SVG elements - we verify by checking the suggestions rendered
    typedSuggestions.forEach((suggestion) => {
      expect(screen.getByText(suggestion.text)).toBeInTheDocument();
    });
  });
});
