import type { Meta, StoryObj } from '@storybook/react';
import { TopBar } from './TopBar';
import { fn } from '@storybook/test';

/**
 * TopBar Component
 * Top navigation bar with search trigger, notifications, and user menu.
 * Fully supports Romanian diacritics (ă, â, î, ș, ț).
 *
 * ## Features
 * - Command palette trigger with Cmd+K keyboard shortcut
 * - Notifications badge with unread count
 * - User menu dropdown (Profile, Settings, Logout)
 * - Hamburger menu for mobile sidebar toggle
 * - Sticky positioning on scroll
 * - Responsive design
 *
 * ## Accessibility
 * - Keyboard navigation (Tab, Enter/Space, Escape)
 * - ARIA labels for icon buttons
 * - Focus visible states
 * - Screen reader announcements for unread count
 * - Proper semantic HTML
 */
const meta: Meta<typeof TopBar> = {
  title: 'Layout/TopBar',
  component: TopBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Top navigation bar with command palette trigger, notifications, and user menu. Supports Cmd+K keyboard shortcut.',
      },
    },
  },
  argTypes: {
    userName: {
      control: 'text',
      description: 'User display name',
    },
    userRole: {
      control: 'select',
      options: ['Partner', 'Associate', 'Paralegal'],
      description: 'User role for display',
    },
    unreadCount: {
      control: 'number',
      description: 'Unread notification count (shows badge when > 0)',
    },
    onLogout: {
      description: 'Callback when logout is clicked',
    },
    onProfile: {
      description: 'Callback when profile is clicked',
    },
    onSettings: {
      description: 'Callback when settings is clicked',
    },
    onNotificationsClick: {
      description: 'Callback when notifications icon is clicked',
    },
  },
};

export default meta;
type Story = StoryObj<typeof TopBar>;

/**
 * Default top bar state
 */
export const Default: Story = {
  args: {
    userName: 'Alexandru Popescu',
    userRole: 'Partner',
    unreadCount: 0,
    onLogout: fn(),
    onProfile: fn(),
    onSettings: fn(),
    onNotificationsClick: fn(),
  },
};

/**
 * Top bar with unread notifications
 */
export const WithNotifications: Story = {
  args: {
    userName: 'Maria Ionescu',
    userRole: 'Associate',
    unreadCount: 5,
    onLogout: fn(),
    onProfile: fn(),
    onSettings: fn(),
    onNotificationsClick: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Notification badge appears when unreadCount > 0. Badge shows count up to 99, then shows "99+"',
      },
    },
  },
};

/**
 * Top bar with many notifications
 */
export const ManyNotifications: Story = {
  args: {
    userName: 'Ion Georgescu',
    userRole: 'Paralegal',
    unreadCount: 127,
    onLogout: fn(),
    onProfile: fn(),
    onSettings: fn(),
    onNotificationsClick: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows "99+" for notification counts over 99',
      },
    },
  },
};

/**
 * Partner role view
 */
export const PartnerRole: Story = {
  args: {
    userName: 'Alexandru Popescu',
    userRole: 'Partner',
    unreadCount: 3,
    onLogout: fn(),
    onProfile: fn(),
    onSettings: fn(),
    onNotificationsClick: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Top bar for Partner role user',
      },
    },
  },
};

/**
 * Associate role view
 */
export const AssociateRole: Story = {
  args: {
    userName: 'Maria Ionescu',
    userRole: 'Associate',
    unreadCount: 2,
    onLogout: fn(),
    onProfile: fn(),
    onSettings: fn(),
    onNotificationsClick: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Top bar for Associate role user',
      },
    },
  },
};

/**
 * Paralegal role view
 */
export const ParalegalRole: Story = {
  args: {
    userName: 'Ion Georgescu',
    userRole: 'Paralegal',
    unreadCount: 1,
    onLogout: fn(),
    onProfile: fn(),
    onSettings: fn(),
    onNotificationsClick: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Top bar for Paralegal role user',
      },
    },
  },
};

/**
 * Romanian user name with diacritics
 */
export const RomanianName: Story = {
  args: {
    userName: 'Ștefan Țîrlea',
    userRole: 'Partner',
    unreadCount: 0,
    onLogout: fn(),
    onProfile: fn(),
    onSettings: fn(),
    onNotificationsClick: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates proper rendering of Romanian diacritics in user name: Ș, Ț, Î',
      },
    },
  },
};

/**
 * Long user name
 */
export const LongUserName: Story = {
  args: {
    userName: 'Alexandru-Cristian Popescu-Ionescu',
    userRole: 'Associate',
    unreadCount: 8,
    onLogout: fn(),
    onProfile: fn(),
    onSettings: fn(),
    onNotificationsClick: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests text truncation for long user names',
      },
    },
  },
};

/**
 * User menu open state (interactive)
 */
export const UserMenuOpen: Story = {
  args: {
    userName: 'Alexandru Popescu',
    userRole: 'Partner',
    unreadCount: 0,
    onLogout: fn(),
    onProfile: fn(),
    onSettings: fn(),
    onNotificationsClick: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Click on user avatar/name to open dropdown menu with Profile, Settings, and Logout options',
      },
    },
  },
};

/**
 * Mobile responsive view
 */
export const MobileView: Story = {
  args: {
    userName: 'Maria Ionescu',
    userRole: 'Associate',
    unreadCount: 3,
    onLogout: fn(),
    onProfile: fn(),
    onSettings: fn(),
    onNotificationsClick: fn(),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story:
          'Mobile view shows hamburger menu and may adjust spacing for smaller screens',
      },
    },
  },
};

/**
 * All interactive elements demo
 */
export const InteractiveDemo: Story = {
  args: {
    userName: 'Alexandru Popescu',
    userRole: 'Partner',
    unreadCount: 15,
    onLogout: fn(),
    onProfile: fn(),
    onSettings: fn(),
    onNotificationsClick: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Try clicking: hamburger menu, search button (or press Cmd+K), notifications icon, and user menu',
      },
    },
  },
};
