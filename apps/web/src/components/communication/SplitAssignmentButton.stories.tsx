import type { Meta, StoryObj } from '@storybook/react';
import { SplitAssignmentButton, type CaseSuggestion } from './SplitAssignmentButton';
import { useState } from 'react';

/**
 * SplitAssignmentButton Component
 * OPS-188: Split button for inline email-to-case assignment
 *
 * Displays case suggestions with 80/20 split layout and confidence-based
 * color coding:
 * - Cyan: High confidence (70%+)
 * - Yellow: Medium confidence (40-69%)
 * - Magenta: Low confidence (<40%)
 */
const meta: Meta<typeof SplitAssignmentButton> = {
  title: 'Communication/SplitAssignmentButton',
  component: SplitAssignmentButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] p-4 bg-gray-50 rounded-lg">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    onAssign: { action: 'assigned' },
    onPersonal: { action: 'personal' },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof SplitAssignmentButton>;

// Sample case data
const highConfidenceCase: CaseSuggestion = {
  id: 'case-1',
  title: 'Popescu v. Ionescu',
  confidence: 0.85,
  caseNumber: 'D-2024-0001',
};

const mediumConfidenceCase: CaseSuggestion = {
  id: 'case-2',
  title: 'SC Alpha SRL',
  confidence: 0.55,
  caseNumber: 'D-2024-0002',
};

const lowConfidenceCase: CaseSuggestion = {
  id: 'case-3',
  title: 'Beta Corporation',
  confidence: 0.25,
  caseNumber: 'D-2024-0003',
};

const allSuggestions: CaseSuggestion[] = [
  highConfidenceCase,
  mediumConfidenceCase,
  lowConfidenceCase,
  { id: 'case-4', title: 'Delta Trading SRL', confidence: 0.72, caseNumber: 'D-2024-0004' },
  { id: 'case-5', title: 'Gamma Industries', confidence: 0.38, caseNumber: 'D-2024-0005' },
];

/**
 * High confidence primary suggestion with medium confidence secondary.
 * Primary shows cyan, secondary shows yellow.
 */
export const HighConfidence: Story = {
  args: {
    primaryCase: highConfidenceCase,
    secondaryCase: mediumConfidenceCase,
    allSuggestions,
  },
};

/**
 * Medium confidence primary with low confidence secondary.
 * Primary shows yellow, secondary shows magenta.
 */
export const MediumConfidence: Story = {
  args: {
    primaryCase: mediumConfidenceCase,
    secondaryCase: lowConfidenceCase,
    allSuggestions,
  },
};

/**
 * Low confidence suggestions - both show magenta.
 */
export const LowConfidence: Story = {
  args: {
    primaryCase: lowConfidenceCase,
    secondaryCase: { ...mediumConfidenceCase, confidence: 0.22 },
    allSuggestions: allSuggestions.map((s) => ({ ...s, confidence: s.confidence * 0.4 })),
  },
};

/**
 * Single suggestion - renders as full-width button instead of split.
 */
export const SingleSuggestion: Story = {
  args: {
    primaryCase: highConfidenceCase,
    secondaryCase: undefined,
    allSuggestions: [highConfidenceCase],
  },
};

/**
 * With Personal contact option in dropdown.
 */
export const WithPersonalOption: Story = {
  args: {
    primaryCase: highConfidenceCase,
    secondaryCase: mediumConfidenceCase,
    allSuggestions,
    onPersonal: () => console.log('Personal clicked'),
  },
};

/**
 * Loading state - shows spinner and disables interaction.
 */
export const Loading: Story = {
  args: {
    primaryCase: highConfidenceCase,
    secondaryCase: mediumConfidenceCase,
    allSuggestions,
    loading: true,
  },
};

/**
 * Disabled state - grayed out, no interaction.
 */
export const Disabled: Story = {
  args: {
    primaryCase: highConfidenceCase,
    secondaryCase: mediumConfidenceCase,
    allSuggestions,
    disabled: true,
  },
};

/**
 * Long case titles - demonstrates truncation behavior.
 */
export const LongTitles: Story = {
  args: {
    primaryCase: {
      id: 'long-1',
      title: 'Societatea Comercială Foarte Lungă și Complicată SRL în Faliment',
      confidence: 0.82,
      caseNumber: 'D-2024-9999',
    },
    secondaryCase: {
      id: 'long-2',
      title: 'Alt Nume Extrem de Lung Pentru un Dosar',
      confidence: 0.45,
      caseNumber: 'D-2024-8888',
    },
    allSuggestions,
  },
};

/**
 * Interactive demo showing assignment flow.
 */
export const InteractiveDemo: Story = {
  render: function InteractiveDemoStory() {
    const [assignedCase, setAssignedCase] = useState<string | null>(null);
    const [isPersonal, setIsPersonal] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleAssign = (caseId: string) => {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setAssignedCase(caseId);
        setLoading(false);
      }, 1000);
    };

    const handlePersonal = () => {
      setLoading(true);
      setTimeout(() => {
        setIsPersonal(true);
        setLoading(false);
      }, 500);
    };

    if (isPersonal) {
      return (
        <div className="text-center p-4">
          <p className="text-sm text-gray-600">Expeditor marcat ca personal</p>
          <button
            onClick={() => setIsPersonal(false)}
            className="mt-2 text-blue-600 text-sm hover:underline"
          >
            Resetează
          </button>
        </div>
      );
    }

    if (assignedCase) {
      const assigned = allSuggestions.find((s) => s.id === assignedCase);
      return (
        <div className="text-center p-4">
          <p className="text-sm text-gray-600">
            Atribuit la: <span className="font-medium">{assigned?.title}</span>
          </p>
          <button
            onClick={() => setAssignedCase(null)}
            className="mt-2 text-blue-600 text-sm hover:underline"
          >
            Resetează
          </button>
        </div>
      );
    }

    return (
      <SplitAssignmentButton
        primaryCase={highConfidenceCase}
        secondaryCase={mediumConfidenceCase}
        allSuggestions={allSuggestions}
        onAssign={handleAssign}
        onPersonal={handlePersonal}
        loading={loading}
      />
    );
  },
};

/**
 * All confidence levels side by side.
 */
export const AllConfidenceLevels: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-500 mb-2">High Confidence (70%+) - Cyan</p>
        <SplitAssignmentButton
          primaryCase={highConfidenceCase}
          secondaryCase={mediumConfidenceCase}
          onAssign={() => {}}
        />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-2">Medium Confidence (40-69%) - Yellow</p>
        <SplitAssignmentButton
          primaryCase={mediumConfidenceCase}
          secondaryCase={lowConfidenceCase}
          onAssign={() => {}}
        />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-2">Low Confidence (&lt;40%) - Magenta</p>
        <SplitAssignmentButton
          primaryCase={lowConfidenceCase}
          secondaryCase={{ ...highConfidenceCase, confidence: 0.15 }}
          onAssign={() => {}}
        />
      </div>
    </div>
  ),
};

/**
 * All states demonstration.
 */
export const AllStates: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-500 mb-2">Default</p>
        <SplitAssignmentButton
          primaryCase={highConfidenceCase}
          secondaryCase={mediumConfidenceCase}
          onAssign={() => {}}
        />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-2">Single Suggestion</p>
        <SplitAssignmentButton primaryCase={highConfidenceCase} onAssign={() => {}} />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-2">Loading</p>
        <SplitAssignmentButton
          primaryCase={highConfidenceCase}
          secondaryCase={mediumConfidenceCase}
          onAssign={() => {}}
          loading
        />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-2">Disabled</p>
        <SplitAssignmentButton
          primaryCase={highConfidenceCase}
          secondaryCase={mediumConfidenceCase}
          onAssign={() => {}}
          disabled
        />
      </div>
    </div>
  ),
};
