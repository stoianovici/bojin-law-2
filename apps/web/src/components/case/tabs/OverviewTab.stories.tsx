/**
 * OverviewTab Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { OverviewTab } from './OverviewTab';
import { createCase, createUsers, createRecentActivity } from '@legal-platform/test-utils';
import type { DeadlineItem, CaseStats } from './OverviewTab';

const mockCase = createCase();
const mockTeamMembers = createUsers(4);
const mockRecentActivity = createRecentActivity(10);

const mockDeadlines: DeadlineItem[] = [
  {
    id: '1',
    title: 'Depunere răspuns la instanță',
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    status: 'upcoming',
  },
  {
    id: '2',
    title: 'Întâlnire cu clientul',
    date: new Date(),
    status: 'today',
  },
  {
    id: '3',
    title: 'Finalizare contract',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: 'overdue',
  },
];

const mockStats: CaseStats = {
  totalDocuments: 24,
  openTasks: 8,
  billableHours: 42.5,
};

const meta: Meta<typeof OverviewTab> = {
  title: 'Case/Tabs/OverviewTab',
  component: OverviewTab,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="h-screen overflow-auto bg-gray-50">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof OverviewTab>;

/**
 * Default overview with all information
 */
export const Default: Story = {
  args: {
    case: mockCase,
    teamMembers: mockTeamMembers,
    recentActivity: mockRecentActivity,
    upcomingDeadlines: mockDeadlines,
    stats: mockStats,
    onEditDetails: () => alert('Edit details'),
  },
};

/**
 * Minimal overview (no optional data)
 */
export const Minimal: Story = {
  args: {
    case: mockCase,
    onEditDetails: () => alert('Edit details'),
  },
};

/**
 * With team but no activity
 */
export const WithTeamOnly: Story = {
  args: {
    case: mockCase,
    teamMembers: mockTeamMembers,
    stats: mockStats,
    onEditDetails: () => alert('Edit details'),
  },
};

/**
 * Active case with deadlines
 */
export const ActiveWithDeadlines: Story = {
  args: {
    case: createCase({ status: 'Active' }),
    teamMembers: mockTeamMembers,
    recentActivity: mockRecentActivity,
    upcomingDeadlines: mockDeadlines,
    stats: mockStats,
    onEditDetails: () => alert('Edit details'),
  },
};

/**
 * Closed case
 */
export const ClosedCase: Story = {
  args: {
    case: createCase({ status: 'Closed', closedDate: new Date() }),
    teamMembers: mockTeamMembers,
    recentActivity: mockRecentActivity,
    upcomingDeadlines: [],
    stats: { ...mockStats, openTasks: 0 },
    onEditDetails: () => alert('Edit details'),
  },
};

/**
 * Large team
 */
export const LargeTeam: Story = {
  args: {
    case: mockCase,
    teamMembers: createUsers(10),
    recentActivity: mockRecentActivity,
    upcomingDeadlines: mockDeadlines,
    stats: mockStats,
    onEditDetails: () => alert('Edit details'),
  },
};

/**
 * Many recent activities
 */
export const ManyActivities: Story = {
  args: {
    case: mockCase,
    teamMembers: mockTeamMembers,
    recentActivity: createRecentActivity(20),
    upcomingDeadlines: mockDeadlines,
    stats: mockStats,
    onEditDetails: () => alert('Edit details'),
  },
};

/**
 * Romanian case with diacritics
 */
export const RomanianCase: Story = {
  args: {
    case: createCase({
      title: 'Divorț București - Secția Civilă',
      description:
        'Proces de divorț cu partaj al bunurilor comune și stabilirea custodiei copilului minor.',
      status: 'Active',
    }),
    teamMembers: mockTeamMembers,
    recentActivity: mockRecentActivity,
    upcomingDeadlines: mockDeadlines,
    stats: mockStats,
    onEditDetails: () => alert('Edit details'),
  },
};

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};
