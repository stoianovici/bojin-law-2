/**
 * Unit Tests for CaseSearchBar Component
 * Story 2.8: Case CRUD Operations UI - Task 19
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

    const input = screen.getByPlaceholderText('Search cases (min 3 characters)...');
    expect(input).toBeInTheDocument();
  });

  it('shows hint when less than 3 characters are entered', () => {
    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Search cases (min 3 characters)...');
    fireEvent.change(input, { target: { value: 'ab' } });

    expect(screen.getByText('Type at least 3 characters to search')).toBeInTheDocument();
  });

  it('does not search with less than 3 characters', async () => {
    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Search cases (min 3 characters)...');
    fireEvent.change(input, { target: { value: 'ab' } });

    await waitFor(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('debounces search input (300ms delay)', async () => {
    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Search cases (min 3 characters)...');
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
      'Search cases (min 3 characters)...'
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

    const input = screen.getByPlaceholderText('Search cases (min 3 characters)...');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('displays "no results" message when search returns empty', async () => {
    (useCaseSearch as jest.Mock).mockReturnValue({
      search: mockSearch,
      results: [],
      loading: false,
    });

    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Search cases (min 3 characters)...');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByText(/No cases found for "test"/)).toBeInTheDocument();
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

    (useCaseSearch as jest.Mock).mockReturnValue({
      search: mockSearch,
      results: mockResults,
      loading: false,
    });

    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Search cases (min 3 characters)...');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByText(/CASE-001/)).toBeInTheDocument();
    expect(screen.getByText(/Test Case 1/)).toBeInTheDocument();
    expect(screen.getByText(/Client A/)).toBeInTheDocument();
    expect(screen.getByText(/CASE-002/)).toBeInTheDocument();
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

    const input = screen.getByPlaceholderText('Search cases (min 3 characters)...');
    fireEvent.change(input, { target: { value: 'Test' } });

    await waitFor(() => {
      jest.advanceTimersByTime(300);
    });

    // Check that mark elements exist (highlighted text)
    const highlighted = document.querySelectorAll('mark');
    expect(highlighted.length).toBeGreaterThan(0);
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

    const input = screen.getByPlaceholderText('Search cases (min 3 characters)...');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      jest.advanceTimersByTime(300);
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
      'Search cases (min 3 characters)...'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      jest.advanceTimersByTime(300);
    });

    const resultButton = screen.getByText(/CASE-001/).closest('button');
    fireEvent.click(resultButton!);

    expect(input.value).toBe('');
  });

  it('does not show dropdown when query is less than 3 characters', async () => {
    render(<CaseSearchBar />);

    const input = screen.getByPlaceholderText('Search cases (min 3 characters)...');
    fireEvent.change(input, { target: { value: 'ab' } });

    await waitFor(() => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    expect(screen.queryByText(/No cases found/)).not.toBeInTheDocument();
  });
});
