import type { Meta, StoryObj } from '@storybook/react';
import { WidgetContainer } from './WidgetContainer';

/**
 * WidgetContainer is the base wrapper component for all dashboard widgets.
 * Provides header with title, icon, action menu, hover states, and loading skeleton.
 */
const meta: Meta<typeof WidgetContainer> = {
  title: 'Dashboard/WidgetContainer',
  component: WidgetContainer,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof WidgetContainer>;

export const Default: Story = {
  args: {
    title: 'Widget Example',
    children: (
      <div className="p-4">
        <p className="text-neutral-600">Acesta este conținutul widget-ului.</p>
      </div>
    ),
  },
};

export const WithIcon: Story = {
  args: {
    title: 'KPI-uri Firmă',
    icon: '📊',
    children: (
      <div className="p-4">
        <p className="text-neutral-600">Widget cu iconiță în antet.</p>
      </div>
    ),
  },
};

export const WithActionMenu: Story = {
  args: {
    title: 'Cazuri Active',
    showActions: true,
    onRefresh: () => console.log('Refresh clicked'),
    onConfigure: () => console.log('Configure clicked'),
    onRemove: () => console.log('Remove clicked'),
    children: (
      <div className="p-4">
        <p className="text-neutral-600">Widget cu meniu de acțiuni (cele trei puncte).</p>
      </div>
    ),
  },
};

export const Loading: Story = {
  args: {
    title: 'Se încarcă...',
    loading: true,
    children: (
      <div className="animate-pulse space-y-3 p-4">
        <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
        <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
        <div className="h-4 bg-neutral-200 rounded w-5/6"></div>
      </div>
    ),
  },
};

export const HoverState: Story = {
  args: {
    title: 'Documente Recente',
    children: (
      <div className="p-4">
        <p className="text-neutral-600">Treceți cursorul pentru a vedea efectul de umbră ridicată.</p>
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Widget-ul are o tranziție de umbră (shadow-md → shadow-lg) la hover.',
      },
    },
  },
};

export const Elevated: Story = {
  args: {
    title: 'Widget Ridicat',
    elevated: true,
    children: (
      <div className="p-4">
        <p className="text-neutral-600">Widget cu umbră ridicată permanentă.</p>
      </div>
    ),
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      <WidgetContainer title="Standard">
        <div className="p-4">
          <p className="text-sm text-neutral-600">Widget standard</p>
        </div>
      </WidgetContainer>

      <WidgetContainer title="Cu Iconiță" icon="📈">
        <div className="p-4">
          <p className="text-sm text-neutral-600">Cu iconiță în antet</p>
        </div>
      </WidgetContainer>

      <WidgetContainer title="Cu Acțiuni" showActions onRefresh={() => {}} onConfigure={() => {}} onRemove={() => {}}>
        <div className="p-4">
          <p className="text-sm text-neutral-600">Cu meniu acțiuni</p>
        </div>
      </WidgetContainer>

      <WidgetContainer title="Ridicat" elevated>
        <div className="p-4">
          <p className="text-sm text-neutral-600">Cu umbră ridicată</p>
        </div>
      </WidgetContainer>
    </div>
  ),
};
