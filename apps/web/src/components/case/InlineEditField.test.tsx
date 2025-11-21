/**
 * Unit Tests for InlineEditField Component
 * Story 2.8: Case CRUD Operations UI - Task 19
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineEditField } from './InlineEditField';
import { useCaseUpdate } from '../../hooks/useCaseUpdate';
import { useNotificationStore } from '../../stores/notificationStore';

// Mock hooks
jest.mock('../../hooks/useCaseUpdate');
jest.mock('../../stores/notificationStore');

describe('InlineEditField', () => {
  const mockUpdateCase = jest.fn();
  const mockAddNotification = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useCaseUpdate as jest.Mock).mockReturnValue({
      updateCase: mockUpdateCase,
      loading: false,
    });

    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      addNotification: mockAddNotification,
    });
  });

  it('renders in display mode with value', () => {
    render(
      <InlineEditField caseId="case-1" fieldName="title" value="Test Case Title" label="Title" />
    );

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Test Case Title')).toBeInTheDocument();
  });

  it('displays placeholder when value is null', () => {
    render(
      <InlineEditField
        caseId="case-1"
        fieldName="title"
        value={null}
        label="Title"
        placeholder="No title set"
      />
    );

    expect(screen.getByText('No title set')).toBeInTheDocument();
  });

  it('enters edit mode when clicked', () => {
    render(
      <InlineEditField caseId="case-1" fieldName="title" value="Test Case Title" label="Title" />
    );

    const field = screen.getByText('Test Case Title');
    fireEvent.click(field);

    // Should show input field
    const input = screen.getByDisplayValue('Test Case Title');
    expect(input).toBeInTheDocument();
  });

  it('does not enter edit mode when editable is false', () => {
    render(
      <InlineEditField
        caseId="case-1"
        fieldName="title"
        value="Test Case Title"
        label="Title"
        editable={false}
      />
    );

    const field = screen.getByText('Test Case Title');
    fireEvent.click(field);

    // Should not show input field
    expect(screen.queryByDisplayValue('Test Case Title')).not.toBeInTheDocument();
  });

  it('focuses input when entering edit mode', async () => {
    render(
      <InlineEditField caseId="case-1" fieldName="title" value="Test Case Title" label="Title" />
    );

    const field = screen.getByText('Test Case Title');
    fireEvent.click(field);

    await waitFor(() => {
      const input = screen.getByDisplayValue('Test Case Title');
      expect(input).toHaveFocus();
    });
  });

  it('cancels editing when ESC is pressed', () => {
    render(
      <InlineEditField caseId="case-1" fieldName="title" value="Test Case Title" label="Title" />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Test Case Title'));

    const input = screen.getByDisplayValue('Test Case Title');
    fireEvent.change(input, { target: { value: 'Updated Title' } });

    // Press ESC
    fireEvent.keyDown(input, { key: 'Escape' });

    // Should exit edit mode without saving
    expect(screen.queryByDisplayValue('Updated Title')).not.toBeInTheDocument();
    expect(screen.getByText('Test Case Title')).toBeInTheDocument();
    expect(mockUpdateCase).not.toHaveBeenCalled();
  });

  it('saves changes when Enter is pressed', async () => {
    mockUpdateCase.mockResolvedValue({ success: true });

    render(
      <InlineEditField caseId="case-1" fieldName="title" value="Test Case Title" label="Title" />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Test Case Title'));

    const input = screen.getByDisplayValue('Test Case Title');
    fireEvent.change(input, { target: { value: 'Updated Title' } });

    // Press Enter
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockUpdateCase).toHaveBeenCalledWith('case-1', {
        title: 'Updated Title',
      });
    });
  });

  it('saves changes when save button is clicked', async () => {
    mockUpdateCase.mockResolvedValue({ success: true });

    render(
      <InlineEditField caseId="case-1" fieldName="title" value="Test Case Title" label="Title" />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Test Case Title'));

    const input = screen.getByDisplayValue('Test Case Title');
    fireEvent.change(input, { target: { value: 'Updated Title' } });

    // Click save button
    const saveButton = screen.getByTitle('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateCase).toHaveBeenCalledWith('case-1', {
        title: 'Updated Title',
      });
    });
  });

  it('cancels editing when cancel button is clicked', () => {
    render(
      <InlineEditField caseId="case-1" fieldName="title" value="Test Case Title" label="Title" />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Test Case Title'));

    const input = screen.getByDisplayValue('Test Case Title');
    fireEvent.change(input, { target: { value: 'Updated Title' } });

    // Click cancel button
    const cancelButton = screen.getByTitle('Cancel');
    fireEvent.click(cancelButton);

    // Should exit edit mode without saving
    expect(screen.queryByDisplayValue('Updated Title')).not.toBeInTheDocument();
    expect(screen.getByText('Test Case Title')).toBeInTheDocument();
    expect(mockUpdateCase).not.toHaveBeenCalled();
  });

  it('shows success notification after successful save', async () => {
    mockUpdateCase.mockResolvedValue({ success: true });

    render(
      <InlineEditField caseId="case-1" fieldName="title" value="Test Case Title" label="Title" />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Test Case Title'));

    const input = screen.getByDisplayValue('Test Case Title');
    fireEvent.change(input, { target: { value: 'Updated Title' } });

    // Save
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'success',
        title: 'Success',
        message: 'Title updated successfully',
      });
    });
  });

  it('shows error notification when save fails', async () => {
    mockUpdateCase.mockRejectedValue(new Error('Update failed'));

    render(
      <InlineEditField caseId="case-1" fieldName="title" value="Test Case Title" label="Title" />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Test Case Title'));

    const input = screen.getByDisplayValue('Test Case Title');
    fireEvent.change(input, { target: { value: 'Updated Title' } });

    // Save
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update title: Update failed',
      });
    });
  });

  it('calls onSuccess callback after successful save', async () => {
    mockUpdateCase.mockResolvedValue({ success: true });

    render(
      <InlineEditField
        caseId="case-1"
        fieldName="title"
        value="Test Case Title"
        label="Title"
        onSuccess={mockOnSuccess}
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Test Case Title'));

    const input = screen.getByDisplayValue('Test Case Title');
    fireEvent.change(input, { target: { value: 'Updated Title' } });

    // Save
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('validates input before saving', async () => {
    const mockValidate = jest.fn(() => 'Validation error');

    render(
      <InlineEditField
        caseId="case-1"
        fieldName="title"
        value="Test Case Title"
        label="Title"
        validate={mockValidate}
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Test Case Title'));

    const input = screen.getByDisplayValue('Test Case Title');
    fireEvent.change(input, { target: { value: 'Invalid' } });

    // Save
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => {
      expect(mockValidate).toHaveBeenCalledWith('Invalid');
      expect(screen.getByText('Validation error')).toBeInTheDocument();
      expect(mockUpdateCase).not.toHaveBeenCalled();
    });
  });

  it('does not save if value has not changed', async () => {
    render(
      <InlineEditField caseId="case-1" fieldName="title" value="Test Case Title" label="Title" />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Test Case Title'));

    // Save without changing value
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => {
      expect(mockUpdateCase).not.toHaveBeenCalled();
    });
  });

  it('renders textarea for textarea field type', () => {
    render(
      <InlineEditField
        caseId="case-1"
        fieldName="description"
        value="Test Description"
        label="Description"
        fieldType="textarea"
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Test Description'));

    // Should render textarea
    const textarea = screen.getByDisplayValue('Test Description');
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('renders number input for number field type', () => {
    render(
      <InlineEditField
        caseId="case-1"
        fieldName="value"
        value={1000}
        label="Case Value"
        fieldType="number"
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('1000'));

    // Should render number input
    const input = screen.getByDisplayValue('1000') as HTMLInputElement;
    expect(input.type).toBe('number');
  });

  it('renders select for select field type', () => {
    const options = [
      { value: 'Active', label: 'Active' },
      { value: 'Closed', label: 'Closed' },
    ];

    render(
      <InlineEditField
        caseId="case-1"
        fieldName="status"
        value="Active"
        label="Status"
        fieldType="select"
        options={options}
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Active'));

    // Should render select
    const select = screen.getByDisplayValue('Active');
    expect(select.tagName).toBe('SELECT');
  });

  it('disables input during loading', async () => {
    (useCaseUpdate as jest.Mock).mockReturnValue({
      updateCase: mockUpdateCase,
      loading: true,
    });

    render(
      <InlineEditField caseId="case-1" fieldName="title" value="Test Case Title" label="Title" />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Test Case Title'));

    const input = screen.getByDisplayValue('Test Case Title');
    expect(input).toBeDisabled();
  });

  it('uses custom formatDisplay function', () => {
    const formatDisplay = (value: string | number | null | undefined) => {
      return <strong>{value?.toString().toUpperCase()}</strong>;
    };

    render(
      <InlineEditField
        caseId="case-1"
        fieldName="title"
        value="test"
        label="Title"
        formatDisplay={formatDisplay}
      />
    );

    expect(screen.getByText('TEST')).toBeInTheDocument();
  });
});
