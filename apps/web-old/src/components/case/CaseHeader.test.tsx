/**
 * CaseHeader Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaseHeader } from './CaseHeader';
import type { Case, User } from '@legal-platform/types';

// Mock next/navigation
const mockPush = jest.fn();
const mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

// Mock useCaseEditPermission
const mockCaseEditPermission = {
  canEdit: true,
  canEditFinancials: false,
  editReason: 'partner' as const,
  isLoading: false,
};
jest.mock('@/hooks/useCaseEditPermission', () => ({
  useCaseEditPermission: () => mockCaseEditPermission,
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((_date: Date) => '12 Nov 2025'),
  differenceInDays: jest.fn(() => 5),
}));

jest.mock('date-fns/locale', () => ({
  ro: {},
}));

describe('CaseHeader', () => {
  const mockCase: Case = {
    id: '1',
    caseNumber: 'CASE-2024-001',
    title: 'Contract de Achiziție - Acme Corp',
    clientId: 'client-123',
    status: 'Active',
    type: 'Contract',
    description: 'Contract pentru achiziția de echipament',
    openedDate: new Date('2024-01-01'),
    closedDate: null,
    value: 50000,
    metadata: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockTeamMembers: User[] = [
    {
      id: '1',
      email: 'ion.popescu@example.com',
      firstName: 'Ion',
      lastName: 'Popescu',
      role: 'Partner',
      firmId: 'firm-1',
      azureAdId: 'azure-1',
      preferences: {},
      createdAt: new Date(),
      lastActive: new Date(),
    },
    {
      id: '2',
      email: 'maria.ionescu@example.com',
      firstName: 'Maria',
      lastName: 'Ionescu',
      role: 'Associate',
      firmId: 'firm-1',
      azureAdId: 'azure-2',
      preferences: {},
      createdAt: new Date(),
      lastActive: new Date(),
    },
  ];

  const mockDeadline = {
    date: new Date('2025-11-17'),
    description: 'Depunere răspuns',
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockCaseEditPermission.canEdit = true;
  });

  it('renders case information correctly', () => {
    render(<CaseHeader case={mockCase} />);

    expect(screen.getByText('CASE-2024-001')).toBeInTheDocument();
    expect(screen.getByText('Contract de Achiziție - Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Activ')).toBeInTheDocument();
    expect(screen.getByText('Contract')).toBeInTheDocument();
  });

  it('renders team members avatars', () => {
    render(<CaseHeader case={mockCase} teamMembers={mockTeamMembers} />);

    expect(screen.getByText('IP')).toBeInTheDocument();
    expect(screen.getByText('MI')).toBeInTheDocument();
  });

  it('shows +N indicator when more than 5 team members', () => {
    const manyMembers = Array.from({ length: 7 }, (_, i) => ({
      ...mockTeamMembers[0],
      id: `user-${i}`,
      firstName: `User${i}`,
      lastName: `Test${i}`,
    }));

    render(<CaseHeader case={mockCase} teamMembers={manyMembers} />);

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders next deadline indicator', () => {
    render(<CaseHeader case={mockCase} nextDeadline={mockDeadline} />);

    expect(screen.getByText('Termen Următor:')).toBeInTheDocument();
    expect(screen.getByText(/12 Nov 2025 - Depunere răspuns/)).toBeInTheDocument();
  });

  it('shows edit button when user has permission', () => {
    render(<CaseHeader case={mockCase} />);

    expect(screen.getByText('Editează')).toBeInTheDocument();
  });

  it('hides edit button when user lacks permission', () => {
    mockCaseEditPermission.canEdit = false;
    render(<CaseHeader case={mockCase} />);

    expect(screen.queryByText('Editează')).not.toBeInTheDocument();
  });

  it('navigates to edit mode when edit button clicked', () => {
    render(<CaseHeader case={mockCase} />);

    const editButton = screen.getByText('Editează');
    fireEvent.click(editButton);

    expect(mockPush).toHaveBeenCalledWith('/cases/1?edit=true');
  });

  it('calls onAddTeamMember when add button clicked', () => {
    const mockOnAddTeamMember = jest.fn();
    render(<CaseHeader case={mockCase} onAddTeamMember={mockOnAddTeamMember} />);

    const addButton = screen.getByText('Adaugă Membru');
    fireEvent.click(addButton);

    expect(mockOnAddTeamMember).toHaveBeenCalledTimes(1);
  });

  it('renders different status badges correctly', () => {
    const statusCases: Array<{ status: Case['status']; label: string }> = [
      { status: 'Active', label: 'Activ' },
      { status: 'OnHold', label: 'Suspendat' },
      { status: 'Closed', label: 'Închis' },
      { status: 'Archived', label: 'Arhivat' },
    ];

    statusCases.forEach(({ status, label }) => {
      const { unmount } = render(<CaseHeader case={{ ...mockCase, status }} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    });
  });

  it('renders different case type labels correctly', () => {
    const typeCases: Array<{ type: Case['type']; label: string }> = [
      { type: 'Litigation', label: 'Litigiu' },
      { type: 'Contract', label: 'Contract' },
      { type: 'Advisory', label: 'Consultanță' },
      { type: 'Criminal', label: 'Penal' },
      { type: 'Other', label: 'Altele' },
    ];

    typeCases.forEach(({ type, label }) => {
      const { unmount } = render(<CaseHeader case={{ ...mockCase, type }} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    });
  });

  it('renders without optional props', () => {
    render(<CaseHeader case={mockCase} />);

    expect(screen.getByText('CASE-2024-001')).toBeInTheDocument();
    expect(screen.queryByText('Termen Următor:')).not.toBeInTheDocument();
  });
});
