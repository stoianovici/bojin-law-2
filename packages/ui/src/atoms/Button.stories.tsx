import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

/**
 * Button component with multiple variants and states.
 * Fully supports Romanian diacritics (ă, â, î, ș, ț).
 *
 * ## Accessibility
 * - Keyboard navigation supported (Enter/Space to activate)
 * - Focus visible states for keyboard users
 * - Disabled buttons are not focusable
 * - Loading state communicated via aria-busy
 * - Proper ARIA attributes for screen readers
 */
const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost'],
      description: 'Visual style of the button',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size of the button',
    },
    loading: {
      control: 'boolean',
      description: 'Shows loading spinner and disables interaction',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the button',
    },
    children: {
      control: 'text',
      description: 'Button content',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

/**
 * Primary button for main actions
 */
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Salvează',
  },
};

/**
 * Secondary button for less prominent actions
 */
export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Anulează',
  },
};

/**
 * Ghost button for tertiary actions
 */
export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Închide',
  },
};

/**
 * Small size button
 */
export const SmallSize: Story = {
  args: {
    size: 'sm',
    children: 'Buton mic',
  },
};

/**
 * Large size button
 */
export const LargeSize: Story = {
  args: {
    size: 'lg',
    children: 'Buton mare',
  },
};

/**
 * Button in loading state
 */
export const Loading: Story = {
  args: {
    loading: true,
    children: 'Se încarcă...',
  },
};

/**
 * Disabled button
 */
export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Dezactivat',
  },
};

/**
 * Button with Romanian diacritics
 */
export const RomanianText: Story = {
  args: {
    children: 'Șeful a vândut o sticlă în oraș și țară',
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates proper rendering of all Romanian diacritics: ă, â, î, ș, ț',
      },
    },
  },
};

/**
 * All variants side by side
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

/**
 * All sizes side by side
 */
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Mic</Button>
      <Button size="md">Mediu</Button>
      <Button size="lg">Mare</Button>
    </div>
  ),
};

/**
 * All states demonstration
 */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <Button>Default</Button>
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </div>
    </div>
  ),
};
