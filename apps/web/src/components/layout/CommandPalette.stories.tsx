import type { Meta, StoryObj } from '@storybook/react';
import { CommandPalette } from './CommandPalette';
import { useNavigationStore } from '@/stores/navigation.store';
import { useEffect } from 'react';

/**
 * Command Palette Component
 * Quick navigation and action modal with keyboard shortcuts.
 * Fully supports Romanian diacritics (ă, â, î, ș, ț).
 *
 * ## Features
 * - Real-time search filtering
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Cmd+K / Ctrl+K to open
 * - Navigation commands (Go to Dashboard, Cases, etc.)
 * - Action commands (Create Case, Document, Task)
 * - Romanian keyword search support
 * - Backdrop blur effect
 *
 * ## Accessibility
 * - Focus trap in modal
 * - Keyboard-only navigation
 * - ARIA labels and roles
 * - Screen reader compatible
 * - Escape to close
 */
const meta: Meta<typeof CommandPalette> = {
  title: 'Layout/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Command palette modal for quick navigation and actions. Opens with Cmd+K keyboard shortcut.',
      },
    },
  },
  decorators: [
    (Story, context) => {
      useEffect(() => {
        // Open command palette for stories
        if (context.args.open) {
          useNavigationStore.getState().openCommandPalette();
        } else {
          useNavigationStore.getState().closeCommandPalette();
        }
      }, [context.args.open]);

      return (
        <div className="h-screen bg-gray-50 p-8">
          <div className="text-sm text-gray-600 mb-4">
            Press Cmd+K (Mac) or Ctrl+K (Windows) to open command palette
          </div>
          <Story />
        </div>
      );
    },
  ],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Whether the command palette is open',
    },
  },
};

export default meta;
type Story = StoryObj<typeof CommandPalette> & {
  args?: {
    open?: boolean;
  };
};

/**
 * Command palette open state
 */
export const Open: Story = {
  args: {
    open: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Command palette in open state. Shows all available commands. Use arrow keys to navigate, Enter to select, Escape to close.',
      },
    },
  },
};

/**
 * Closed state (default)
 */
export const Closed: Story = {
  args: {
    open: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Command palette closed. Press Cmd+K or Ctrl+K to open. Click the story to focus it first.',
      },
    },
  },
};

/**
 * With search query - navigation commands
 */
export const SearchNavigation: Story = {
  args: {
    open: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Type "dashboard", "cases", "documents", or "tasks" to filter navigation commands',
      },
    },
  },
};

/**
 * With search query - action commands
 */
export const SearchActions: Story = {
  args: {
    open: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Type "create" or "new" to filter action commands (Create Case, Document, Task)',
      },
    },
  },
};

/**
 * Empty search results
 */
export const EmptyState: Story = {
  args: {
    open: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Type a query that matches no commands (e.g., "xyz") to see empty state',
      },
    },
  },
};

/**
 * Romanian keyword search
 */
export const RomanianSearch: Story = {
  args: {
    open: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Type Romanian keywords like "cazuri" (cases), "documente" (documents), or "sarcini" (tasks) to test diacritic support',
      },
    },
  },
};

/**
 * Navigation commands only
 */
export const NavigationCommands: Story = {
  args: {
    open: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows navigation commands: Dashboard, Cases, Documents, Tasks, Communications, Time Tracking, Reports',
      },
    },
  },
};

/**
 * Action commands
 */
export const ActionCommands: Story = {
  args: {
    open: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows action commands: Create New Case, Create Document, Add Task',
      },
    },
  },
};

/**
 * Keyboard navigation demo
 */
export const KeyboardNavigation: Story = {
  args: {
    open: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Try keyboard navigation: ↑/↓ arrows to select, Enter to activate, Escape to close',
      },
    },
  },
};

/**
 * Mobile view
 */
export const MobileView: Story = {
  args: {
    open: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Command palette adapts to full-screen on mobile devices',
      },
    },
  },
};

/**
 * Tablet view
 */
export const TabletView: Story = {
  args: {
    open: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
    docs: {
      description: {
        story: 'Command palette on tablet-sized screens',
      },
    },
  },
};

/**
 * Interactive demo
 */
export const InteractiveDemo: Story = {
  args: {
    open: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Click the story canvas, then press Cmd+K (Mac) or Ctrl+K (Windows) to open. Try searching and navigating with keyboard.',
      },
    },
  },
};

/**
 * With backdrop blur
 */
export const WithBackdrop: Story = {
  args: {
    open: true,
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">Content 1</div>
          <div className="bg-white p-4 rounded-lg shadow">Content 2</div>
          <div className="bg-white p-4 rounded-lg shadow">Content 3</div>
        </div>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates backdrop blur effect over page content when command palette is open',
      },
    },
  },
};
