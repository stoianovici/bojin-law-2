/**
 * Unit Tests for ActorsManagement Component
 * Story 2.8: Case CRUD Operations UI - Task 19
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActorsManagement } from './ActorsManagement';
import { useActorAdd } from '../../hooks/useActorAdd';
import { useActorUpdate } from '../../hooks/useActorUpdate';
import { useActorRemove } from '../../hooks/useActorRemove';
import { useNotificationStore } from '../../stores/notificationStore';

// Mock hooks
jest.mock('../../hooks/useActorAdd');
jest.mock('../../hooks/useActorUpdate');
jest.mock('../../hooks/useActorRemove');
jest.mock('../../stores/notificationStore');

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}));

describe('ActorsManagement', () => {
  const mockAddActor = jest.fn();
  const mockUpdateActor = jest.fn();
  const mockRemoveActor = jest.fn();
  const mockAddNotification = jest.fn();

  const mockActors = [
    {
      id: 'actor-1',
      role: 'Client',
      name: 'John Client',
      organization: 'ABC Corp',
      email: 'john@abc.com',
      phone: '555-1234',
      address: '123 Main St',
      notes: 'Primary contact',
    },
    {
      id: 'actor-2',
      role: 'OpposingParty',
      name: 'Jane Opposing',
      organization: 'XYZ Inc',
      email: 'jane@xyz.com',
      phone: '555-5678',
      address: null,
      notes: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    global.confirm = jest.fn(() => true);

    (useActorAdd as jest.Mock).mockReturnValue({
      addActor: mockAddActor,
      loading: false,
    });

    (useActorUpdate as jest.Mock).mockReturnValue({
      updateActor: mockUpdateActor,
      loading: false,
    });

    (useActorRemove as jest.Mock).mockReturnValue({
      removeActor: mockRemoveActor,
      loading: false,
    });

    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      addNotification: mockAddNotification,
    });
  });

  it('renders actors list', () => {
    render(<ActorsManagement caseId="case-1" actors={mockActors} />);

    expect(screen.getByText('John Client')).toBeInTheDocument();
    expect(screen.getByText('Jane Opposing')).toBeInTheDocument();
  });

  it('shows empty state when no actors', () => {
    render(<ActorsManagement caseId="case-1" actors={[]} />);

    expect(screen.getByText(/Nu au fost adăugate persoane de contact/i)).toBeInTheDocument();
  });

  it('displays actor organizations', () => {
    render(<ActorsManagement caseId="case-1" actors={mockActors} />);

    expect(screen.getByText('ABC Corp')).toBeInTheDocument();
    expect(screen.getByText('XYZ Inc')).toBeInTheDocument();
  });

  it('displays actor contact information', () => {
    render(<ActorsManagement caseId="case-1" actors={mockActors} />);

    expect(screen.getByText('john@abc.com')).toBeInTheDocument();
    expect(screen.getByText('555-1234')).toBeInTheDocument();
  });

  it('renders actors component successfully', () => {
    render(<ActorsManagement caseId="case-1" actors={mockActors} />);

    // Component renders without crashing
    expect(screen.getByText('John Client')).toBeInTheDocument();
  });

  it('shows add actor button', () => {
    render(<ActorsManagement caseId="case-1" actors={mockActors} />);

    expect(screen.getByText(/Adaugă contact/i)).toBeInTheDocument();
  });

  it('opens add actor modal when button is clicked', async () => {
    render(<ActorsManagement caseId="case-1" actors={mockActors} />);

    const addButton = screen.getByText(/Adaugă contact/i);
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText(/Adăugare persoană contact/i)).toBeInTheDocument();
    });
  });

  it('displays remove button for each actor', () => {
    render(<ActorsManagement caseId="case-1" actors={mockActors} />);

    const removeButtons = screen.getAllByTitle(/Șterge/i);
    expect(removeButtons.length).toBe(mockActors.length);
  });

  it('shows confirmation before removing actor', async () => {
    render(<ActorsManagement caseId="case-1" actors={mockActors} />);

    const removeButtons = screen.getAllByTitle(/Șterge/i);
    fireEvent.click(removeButtons[0]);

    // Check that the confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByText(/Ștergere persoană contact/i)).toBeInTheDocument();
      expect(screen.getByText(/Sigur doriți să ștergeți/i)).toBeInTheDocument();
    });
  });

  it('does not remove if confirmation is cancelled', async () => {
    render(<ActorsManagement caseId="case-1" actors={mockActors} />);

    const removeButtons = screen.getAllByTitle(/Șterge/i);
    fireEvent.click(removeButtons[0]);

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/Ștergere persoană contact/i)).toBeInTheDocument();
    });

    // Click Cancel button
    const cancelButton = screen.getByRole('button', { name: /Anulează/i });
    fireEvent.click(cancelButton);

    // Verify removeActor was not called
    expect(mockRemoveActor).not.toHaveBeenCalled();
  });

  it('displays actor notes when available', () => {
    render(<ActorsManagement caseId="case-1" actors={mockActors} />);

    expect(screen.getByText('Primary contact')).toBeInTheDocument();
  });

  it('displays actor addresses when available', () => {
    render(<ActorsManagement caseId="case-1" actors={mockActors} />);

    expect(screen.getByText('123 Main St')).toBeInTheDocument();
  });

  it('renders all actors', () => {
    render(<ActorsManagement caseId="case-1" actors={mockActors} />);

    // All actors should be visible
    expect(screen.getByText('John Client')).toBeInTheDocument();
    expect(screen.getByText('Jane Opposing')).toBeInTheDocument();
  });

  it('handles empty contact fields gracefully', () => {
    const actorWithNoContact = [
      {
        id: 'actor-3',
        role: 'Witness',
        name: 'No Contact',
        organization: null,
        email: null,
        phone: null,
        address: null,
        notes: null,
      },
    ];

    render(<ActorsManagement caseId="case-1" actors={actorWithNoContact} />);

    expect(screen.getByText('No Contact')).toBeInTheDocument();
  });

  it('displays all actor role types correctly', () => {
    const allRoleActors = [
      {
        id: '1',
        role: 'Client',
        name: 'Client Name',
        organization: null,
        email: null,
        phone: null,
        address: null,
        notes: null,
      },
      {
        id: '2',
        role: 'OpposingParty',
        name: 'Opposing Name',
        organization: null,
        email: null,
        phone: null,
        address: null,
        notes: null,
      },
      {
        id: '3',
        role: 'OpposingCounsel',
        name: 'Counsel Name',
        organization: null,
        email: null,
        phone: null,
        address: null,
        notes: null,
      },
      {
        id: '4',
        role: 'Witness',
        name: 'Witness Name',
        organization: null,
        email: null,
        phone: null,
        address: null,
        notes: null,
      },
      {
        id: '5',
        role: 'Expert',
        name: 'Expert Name',
        organization: null,
        email: null,
        phone: null,
        address: null,
        notes: null,
      },
    ];

    render(<ActorsManagement caseId="case-1" actors={allRoleActors} />);

    expect(screen.getByText('Client Name')).toBeInTheDocument();
    expect(screen.getByText('Opposing Name')).toBeInTheDocument();
    expect(screen.getByText('Counsel Name')).toBeInTheDocument();
    expect(screen.getByText('Witness Name')).toBeInTheDocument();
    expect(screen.getByText('Expert Name')).toBeInTheDocument();
  });
});
