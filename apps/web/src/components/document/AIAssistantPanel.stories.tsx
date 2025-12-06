import type { Meta, StoryObj } from '@storybook/react';
import { AIAssistantPanel } from './AIAssistantPanel';
import { action } from '@storybook/addon-actions';

/**
 * AIAssistantPanel provides AI-powered suggestions, similar documents, and templates.
 * Features tabbed interface with three tabs: Sugestii, Documente, Șabloane.
 * Panel can be collapsed to maximize editor space.
 */
const meta: Meta<typeof AIAssistantPanel> = {
  title: 'Document/AIAssistantPanel',
  component: AIAssistantPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof AIAssistantPanel>;

/**
 * Default expanded state with mock AI suggestions
 */
export const Default: Story = {
  args: {
    isCollapsed: false,
    onToggleCollapse: action('toggle-collapse'),
  },
};

/**
 * Collapsed state showing vertical toggle button
 */
export const Collapsed: Story = {
  args: {
    isCollapsed: true,
    onToggleCollapse: action('toggle-collapse'),
  },
};

/**
 * Expanded panel showing Sugestii (Suggestions) tab
 */
export const SuggestionsTab: Story = {
  args: {
    isCollapsed: false,
    onToggleCollapse: action('toggle-collapse'),
  },
  render: (args: { isCollapsed: boolean; onToggleCollapse: () => void }) => {
    const [isCollapsed, setIsCollapsed] = React.useState(args.isCollapsed);
    return (
      <div className="h-[600px]">
        <AIAssistantPanel
          {...args}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => {
            setIsCollapsed(!isCollapsed);
            action('toggle-collapse')();
          }}
        />
      </div>
    );
  },
};

/**
 * Panel showing Documente (Similar Documents) tab
 * Displays 5 similar documents with similarity scores
 */
export const DocumentsTab: Story = {
  args: {
    isCollapsed: false,
    onToggleCollapse: action('toggle-collapse'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Switch to Documente tab to view 5 similar documents with similarity percentages',
      },
    },
  },
};

/**
 * Panel showing Șabloane (Templates) tab
 * Displays 6 document templates in grid layout
 */
export const TemplatesTab: Story = {
  args: {
    isCollapsed: false,
    onToggleCollapse: action('toggle-collapse'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Switch to Șabloane tab to view 6 document templates in 2-column grid',
      },
    },
  },
};

/**
 * Panel with interactive collapse/expand toggle
 */
export const InteractiveToggle: Story = {
  args: {
    isCollapsed: false,
    onToggleCollapse: () => {
      action('toggle-collapse')();
      console.log('Panel toggled');
    },
  },
  render: (args: { isCollapsed: boolean; onToggleCollapse?: () => void }) => {
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    return (
      <div className="h-[600px] flex">
        <div className="flex-1 bg-gray-100 flex items-center justify-center">
          <p className="text-gray-600">Editor area (toggle panel to see effect)</p>
        </div>
        <AIAssistantPanel
          {...args}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => {
            setIsCollapsed(!isCollapsed);
            args.onToggleCollapse?.();
          }}
        />
      </div>
    );
  },
};

/**
 * Empty state for Sugestii tab
 * Shows when no AI suggestions are available
 */
export const EmptySuggestions: Story = {
  args: {
    isCollapsed: false,
    onToggleCollapse: action('toggle-collapse'),
  },
  render: (args: Record<string, unknown>) => {
    // Mock component with empty suggestions
    const EmptyPanel = () => {
      return (
        <div className="h-[600px] flex flex-col bg-white border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900">Asistent AI</h2>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <svg
              className="w-16 h-16 text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              Nu există sugestii disponibile
            </h3>
            <p className="text-xs text-gray-500">
              Începe să scrii pentru a primi sugestii AI
            </p>
          </div>
        </div>
      );
    };
    return <EmptyPanel />;
  },
};

/**
 * Romanian diacritics rendering test
 * Verifies all tab labels and content display Romanian characters correctly
 */
export const RomanianDiacritics: Story = {
  args: {
    isCollapsed: false,
    onToggleCollapse: action('toggle-collapse'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Verify Romanian diacritics in: Sugestii, Documente, Șabloane tabs and all content (ă, â, î, ș, ț)',
      },
    },
  },
};

/**
 * Mobile responsive view - single column layout
 */
export const MobileView: Story = {
  args: {
    isCollapsed: false,
    onToggleCollapse: action('toggle-collapse'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

/**
 * Tablet responsive view
 */
export const TabletView: Story = {
  args: {
    isCollapsed: false,
    onToggleCollapse: action('toggle-collapse'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

/**
 * Full height panel demonstration
 */
export const FullHeight: Story = {
  args: {
    isCollapsed: false,
    onToggleCollapse: action('toggle-collapse'),
  },
  render: (args: { isCollapsed: boolean; onToggleCollapse: () => void }) => (
    <div className="h-[800px]">
      <AIAssistantPanel {...args} />
    </div>
  ),
};

// Import React for useState hook in stories
import React from 'react';
