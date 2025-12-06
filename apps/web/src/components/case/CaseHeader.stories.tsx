/**
 * CaseHeader Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { CaseHeader } from './CaseHeader';
import type { Case, User } from '@legal-platform/types';

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
  {
    id: '3',
    email: 'andrei.popa@example.com',
    firstName: 'Andrei',
    lastName: 'Popa',
    role: 'Associate',
    firmId: 'firm-1',
    azureAdId: 'azure-3',
    preferences: {},
    createdAt: new Date(),
    lastActive: new Date(),
  },
];

const mockDeadline = {
  date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
  description: 'Depunere răspuns la instanță',
};

const urgentDeadline = {
  date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now - urgent
  description: 'Termen limită depunere documente',
};

const meta: Meta<typeof CaseHeader> = {
  title: 'Case/CaseHeader',
  component: CaseHeader,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CaseHeader>;

/**
 * Default state with all information
 */
export const Default: Story = {
  args: {
    case: mockCase,
    teamMembers: mockTeamMembers,
    nextDeadline: mockDeadline,
    onEditCase: () => alert('Edit case clicked'),
    onAddTeamMember: () => alert('Add team member clicked'),
    onMenuAction: (action: any) => alert(`Menu action: ${action}`),
  },
};

/**
 * Active case status
 */
export const ActiveStatus: Story = {
  args: {
    ...Default.args,
    case: { ...mockCase, status: 'Active' },
  },
};

/**
 * On Hold case status
 */
export const OnHoldStatus: Story = {
  args: {
    ...Default.args,
    case: { ...mockCase, status: 'OnHold', title: 'Litigiu în Așteptare - ClientCo' },
  },
};

/**
 * Closed case status
 */
export const ClosedStatus: Story = {
  args: {
    ...Default.args,
    case: {
      ...mockCase,
      status: 'Closed',
      title: 'Contract Încheiat - PartnerCorp',
      closedDate: new Date(),
    },
  },
};

/**
 * Archived case status
 */
export const ArchivedStatus: Story = {
  args: {
    ...Default.args,
    case: { ...mockCase, status: 'Archived', title: 'Caz Arhivat - OldClient SRL' },
  },
};

/**
 * Litigation case type
 */
export const LitigationType: Story = {
  args: {
    ...Default.args,
    case: { ...mockCase, type: 'Litigation', title: 'Litigiu Comercial - Mega Corp' },
  },
};

/**
 * Criminal case type
 */
export const CriminalType: Story = {
  args: {
    ...Default.args,
    case: { ...mockCase, type: 'Criminal', title: 'Apărare Penală - Client Confidențial' },
  },
};

/**
 * With urgent deadline (< 3 days)
 */
export const UrgentDeadline: Story = {
  args: {
    ...Default.args,
    nextDeadline: urgentDeadline,
  },
};

/**
 * With large team (shows +N indicator)
 */
export const LargeTeam: Story = {
  args: {
    ...Default.args,
    teamMembers: [
      ...mockTeamMembers,
      {
        id: '4',
        email: 'elena.dumitrescu@example.com',
        firstName: 'Elena',
        lastName: 'Dumitrescu',
        role: 'Paralegal',
        firmId: 'firm-1',
        azureAdId: 'azure-4',
        preferences: {},
        createdAt: new Date(),
        lastActive: new Date(),
      },
      {
        id: '5',
        email: 'george.stan@example.com',
        firstName: 'George',
        lastName: 'Stan',
        role: 'Associate',
        firmId: 'firm-1',
        azureAdId: 'azure-5',
        preferences: {},
        createdAt: new Date(),
        lastActive: new Date(),
      },
      {
        id: '6',
        email: 'cristina.vasilescu@example.com',
        firstName: 'Cristina',
        lastName: 'Vasilescu',
        role: 'Paralegal',
        firmId: 'firm-1',
        azureAdId: 'azure-6',
        preferences: {},
        createdAt: new Date(),
        lastActive: new Date(),
      },
      {
        id: '7',
        email: 'mihai.rus@example.com',
        firstName: 'Mihai',
        lastName: 'Rus',
        role: 'Associate',
        firmId: 'firm-1',
        azureAdId: 'azure-7',
        preferences: {},
        createdAt: new Date(),
        lastActive: new Date(),
      },
    ],
  },
};

/**
 * Minimal - without team members and deadline
 */
export const Minimal: Story = {
  args: {
    case: mockCase,
    onEditCase: () => alert('Edit case clicked'),
    onAddTeamMember: () => alert('Add team member clicked'),
    onMenuAction: (action: any) => alert(`Menu action: ${action}`),
  },
};

/**
 * Romanian diacritics test
 */
export const RomanianDiacritics: Story = {
  args: {
    ...Default.args,
    case: {
      ...mockCase,
      title: 'Proces de Divorț - Divorțiați București',
      description: 'Caz cu caractere speciale: ă, â, î, ș, ț',
    },
    nextDeadline: {
      date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      description: 'Întâlnire cu judecătorul - Secția civilă',
    },
  },
};
