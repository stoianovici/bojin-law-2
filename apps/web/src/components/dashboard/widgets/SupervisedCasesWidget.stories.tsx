import type { Meta, StoryObj } from '@storybook/react';
import { SupervisedCasesWidget } from './SupervisedCasesWidget';
import { createSupervisedCasesWidget } from '@legal-platform/test-utils';

/**
 * SupervisedCasesWidget displays cases where the partner is supervisor/lead.
 * Shows case number, title, client name, team size, risk level, status, and next deadline.
 * Cases are sorted by risk level (high first) and then by next deadline.
 */
const meta: Meta<typeof SupervisedCasesWidget> = {
  title: 'Dashboard/Widgets/SupervisedCasesWidget',
  component: SupervisedCasesWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof SupervisedCasesWidget>;

/**
 * Default state with mock supervised cases
 */
export const Default: Story = {
  args: {
    widget: createSupervisedCasesWidget(),
  },
};

/**
 * Loading state with skeleton placeholders
 */
export const Loading: Story = {
  args: {
    widget: createSupervisedCasesWidget(),
    isLoading: true,
  },
  render: (args) => (
    <div className="animate-pulse space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-24 bg-neutral-200 rounded-lg"></div>
      ))}
    </div>
  ),
};

/**
 * Widget with 3 supervised cases
 */
export const With3Cases: Story = {
  args: {
    widget: createSupervisedCasesWidget({
      cases: createSupervisedCasesWidget().cases.slice(0, 3),
    }),
  },
};

/**
 * Widget with 10 supervised cases
 */
export const With10Cases: Story = {
  args: {
    widget: createSupervisedCasesWidget({
      cases: Array.from({ length: 10 }, (_, i) => ({
        ...createSupervisedCasesWidget().cases[0],
        id: `case-${i}`,
        caseNumber: `C-${1000 + i}`,
      })),
    }),
  },
};

/**
 * Widget with 20+ supervised cases (scrollable)
 */
export const With20PlusCases: Story = {
  args: {
    widget: createSupervisedCasesWidget({
      cases: Array.from({ length: 25 }, (_, i) => ({
        ...createSupervisedCasesWidget().cases[0],
        id: `case-${i}`,
        caseNumber: `C-${1000 + i}`,
      })),
    }),
  },
};

/**
 * High risk cases only
 */
export const HighRiskOnly: Story = {
  args: {
    widget: createSupervisedCasesWidget({
      cases: Array.from({ length: 5 }, (_, i) => ({
        ...createSupervisedCasesWidget().cases[0],
        id: `case-${i}`,
        caseNumber: `C-${2000 + i}`,
        riskLevel: 'high' as const,
      })),
    }),
  },
};

/**
 * Medium risk cases only
 */
export const MediumRiskOnly: Story = {
  args: {
    widget: createSupervisedCasesWidget({
      cases: Array.from({ length: 5 }, (_, i) => ({
        ...createSupervisedCasesWidget().cases[0],
        id: `case-${i}`,
        caseNumber: `C-${3000 + i}`,
        riskLevel: 'medium' as const,
      })),
    }),
  },
};

/**
 * Low risk cases only
 */
export const LowRiskOnly: Story = {
  args: {
    widget: createSupervisedCasesWidget({
      cases: Array.from({ length: 5 }, (_, i) => ({
        ...createSupervisedCasesWidget().cases[0],
        id: `case-${i}`,
        caseNumber: `C-${4000 + i}`,
        riskLevel: 'low' as const,
      })),
    }),
  },
};

/**
 * All status types displayed
 */
export const AllStatusTypes: Story = {
  args: {
    widget: createSupervisedCasesWidget({
      cases: [
        {
          ...createSupervisedCasesWidget().cases[0],
          id: 'case-1',
          caseNumber: 'C-5001',
          status: 'Active',
          riskLevel: 'high' as const,
        },
        {
          ...createSupervisedCasesWidget().cases[0],
          id: 'case-2',
          caseNumber: 'C-5002',
          status: 'OnHold',
          riskLevel: 'medium' as const,
        },
        {
          ...createSupervisedCasesWidget().cases[0],
          id: 'case-3',
          caseNumber: 'C-5003',
          status: 'Closed',
          riskLevel: 'low' as const,
        },
        {
          ...createSupervisedCasesWidget().cases[0],
          id: 'case-4',
          caseNumber: 'C-5004',
          status: 'Archived',
          riskLevel: 'low' as const,
        },
      ],
    }),
  },
};

/**
 * Empty state with no supervised cases
 */
export const EmptyState: Story = {
  args: {
    widget: createSupervisedCasesWidget({
      cases: [],
    }),
  },
};

/**
 * Romanian language content
 */
export const RomanianContent: Story = {
  args: {
    widget: createSupervisedCasesWidget({
      title: 'Cazuri Supravegheate',
      cases: [
        {
          ...createSupervisedCasesWidget().cases[0],
          id: 'case-1',
          caseNumber: 'C-6001',
          title: 'Litigiu de Muncă - Concediere Abuzivă',
          clientName: 'Ștefan Popescu',
        },
        {
          ...createSupervisedCasesWidget().cases[0],
          id: 'case-2',
          caseNumber: 'C-6002',
          title: 'Consultanță Fiscală și Juridică',
          clientName: 'SC Țîrlea & Asociații SRL',
        },
      ],
    }),
  },
};
