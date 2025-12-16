import type { Meta, StoryObj } from '@storybook/react';
import { FirmKPIsWidget } from './FirmKPIsWidget';
import { createKPIMetric } from '@legal-platform/test-utils';

/**
 * FirmKPIsWidget displays key performance indicators for the firm.
 * Shows metrics like Active Cases, Billable Hours, Revenue Target Progress, and Team Utilization.
 */
const meta: Meta<typeof FirmKPIsWidget> = {
  title: 'Dashboard/Widgets/FirmKPIsWidget',
  component: FirmKPIsWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof FirmKPIsWidget>;

export const Default: Story = {
  args: {},
};

export const Loading: Story = {
  render: () => (
    <div className="animate-pulse">
      <div className="h-48 bg-neutral-200 rounded-lg"></div>
    </div>
  ),
};

export const WithMockData: Story = {
  render: () => {
    const mockKPIs = [
      createKPIMetric(
        { label: 'Cazuri Active', value: 127, trend: 'up', trendPercentage: 12 },
        true
      ),
      createKPIMetric(
        { label: 'Ore Facturabile', value: 2340, trend: 'up', trendPercentage: 8 },
        true
      ),
      createKPIMetric(
        { label: 'Progres Țintă Venit', value: '92%', trend: 'up', trendPercentage: 5 },
        true
      ),
      createKPIMetric(
        { label: 'Utilizare Echipă', value: '87%', trend: 'down', trendPercentage: 3 },
        true
      ),
    ];
    return <FirmKPIsWidget />;
  },
};

export const EmptyState: Story = {
  render: () => (
    <div className="flex items-center justify-center h-48 bg-neutral-50 rounded-lg border-2 border-dashed border-neutral-300">
      <p className="text-neutral-500">Nu există date KPI disponibile</p>
    </div>
  ),
};
