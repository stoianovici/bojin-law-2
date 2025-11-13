import type { Meta, StoryObj } from '@storybook/react';
import { Sidebar } from './Sidebar';
import { useNavigationStore } from '@/stores/navigation.store';
import { useEffect } from 'react';

/**
 * Sidebar Navigation Component
 * Main navigation bar with collapse/expand functionality.
 * Fully supports Romanian diacritics (ă, â, î, ș, ț).
 *
 * ## Features
 * - Role-based navigation item filtering
 * - Active state highlighting
 * - Collapse/expand animation
 * - Responsive behavior (auto-collapse on tablet/mobile)
 * - Romanian language support
 *
 * ## Accessibility
 * - ARIA landmarks (navigation role)
 * - Keyboard navigation (Tab, Enter/Space)
 * - aria-current for active page
 * - Focus visible states
 * - Tooltips when collapsed
 */
const meta: Meta<typeof Sidebar> = {
  title: 'Layout/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Sidebar navigation component with role-based filtering and responsive behavior. Supports Romanian diacritics.',
      },
    },
  },
  decorators: [
    (Story, context) => {
      // Reset store state before each story
      useEffect(() => {
        const { setCurrentRole, setCurrentSection, isSidebarCollapsed } =
          useNavigationStore.getState();
        if (context.args.role) {
          setCurrentRole(context.args.role as any);
        }
        if (context.args.section) {
          setCurrentSection(context.args.section as any);
        }
      }, [context.args]);

      return (
        <div className="h-screen">
          <Story />
        </div>
      );
    },
  ],
  argTypes: {
    role: {
      control: 'select',
      options: ['Partner', 'Associate', 'Paralegal'],
      description: 'Current user role - filters navigation items',
    },
    section: {
      control: 'select',
      options: [
        'dashboard',
        'cases',
        'documents',
        'tasks',
        'communications',
        'time-tracking',
        'reports',
      ],
      description: 'Current active section',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Sidebar> & {
  args?: {
    role?: 'Partner' | 'Associate' | 'Paralegal';
    section?: string;
  };
};

/**
 * Default sidebar state for Partner role
 */
export const Default: Story = {
  args: {
    role: 'Partner',
    section: 'dashboard',
  },
};

/**
 * Sidebar with Cases section active
 */
export const CasesActive: Story = {
  args: {
    role: 'Partner',
    section: 'cases',
  },
  parameters: {
    docs: {
      description: {
        story: 'Active state on Cases section with blue highlight',
      },
    },
  },
};

/**
 * Sidebar with Documents section active
 */
export const DocumentsActive: Story = {
  args: {
    role: 'Associate',
    section: 'documents',
  },
};

/**
 * Sidebar with Tasks section active
 */
export const TasksActive: Story = {
  args: {
    role: 'Paralegal',
    section: 'tasks',
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates Romanian diacritic "Sarcini" (Tasks)',
      },
    },
  },
};

/**
 * Sidebar with Communications section active
 */
export const CommunicationsActive: Story = {
  args: {
    role: 'Associate',
    section: 'communications',
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates Romanian diacritic "Comunicări" (Communications)',
      },
    },
  },
};

/**
 * Sidebar with Time Tracking section active
 */
export const TimeTrackingActive: Story = {
  args: {
    role: 'Associate',
    section: 'time-tracking',
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows "Pontaj" (Time Tracking) in Romanian',
      },
    },
  },
};

/**
 * Sidebar with Reports section active (Partner view)
 */
export const ReportsActive: Story = {
  args: {
    role: 'Partner',
    section: 'reports',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reports section visible only for Partner and Associate roles, demonstrates Romanian "Rapoarte"',
      },
    },
  },
};

/**
 * Partner role view - all navigation items visible
 */
export const PartnerView: Story = {
  args: {
    role: 'Partner',
    section: 'dashboard',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Partner role has access to all navigation items including Reports',
      },
    },
  },
};

/**
 * Associate role view - all navigation items visible
 */
export const AssociateView: Story = {
  args: {
    role: 'Associate',
    section: 'dashboard',
  },
  parameters: {
    docs: {
      description: {
        story: 'Associate role has access to all navigation items',
      },
    },
  },
};

/**
 * Paralegal role view - Reports section filtered out
 */
export const ParalegalView: Story = {
  args: {
    role: 'Paralegal',
    section: 'dashboard',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Paralegal role does not have access to Reports section - demonstrates role-based filtering',
      },
    },
  },
};

/**
 * Collapsed sidebar state
 */
export const Collapsed: Story = {
  args: {
    role: 'Partner',
    section: 'cases',
  },
  decorators: [
    (Story) => {
      useEffect(() => {
        useNavigationStore.setState({ isSidebarCollapsed: true });
        return () => {
          useNavigationStore.setState({ isSidebarCollapsed: false });
        };
      }, []);
      return (
        <div className="h-screen">
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Collapsed sidebar shows only icons with tooltips on hover. Width reduces to 64px.',
      },
    },
  },
};

/**
 * Expanded sidebar state (default)
 */
export const Expanded: Story = {
  args: {
    role: 'Partner',
    section: 'dashboard',
  },
  decorators: [
    (Story) => {
      useEffect(() => {
        useNavigationStore.setState({ isSidebarCollapsed: false });
      }, []);
      return (
        <div className="h-screen">
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'Expanded sidebar shows icons and labels. Width is 256px.',
      },
    },
  },
};

/**
 * Romanian text examples
 */
export const RomanianDiacritics: Story = {
  args: {
    role: 'Partner',
    section: 'communications',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates proper rendering of Romanian diacritics in navigation labels: Cazuri, Documente, Sarcini, Comunicări, Pontaj, Rapoarte',
      },
    },
  },
};
