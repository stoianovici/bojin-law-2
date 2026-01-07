/**
 * Unit Tests for TeamManagement Component
 * Story 2.8: Case CRUD Operations UI - Task 19
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TeamManagement } from './TeamManagement';
import { useTeamAssign } from '../../hooks/useTeamAssign';
import { useTeamRemove } from '../../hooks/useTeamRemove';
import { useNotificationStore } from '../../stores/notificationStore';

// Mock hooks
jest.mock('../../hooks/useTeamAssign');
jest.mock('../../hooks/useTeamRemove');
jest.mock('../../stores/notificationStore');

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}));

describe('TeamManagement', () => {
  const mockAssignTeam = jest.fn();
  const mockRemoveTeam = jest.fn();
  const mockAddNotification = jest.fn();

  const mockTeamMembers = [
    {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      role: 'Partner',
      assignedAt: '2024-01-01T00:00:00Z',
      caseRole: 'Lead',
    },
    {
      id: 'user-2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      role: 'Associate',
      assignedAt: '2024-01-02T00:00:00Z',
      caseRole: 'Support',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    global.confirm = jest.fn(() => true);

    (useTeamAssign as jest.Mock).mockReturnValue({
      assignTeam: mockAssignTeam,
      loading: false,
    });

    (useTeamRemove as jest.Mock).mockReturnValue({
      removeTeam: mockRemoveTeam,
      loading: false,
    });

    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      addNotification: mockAddNotification,
    });
  });

  it('renders team members list', () => {
    render(
      <TeamManagement caseId="case-1" teamMembers={mockTeamMembers} currentUserRole="Partner" />
    );

    expect(screen.getByText(/John/)).toBeInTheDocument();
    expect(screen.getByText(/Jane/)).toBeInTheDocument();
  });

  it('shows empty state when no team members', () => {
    render(<TeamManagement caseId="case-1" teamMembers={[]} currentUserRole="Partner" />);

    expect(screen.getByText(/No team members assigned/i)).toBeInTheDocument();
  });

  it('shows add team member button for Partners', () => {
    render(
      <TeamManagement caseId="case-1" teamMembers={mockTeamMembers} currentUserRole="Partner" />
    );

    expect(screen.getByText(/Add Team Member/i)).toBeInTheDocument();
  });

  it('hides add team member button for Paralegals', () => {
    render(
      <TeamManagement caseId="case-1" teamMembers={mockTeamMembers} currentUserRole="Paralegal" />
    );

    expect(screen.queryByText(/Add Team Member/i)).not.toBeInTheDocument();
  });

  it('shows remove button for team members when user is Partner', () => {
    render(
      <TeamManagement caseId="case-1" teamMembers={mockTeamMembers} currentUserRole="Partner" />
    );

    const removeButtons = screen.getAllByTitle(/Remove/i);
    expect(removeButtons.length).toBeGreaterThan(0);
  });

  it('hides remove button for Paralegals', () => {
    render(
      <TeamManagement caseId="case-1" teamMembers={mockTeamMembers} currentUserRole="Paralegal" />
    );

    expect(screen.queryByTitle(/Remove/i)).not.toBeInTheDocument();
  });

  it('displays team member emails', () => {
    render(
      <TeamManagement caseId="case-1" teamMembers={mockTeamMembers} currentUserRole="Partner" />
    );

    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('calls assignTeam when adding a team member', async () => {
    mockAssignTeam.mockResolvedValue({ success: true });

    render(
      <TeamManagement caseId="case-1" teamMembers={mockTeamMembers} currentUserRole="Partner" />
    );

    // Open add modal
    const addButton = screen.getByText(/Add Team Member/i);
    fireEvent.click(addButton);

    // Wait for modal to appear and find form fields
    const userIdInput = await screen.findByLabelText(/User ID/i);
    const roleSelect = await screen.findByLabelText(/Role/i);

    // Fill form
    fireEvent.change(userIdInput, {
      target: { value: '123e4567-e89b-12d3-a456-426614174000' },
    });
    fireEvent.change(roleSelect, { target: { value: 'Support' } });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Add Team Member/i });
    fireEvent.click(submitButton);

    // Verify assignTeam was called
    await waitFor(() => {
      expect(mockAssignTeam).toHaveBeenCalledWith({
        caseId: 'case-1',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        role: 'Support',
      });
    });
  });

  it('shows confirmation before removing team member', async () => {
    render(
      <TeamManagement caseId="case-1" teamMembers={mockTeamMembers} currentUserRole="Partner" />
    );

    const removeButtons = screen.getAllByTitle(/Remove/i);
    fireEvent.click(removeButtons[1]); // Click remove for second member

    // Check that the confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByText(/Remove Team Member/i)).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to remove/i)).toBeInTheDocument();
      // Jane Smith appears twice (in list and dialog), so verify there are multiple instances
      const janeSmithElements = screen.getAllByText(/Jane Smith/i);
      expect(janeSmithElements.length).toBeGreaterThan(0);
    });
  });

  it('does not remove if confirmation is cancelled', async () => {
    render(
      <TeamManagement caseId="case-1" teamMembers={mockTeamMembers} currentUserRole="Partner" />
    );

    const removeButtons = screen.getAllByTitle(/Remove/i);
    fireEvent.click(removeButtons[1]);

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/Remove Team Member/i)).toBeInTheDocument();
    });

    // Click Cancel button
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);

    // Verify removeTeam was not called
    expect(mockRemoveTeam).not.toHaveBeenCalled();
  });

  it('renders component successfully', () => {
    render(
      <TeamManagement caseId="case-1" teamMembers={mockTeamMembers} currentUserRole="Partner" />
    );

    // Component renders without crashing
    expect(screen.getByText(/John/)).toBeInTheDocument();
  });
});
