import type { Meta, StoryObj } from '@storybook/react';
import { FirmCasesOverviewWidget } from './FirmCasesOverviewWidget';
import {
  createFirmCasesOverviewWidget,
  generateAtRiskCases,
  generateHighValueCases,
  generateAIInsights,
} from '@legal-platform/test-utils';

/**
 * FirmCasesOverviewWidget displays overview of firm cases across three tabs:
 * - At Risk: Cases with approaching deadlines or overdue tasks
 * - High Value: Cases above monetary threshold with priority flags
 * - AI Insights: AI-detected patterns, bottlenecks, and opportunities
 */
const meta: Meta<typeof FirmCasesOverviewWidget> = {
  title: 'Dashboard/Widgets/FirmCasesOverviewWidget',
  component: FirmCasesOverviewWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof FirmCasesOverviewWidget>;

/**
 * Default state with all three tabs populated
 */
export const Default: Story = {
  args: {
    widget: createFirmCasesOverviewWidget(),
  },
};

/**
 * Loading state
 */
export const Loading: Story = {
  args: {
    widget: createFirmCasesOverviewWidget(),
    isLoading: true,
  },
  render: (args) => (
    <div className="animate-pulse">
      <div className="h-64 bg-neutral-200 rounded-lg"></div>
    </div>
  ),
};

/**
 * At Risk tab with multiple cases
 */
export const AtRiskTab: Story = {
  args: {
    widget: createFirmCasesOverviewWidget({
      atRiskCases: generateAtRiskCases(8),
      highValueCases: generateHighValueCases(2),
      aiInsights: generateAIInsights(3),
    }),
  },
};

/**
 * High Value tab with priority cases
 */
export const HighValueTab: Story = {
  args: {
    widget: createFirmCasesOverviewWidget({
      atRiskCases: generateAtRiskCases(3),
      highValueCases: generateHighValueCases(5),
      aiInsights: generateAIInsights(2),
    }),
  },
};

/**
 * AI Insights tab with patterns and opportunities
 */
export const AIInsightsTab: Story = {
  args: {
    widget: createFirmCasesOverviewWidget({
      atRiskCases: generateAtRiskCases(2),
      highValueCases: generateHighValueCases(1),
      aiInsights: generateAIInsights(6),
    }),
  },
};

/**
 * Empty At Risk tab
 */
export const EmptyAtRiskTab: Story = {
  args: {
    widget: createFirmCasesOverviewWidget({
      atRiskCases: [],
      highValueCases: generateHighValueCases(3),
      aiInsights: generateAIInsights(4),
    }),
  },
};

/**
 * Empty High Value tab
 */
export const EmptyHighValueTab: Story = {
  args: {
    widget: createFirmCasesOverviewWidget({
      atRiskCases: generateAtRiskCases(5),
      highValueCases: [],
      aiInsights: generateAIInsights(3),
    }),
  },
};

/**
 * Empty AI Insights tab
 */
export const EmptyAIInsightsTab: Story = {
  args: {
    widget: createFirmCasesOverviewWidget({
      atRiskCases: generateAtRiskCases(4),
      highValueCases: generateHighValueCases(2),
      aiInsights: [],
    }),
  },
};

/**
 * All tabs empty
 */
export const AllTabsEmpty: Story = {
  args: {
    widget: createFirmCasesOverviewWidget({
      atRiskCases: [],
      highValueCases: [],
      aiInsights: [],
    }),
  },
};

/**
 * Maximum data in all tabs
 */
export const MaximumData: Story = {
  args: {
    widget: createFirmCasesOverviewWidget({
      atRiskCases: generateAtRiskCases(15),
      highValueCases: generateHighValueCases(10),
      aiInsights: generateAIInsights(12),
    }),
  },
};

/**
 * Romanian language content
 */
export const RomanianContent: Story = {
  args: {
    widget: createFirmCasesOverviewWidget({
      title: 'Vedere de Ansamblu Cazuri Firmă',
    }),
  },
};

/**
 * Various case priorities
 */
export const VariousPriorities: Story = {
  args: {
    widget: createFirmCasesOverviewWidget({
      highValueCases: [
        ...generateHighValueCases(2).map(c => ({ ...c, priority: 'strategic' as const })),
        ...generateHighValueCases(2).map(c => ({ ...c, priority: 'vip' as const })),
        ...generateHighValueCases(1).map(c => ({ ...c, priority: 'highValue' as const })),
      ],
    }),
  },
};

/**
 * AI Insights with different types
 */
export const AIInsightTypes: Story = {
  args: {
    widget: createFirmCasesOverviewWidget({
      aiInsights: [
        ...generateAIInsights(2).map(i => ({ ...i, type: 'pattern' as const })),
        ...generateAIInsights(2).map(i => ({ ...i, type: 'bottleneck' as const })),
        ...generateAIInsights(2).map(i => ({ ...i, type: 'opportunity' as const })),
      ],
    }),
  },
};
