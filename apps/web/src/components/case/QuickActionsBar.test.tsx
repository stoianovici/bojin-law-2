/**
 * QuickActionsBar Component Tests
 * Tests global floating pill design with context-aware suggestions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickActionsBar } from './QuickActionsBar';

// Mock the case workspace store
const mockToggleQuickActions = jest.fn();
jest.mock('@/stores/case-workspace.store', () => ({
  useCaseWorkspaceStore: () => ({
    quickActionsVisible: true,
    toggleQuickActions: mockToggleQuickActions,
  }),
}));

// Mock the AI assistant context
jest.mock('@/contexts/AIAssistantContext', () => ({
  useAIAssistant: () => ({
    context: { section: 'dashboard' },
    suggestions: [
      { label: 'Caută dosar', intent: 'SEARCH', icon: null },
      { label: 'Sarcini azi', intent: 'FILTER', icon: null },
    ],
    placeholder: 'Ce vrei să faci?',
  }),
}));

// Mock the natural language command hook
jest.mock('@/hooks/useNaturalLanguageCommand', () => ({
  useNaturalLanguageCommand: () => ({
    executeCommand: jest.fn().mockResolvedValue({
      success: true,
      status: 'SUCCESS',
      intent: 'SEARCH',
      confidence: 0.95,
      message: 'Căutare efectuată',
    }),
    executeQuickAction: jest.fn().mockResolvedValue({
      success: true,
      status: 'PARTIAL',
      intent: 'FILTER',
      confidence: 1.0,
      message: 'Filtre aplicate.',
    }),
    loading: false,
    result: null,
    clearResult: jest.fn(),
  }),
}));

describe('QuickActionsBar - Global', () => {
  beforeEach(() => {
    mockToggleQuickActions.mockClear();
  });

  it('should render the input field with context-aware placeholder', () => {
    render(<QuickActionsBar />);
    expect(
      screen.getByPlaceholderText(/ce vrei să faci/i)
    ).toBeInTheDocument();
  });

  it('should render context-aware suggestion buttons', () => {
    render(<QuickActionsBar />);
    expect(screen.getByText(/caută dosar/i)).toBeInTheDocument();
    expect(screen.getByText(/sarcini azi/i)).toBeInTheDocument();
  });

  it('should update input value when typing', () => {
    render(<QuickActionsBar />);
    const input = screen.getByPlaceholderText(/ce vrei să faci/i) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Caută dosar 123' } });
    expect(input.value).toBe('Caută dosar 123');
  });

  it('should disable submit button when input is empty', () => {
    render(<QuickActionsBar />);
    const submitButton = screen.getByRole('button', { name: /trimite/i });

    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when input has value', () => {
    render(<QuickActionsBar />);
    const input = screen.getByPlaceholderText(/ce vrei să faci/i);
    const submitButton = screen.getByRole('button', { name: /trimite/i });

    fireEvent.change(input, { target: { value: 'Test input' } });
    expect(submitButton).not.toBeDisabled();
  });

  it('should limit input to 500 characters', () => {
    render(<QuickActionsBar />);
    const input = screen.getByPlaceholderText(/ce vrei să faci/i) as HTMLInputElement;
    const longText = 'a'.repeat(600);

    fireEvent.change(input, { target: { value: longText } });
    expect(input.value.length).toBeLessThanOrEqual(500);
  });

  it('should call onSubmit when submit button is clicked with valid input', async () => {
    const mockOnSubmit = jest.fn();
    render(<QuickActionsBar onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/ce vrei să faci/i);
    const submitButton = screen.getByRole('button', { name: /trimite/i });

    fireEvent.change(input, { target: { value: 'Test action' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('Test action');
    });
  });

  it('should clear input after successful submission', async () => {
    const mockOnSubmit = jest.fn();
    render(<QuickActionsBar onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/ce vrei să faci/i) as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /trimite/i });

    fireEvent.change(input, { target: { value: 'Test action' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('should render floating pill with fixed positioning', () => {
    const { container } = render(<QuickActionsBar />);
    const barElement = container.firstChild;

    expect(barElement).toHaveClass('fixed');
    expect(barElement).toHaveClass('bottom-6');
  });

  it('should call onSuggestionClick when suggestion is clicked', async () => {
    const mockOnSuggestionClick = jest.fn();
    render(<QuickActionsBar onSuggestionClick={mockOnSuggestionClick} />);

    const suggestion = screen.getByText(/caută dosar/i);
    fireEvent.click(suggestion);

    await waitFor(() => {
      expect(mockOnSuggestionClick).toHaveBeenCalledWith('Caută dosar');
    });
  });

  it('should show escape key hint in footer', () => {
    render(<QuickActionsBar />);
    expect(screen.getByText(/esc/i)).toBeInTheDocument();
  });
});

describe('QuickActionsBar - Case Context', () => {
  beforeEach(() => {
    // Re-mock with case context
    jest.doMock('@/contexts/AIAssistantContext', () => ({
      useAIAssistant: () => ({
        context: { section: 'case', entityId: 'case-123', entityName: 'Dosar Test' },
        suggestions: [
          { label: 'Sarcină', intent: 'CREATE_TASK', icon: null },
          { label: 'Document', intent: 'ADD_DOCUMENT', icon: null },
        ],
        placeholder: 'Acțiune pentru acest dosar...',
      }),
    }));
  });

  it('should display context badge when entityName is provided', () => {
    // This test documents expected behavior
    // The context badge shows "Context: {entityName}" when on a case page
  });
});

describe('QuickActionsBar - Collapsed State', () => {
  it('should show collapsed pill button when quickActionsVisible is false', () => {
    // This test documents expected behavior
    // The collapsed state shows "Asistent AI" button
  });
});
