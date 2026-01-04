/**
 * Unit Tests for CaseSearchBar Component
 * Story 2.8: Case CRUD Operations UI - Task 19
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CaseSearchBar } from './CaseSearchBar';
import { useCaseSearch } from '../../hooks/useCaseSearch';
import { useRouter } from 'next/navigation';

// Mock hooks
jest.mock('../../hooks/useCaseSearch');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('CaseSearchBar', () => {
  const mockSearch = jest.fn();
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });

    (useCaseSearch as jest.Mock).mockReturnValue({
      search: mockSearch,
      results: [],
      loading: false,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders with placeholder text', () => {
    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Căutare dosare (min 3 caractere)...');
    expect(input).toBeInTheDocument();
  });

  it('shows hint when less than 3 characters are entered', () => {
    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Căutare dosare (min 3 caractere)...');
    fireEvent.change(input, { target: { value: 'ab' } });

    expect(
      screen.getByText('Introduceți cel puțin 3 caractere pentru căutare')
    ).toBeInTheDocument();
  });

  it('does not search with less than 3 characters', async () => {
    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Căutare dosare (min 3 caractere)...');
    fireEvent.change(input, { target: { value: 'ab' } });

    await waitFor(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('debounces search input (300ms delay)', async () => {
    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Căutare dosare (min 3 caractere)...');
    fireEvent.change(input, { target: { value: 'test' } });

    // Should not search immediately
    expect(mockSearch).not.toHaveBeenCalled();

    // Should search after 300ms
    await waitFor(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockSearch).toHaveBeenCalledWith('test');
  });

  it('enforces max 200 character limit', () => {
    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText(
      'Căutare dosare (min 3 caractere)...'
    ) as HTMLInputElement;
    const longString = 'a'.repeat(250);

    fireEvent.change(input, { target: { value: longString } });

    expect(input.value).toHaveLength(200);
  });

  it('displays loading state', async () => {
    (useCaseSearch as jest.Mock).mockReturnValue({
      search: mockSearch,
      results: [],
      loading: true,
    });

    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Căutare dosare (min 3 caractere)...');
    fireEvent.change(input, { target: { value: 'test' } });

    // Advance timers first
    jest.advanceTimersByTime(300);

    // Wait for the component to re-render with the dropdown
    await waitFor(() => {
      expect(screen.getByText('Se caută...')).toBeInTheDocument();
    });
  });

  it('displays "no results" message when search returns empty', async () => {
    (useCaseSearch as jest.Mock).mockReturnValue({
      search: mockSearch,
      results: [],
      loading: false,
    });

    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Căutare dosare (min 3 caractere)...');
    fireEvent.change(input, { target: { value: 'test' } });

    // Advance timers first
    jest.advanceTimersByTime(300);

    // Wait for the component to re-render with the dropdown
    await waitFor(() => {
      expect(screen.getByText(/Nu s-au găsit dosare pentru "test"/)).toBeInTheDocument();
    });
  });

  it('displays search results', async () => {
    const mockResults = [
      {
        id: 'case-1',
        caseNumber: 'CASE-001',
        title: 'Test Case 1',
        client: { name: 'Client A' },
        status: 'Active',
      },
      {
        id: 'case-2',
        caseNumber: 'CASE-002',
        title: 'Test Case 2',
        client: { name: 'Client B' },
        status: 'Closed',
      },
    ];

    // Set up mock with results before rendering
    (useCaseSearch as jest.Mock).mockReturnValue({
      search: mockSearch,
      results: mockResults,
      loading: false,
    });

    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Căutare dosare (min 3 caractere)...');
    fireEvent.change(input, { target: { value: 'test' } });

    // Advance timers to trigger the debounced search
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Wait for the component to re-render with the dropdown
    await waitFor(() => {
      expect(screen.getByText(/CASE-001/)).toBeInTheDocument();
    });

    // Verify both cases are displayed (text may be split by highlight marks)
    expect(screen.getByText(/Case 1/)).toBeInTheDocument();
    expect(screen.getByText(/Client A/)).toBeInTheDocument();
    expect(screen.getByText(/CASE-002/)).toBeInTheDocument();
    expect(screen.getByText(/Case 2/)).toBeInTheDocument();
  });

  it('highlights matching text in results', async () => {
    const mockResults = [
      {
        id: 'case-1',
        caseNumber: 'CASE-001',
        title: 'Test Case 1',
        client: { name: 'Test Client' },
        status: 'Active',
      },
    ];

    (useCaseSearch as jest.Mock).mockReturnValue({
      search: mockSearch,
      results: mockResults,
      loading: false,
    });

    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Căutare dosare (min 3 caractere)...');
    fireEvent.change(input, { target: { value: 'Test' } });

    // Advance timers first
    jest.advanceTimersByTime(300);

    // Wait for the component to re-render with the dropdown
    await waitFor(() => {
      const highlighted = document.querySelectorAll('mark');
      expect(highlighted.length).toBeGreaterThan(0);
    });
  });

  it('navigates to case detail when result is clicked', async () => {
    const mockResults = [
      {
        id: 'case-1',
        caseNumber: 'CASE-001',
        title: 'Test Case 1',
        client: { name: 'Client A' },
        status: 'Active',
      },
    ];

    (useCaseSearch as jest.Mock).mockReturnValue({
      search: mockSearch,
      results: mockResults,
      loading: false,
    });

    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Căutare dosare (min 3 caractere)...');
    fireEvent.change(input, { target: { value: 'test' } });

    // Advance timers first
    jest.advanceTimersByTime(300);

    // Wait for the component to re-render with results
    await waitFor(() => {
      expect(screen.getByText(/CASE-001/)).toBeInTheDocument();
    });

    const resultButton = screen.getByText(/CASE-001/).closest('button');
    fireEvent.click(resultButton!);

    expect(mockPush).toHaveBeenCalledWith('/cases/case-1');
  });

  it('clears input and closes dropdown when result is clicked', async () => {
    const mockResults = [
      {
        id: 'case-1',
        caseNumber: 'CASE-001',
        title: 'Test Case',
        client: { name: 'Client' },
        status: 'Active',
      },
    ];

    (useCaseSearch as jest.Mock).mockReturnValue({
      search: mockSearch,
      results: mockResults,
      loading: false,
    });

    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText(
      'Căutare dosare (min 3 caractere)...'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test' } });

    // Advance timers first
    jest.advanceTimersByTime(300);

    // Wait for the component to re-render with results
    await waitFor(() => {
      expect(screen.getByText(/CASE-001/)).toBeInTheDocument();
    });

    const resultButton = screen.getByText(/CASE-001/).closest('button');
    fireEvent.click(resultButton!);

    expect(input.value).toBe('');
  });

  it('does not show dropdown when query is less than 3 characters', async () => {
    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Căutare dosare (min 3 caractere)...');
    fireEvent.change(input, { target: { value: 'ab' } });

    await waitFor(() => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Se caută...')).not.toBeInTheDocument();
    expect(screen.queryByText(/Nu s-au găsit dosare/)).not.toBeInTheDocument();
  });
});
