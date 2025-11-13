/**
 * QuickActionsBar Component Tests
 * Tests input validation and suggestion interactions
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickActionsBar } from './QuickActionsBar';

// Mock the case workspace store
jest.mock('@/stores/case-workspace.store', () => ({
  useCaseWorkspaceStore: () => ({
    quickActionsVisible: true,
    toggleQuickActions: jest.fn(),
  }),
}));

describe('QuickActionsBar', () => {
  it('should render the input field with placeholder', () => {
    render(<QuickActionsBar />);
    expect(
      screen.getByPlaceholderText(/ce doriți să faceți/i)
    ).toBeInTheDocument();
  });

  it('should render suggestion examples when input is empty', () => {
    render(<QuickActionsBar />);
    expect(screen.getByText(/adaugă document/i)).toBeInTheDocument();
    expect(screen.getByText(/creează sarcină/i)).toBeInTheDocument();
    expect(screen.getByText(/programează termen/i)).toBeInTheDocument();
  });

  it('should update input value when typing', () => {
    render(<QuickActionsBar />);
    const input = screen.getByPlaceholderText(/ce doriți să faceți/i) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Create a new task' } });
    expect(input.value).toBe('Create a new task');
  });

  it('should show character count when input has value', () => {
    render(<QuickActionsBar />);
    const input = screen.getByPlaceholderText(/ce doriți să faceți/i);

    fireEvent.change(input, { target: { value: 'Test input' } });
    expect(screen.getByText(/10\/500/)).toBeInTheDocument();
  });

  it('should disable submit button when input is empty', () => {
    render(<QuickActionsBar />);
    const submitButton = screen.getByRole('button', { name: /trimite/i });

    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when input has value', () => {
    render(<QuickActionsBar />);
    const input = screen.getByPlaceholderText(/ce doriți să faceți/i);
    const submitButton = screen.getByRole('button', { name: /trimite/i });

    fireEvent.change(input, { target: { value: 'Test input' } });
    expect(submitButton).not.toBeDisabled();
  });

  it('should populate input when suggestion is clicked', () => {
    render(<QuickActionsBar />);
    const suggestion = screen.getByText(/adaugă document/i);
    const input = screen.getByPlaceholderText(/ce doriți să faceți/i) as HTMLInputElement;

    fireEvent.click(suggestion);
    expect(input.value).toContain('document');
  });

  it('should limit input to 500 characters', () => {
    render(<QuickActionsBar />);
    const input = screen.getByPlaceholderText(/ce doriți să faceți/i) as HTMLInputElement;
    const longText = 'a'.repeat(600);

    fireEvent.change(input, { target: { value: longText } });
    expect(input.value.length).toBeLessThanOrEqual(500);
  });

  it('should display note banner about visual prototype', () => {
    render(<QuickActionsBar />);
    expect(
      screen.getByText(/prototip vizual/i)
    ).toBeInTheDocument();
  });

  it('should call onSubmit when submit button is clicked with valid input', () => {
    const mockOnSubmit = jest.fn();
    render(<QuickActionsBar onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/ce doriți să faceți/i);
    const submitButton = screen.getByRole('button', { name: /trimite/i });

    fireEvent.change(input, { target: { value: 'Test action' } });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith('Test action');
  });

  it('should clear input after successful submission', () => {
    const mockOnSubmit = jest.fn();
    render(<QuickActionsBar onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/ce doriți să faceți/i) as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /trimite/i });

    fireEvent.change(input, { target: { value: 'Test action' } });
    fireEvent.click(submitButton);

    expect(input.value).toBe('');
  });

  it('should not show suggestions when input has value', () => {
    render(<QuickActionsBar />);
    const input = screen.getByPlaceholderText(/ce doriți să faceți/i);

    // Initially suggestions should be visible
    expect(screen.getByText(/adaugă document/i)).toBeVisible();

    // After typing, suggestions should be hidden
    fireEvent.change(input, { target: { value: 'Test' } });
    expect(screen.queryByText(/adaugă document/i)).not.toBeInTheDocument();
  });

  it('should render with proper positioning (fixed bottom)', () => {
    const { container } = render(<QuickActionsBar />);
    const barElement = container.firstChild;

    expect(barElement).toHaveClass('fixed');
    expect(barElement).toHaveClass('bottom-0');
  });
});
