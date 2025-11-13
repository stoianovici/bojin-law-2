import type { Meta, StoryObj } from '@storybook/react';
import { PartnerDashboard } from './PartnerDashboard';

/**
 * PartnerDashboard displays firm-wide KPIs, billable hours chart, case distribution,
 * pending approvals, and AI suggestions tailored for Partner role.
 */
const meta: Meta<typeof PartnerDashboard> = {
  title: 'Dashboard/Pages/PartnerDashboard',
  component: PartnerDashboard,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof PartnerDashboard>;

export const Default: Story = {
  args: {},
};

export const Loading: Story = {
  render: () => (
    <div className="p-6">
      <div className="mb-4">
        <div className="h-8 w-48 bg-neutral-200 rounded animate-pulse"></div>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 h-32 bg-neutral-200 rounded-lg animate-pulse"></div>
        <div className="col-span-8 h-64 bg-neutral-200 rounded-lg animate-pulse"></div>
        <div className="col-span-4 h-64 bg-neutral-200 rounded-lg animate-pulse"></div>
        <div className="col-span-12 h-48 bg-neutral-200 rounded-lg animate-pulse"></div>
      </div>
    </div>
  ),
};

export const WithMockData: Story = {
  args: {},
};
