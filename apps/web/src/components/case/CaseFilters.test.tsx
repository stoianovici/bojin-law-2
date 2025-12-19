/**
 * Unit Tests for CaseFilters Component
 * Story 2.8: Case CRUD Operations UI - Task 19
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaseFilters } from './CaseFilters';
import { useCaseFiltersStore } from '../../stores/caseFiltersStore';

// Mock the Zustand store
jest.mock('../../stores/caseFiltersStore');

describe('CaseFilters', () => {
  const mockSetStatus = jest.fn();
  const mockSetAssignedToMe = jest.fn();
  const mockClearFilters = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCaseFiltersStore as unknown as jest.Mock).mockReturnValue({
      status: undefined,
      assignedToMe: false,
      setStatus: mockSetStatus,
      setAssignedToMe: mockSetAssignedToMe,
      clearFilters: mockClearFilters,
    });
  });

  it('renders with default state (no filters active)', () => {
    render(<CaseFilters />);

    // Check status dropdown exists and shows "All Statuses"
    const statusSelect = screen.getByLabelText('Status');
    expect(statusSelect).toBeInTheDocument();
    expect(statusSelect).toHaveValue('All');

    // Check "Assigned to Me" checkbox exists and is unchecked
    const assignedCheckbox = screen.getByLabelText('Assigned to Me');
    expect(assignedCheckbox).toBeInTheDocument();
    expect(assignedCheckbox).not.toBeChecked();

    // Clear Filters button should not be visible
    expect(screen.queryByText('Șterge filtrele')).not.toBeInTheDocument();
  });

  it('calls setStatus when status dropdown changes', () => {
    render(<CaseFilters />);

    const statusSelect = screen.getByLabelText('Status');
    fireEvent.change(statusSelect, { target: { value: 'Active' } });

    expect(mockSetStatus).toHaveBeenCalledWith('Active');
  });

  it('calls setStatus with undefined when "All" is selected', () => {
    (useCaseFiltersStore as unknown as jest.Mock).mockReturnValue({
      status: 'Active',
      assignedToMe: false,
      setStatus: mockSetStatus,
      setAssignedToMe: mockSetAssignedToMe,
      clearFilters: mockClearFilters,
    });

    render(<CaseFilters />);

    const statusSelect = screen.getByLabelText('Status');
    fireEvent.change(statusSelect, { target: { value: 'All' } });

    expect(mockSetStatus).toHaveBeenCalledWith(undefined);
  });

  it('calls setAssignedToMe when checkbox is toggled', () => {
    render(<CaseFilters />);

    const assignedCheckbox = screen.getByLabelText('Assigned to Me');
    fireEvent.click(assignedCheckbox);

    expect(mockSetAssignedToMe).toHaveBeenCalledWith(true);
  });

  it('displays Clear Filters button when status filter is active', () => {
    (useCaseFiltersStore as unknown as jest.Mock).mockReturnValue({
      status: 'Active',
      assignedToMe: false,
      setStatus: mockSetStatus,
      setAssignedToMe: mockSetAssignedToMe,
      clearFilters: mockClearFilters,
    });

    render(<CaseFilters />);

    const clearButton = screen.getByText('Șterge filtrele');
    expect(clearButton).toBeInTheDocument();
  });

  it('displays Clear Filters button when assignedToMe is active', () => {
    (useCaseFiltersStore as unknown as jest.Mock).mockReturnValue({
      status: undefined,
      assignedToMe: true,
      setStatus: mockSetStatus,
      setAssignedToMe: mockSetAssignedToMe,
      clearFilters: mockClearFilters,
    });

    render(<CaseFilters />);

    const clearButton = screen.getByText('Șterge filtrele');
    expect(clearButton).toBeInTheDocument();
  });

  it('calls clearFilters when Clear Filters button is clicked', () => {
    (useCaseFiltersStore as unknown as jest.Mock).mockReturnValue({
      status: 'Active',
      assignedToMe: false,
      setStatus: mockSetStatus,
      setAssignedToMe: mockSetAssignedToMe,
      clearFilters: mockClearFilters,
    });

    render(<CaseFilters />);

    const clearButton = screen.getByText('Șterge filtrele');
    fireEvent.click(clearButton);

    expect(mockClearFilters).toHaveBeenCalledTimes(1);
  });

  it('displays all status options', () => {
    render(<CaseFilters />);

    const statusSelect = screen.getByLabelText('Status');
    const options = Array.from(statusSelect.querySelectorAll('option'));
    const optionValues = options.map((opt) => opt.getAttribute('value'));

    expect(optionValues).toEqual(['All', 'Active', 'OnHold', 'Closed', 'Archived']);
  });

  it('has accessible labels for form controls', () => {
    render(<CaseFilters />);

    // Status dropdown should have label
    expect(screen.getByLabelText('Status')).toBeInTheDocument();

    // Checkbox should have label
    expect(screen.getByLabelText('Assigned to Me')).toBeInTheDocument();
  });
});
