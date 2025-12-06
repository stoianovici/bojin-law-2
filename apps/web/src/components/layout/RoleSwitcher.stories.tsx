import type { Meta, StoryObj } from '@storybook/react';
import { RoleSwitcher } from './RoleSwitcher';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useNavigationStore } from '../../stores/navigation.store';
import { fn } from '@storybook/test';
import { useEffect } from 'react';
import type { UserRole } from '@legal-platform/types';

/**
 * Role Switcher Component
 * Dropdown selector for switching between user roles.
 *
 * ## Features
 * - Three role options: Partner, Associate, Paralegal
 * - Visual differentiation with colors and icons
 * - Current role displayed with icon badge
 * - Console notification on role switch
 * - localStorage persistence via navigation store
 * - Maintains current section when switching roles
 *
 * ## Accessibility
 * - Keyboard navigation (Tab, Enter/Space, Arrow keys, Escape)
 * - ARIA labels and roles
 * - Focus visible states
 * - Screen reader compatible
 * - Proper semantic select component
 */
const meta: Meta<typeof RoleSwitcher> = {
  title: 'Layout/RoleSwitcher',
  component: RoleSwitcher,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Role switcher dropdown for testing different role-based views. Changes persist to localStorage.',
      },
    },
  },
  decorators: [
    (Story: any, context: any) => {
      useEffect(() => {
        if (context.args.initialRole) {
          useNavigationStore.getState().setCurrentRole(context.args.initialRole as UserRole);
        }
      }, [context.args.initialRole]);

      return (
        <div className="p-4 max-w-xs">
          <Story />
        </div>
      );
    },
  ],
  argTypes: {
    onRoleChange: {
      description: 'Callback when role is changed',
    },
    initialRole: {
      control: 'select',
      options: ['Partner', 'Associate', 'Paralegal'],
      description: 'Initial role to display',
    },
  },
};

export default meta;
type Story = StoryObj<typeof RoleSwitcher> & {
  args?: {
    onRoleChange?: (role: UserRole) => void;
    initialRole?: UserRole;
  };
};

/**
 * Partner role selected
 */
export const PartnerSelected: Story = {
  args: {
    initialRole: 'Partner',
    onRoleChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Partner role with blue color scheme and 👔 icon. Has access to all navigation sections.',
      },
    },
  },
};

/**
 * Associate role selected
 */
export const AssociateSelected: Story = {
  args: {
    initialRole: 'Associate',
    onRoleChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Associate role with green color scheme and ⚖️ icon. Has access to all navigation sections.',
      },
    },
  },
};

/**
 * Paralegal role selected
 */
export const ParalegalSelected: Story = {
  args: {
    initialRole: 'Paralegal',
    onRoleChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Paralegal role with purple color scheme and 📋 icon. Does not have access to Reports section.',
      },
    },
  },
};

/**
 * Default state (Partner)
 */
export const Default: Story = {
  args: {
    onRoleChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Default state shows current role from navigation store',
      },
    },
  },
};

/**
 * Interactive role switching demo
 */
export const InteractiveSwitching: Story = {
  args: {
    initialRole: 'Partner',
    onRoleChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Click the dropdown to switch between roles. Notice the color and icon changes for each role.',
      },
    },
  },
};

/**
 * With custom callback
 */
export const WithCallback: Story = {
  args: {
    initialRole: 'Associate',
    onRoleChange: (role: UserRole) => {
      fn()(role);
      console.log(`Role changed to: ${role}`);
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates onRoleChange callback. Check the Actions panel and console when switching roles.',
      },
    },
  },
};

/**
 * Role colors comparison
 */
export const RoleColors: Story = {
  render: () => {
    const roles: UserRole[] = ['Partner', 'Associate', 'Paralegal'];
    return (
      <div className="flex flex-col gap-4">
        {roles.map((role) => {
          useEffect(() => {
            useNavigationStore.getState().setCurrentRole(role);
          }, []);

          return (
            <div key={role} className="flex items-center gap-4">
              <span className="w-24 text-sm font-medium">{role}:</span>
              <RoleSwitcher onRoleChange={fn()} />
            </div>
          );
        })}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Comparison of visual styles for all three roles: Partner (blue), Associate (green), Paralegal (purple)',
      },
    },
  },
};

/**
 * Compact layout
 */
export const CompactLayout: Story = {
  args: {
    initialRole: 'Partner',
    onRoleChange: fn(),
  },
  decorators: [
    (Story: any) => (
      <div className="p-2 w-48">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Role switcher in a compact layout (e.g., sidebar footer)',
      },
    },
  },
};

/**
 * Full width layout
 */
export const FullWidthLayout: Story = {
  args: {
    initialRole: 'Associate',
    onRoleChange: fn(),
  },
  decorators: [
    (Story: any) => (
      <div className="p-4 w-full max-w-md">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Role switcher taking full width of container',
      },
    },
  },
};

/**
 * In sidebar context
 */
export const InSidebarContext: Story = {
  args: {
    initialRole: 'Partner',
    onRoleChange: fn(),
  },
  decorators: [
    (Story: any) => (
      <div className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col">
        <div className="flex-1 p-4">
          <div className="text-sm text-gray-600 mb-4">Sidebar Content</div>
        </div>
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-2">Switch Role:</div>
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Role switcher as it appears in the sidebar footer',
      },
    },
  },
};
