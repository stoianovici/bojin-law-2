import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';
import { Button } from './Button';

/**
 * Card component with header, body, and footer composition.
 * Supports multiple variants for different visual styles.
 */
const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'elevated', 'outlined'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: 'Acesta este conținutul cardului.',
  },
};

export const WithHeader: Story = {
  args: {
    header: <h3 className="text-lg font-semibold">Titlu Card</h3>,
    children: 'Conținutul cardului cu antet.',
  },
};

export const WithFooter: Story = {
  args: {
    children: 'Conținutul cardului cu subsol.',
    footer: (
      <div className="flex gap-2">
        <Button size="sm">Salvează</Button>
        <Button size="sm" variant="ghost">
          Anulează
        </Button>
      </div>
    ),
  },
};

export const Complete: Story = {
  args: {
    header: <h3 className="text-lg font-semibold">Card complet</h3>,
    children: (
      <p className="text-neutral-600">
        Acesta este un card complet cu antet, conținut și subsol. Șeful a vândut o sticlă în oraș și
        țară.
      </p>
    ),
    footer: (
      <div className="flex justify-between items-center">
        <span className="text-sm text-neutral-500">12 Noiembrie 2025</span>
        <Button size="sm">Citește mai mult</Button>
      </div>
    ),
  },
};

export const Elevated: Story = {
  args: {
    variant: 'elevated',
    header: <h3 className="text-lg font-semibold">Card ridicat</h3>,
    children: 'Card cu umbră pentru a crea profunzime.',
  },
};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    header: <h3 className="text-lg font-semibold">Card cu contur</h3>,
    children: 'Card cu contur mai pronunțat.',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <Card variant="default">
        <p className="font-medium">Default</p>
        <p className="text-sm text-neutral-600">Variant standard</p>
      </Card>
      <Card variant="elevated">
        <p className="font-medium">Elevated</p>
        <p className="text-sm text-neutral-600">Cu umbră</p>
      </Card>
      <Card variant="outlined">
        <p className="font-medium">Outlined</p>
        <p className="text-sm text-neutral-600">Cu contur</p>
      </Card>
    </div>
  ),
};
