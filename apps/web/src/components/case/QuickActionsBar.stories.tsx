/**
 * QuickActionsBar Storybook Stories
 * Floating AI pill design with collapsed/expanded states
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { QuickActionsBar } from './QuickActionsBar';

const meta: Meta<typeof QuickActionsBar> = {
  title: 'Case/QuickActionsBar',
  component: QuickActionsBar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="relative h-screen bg-gray-100">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Detalii Dosar</h1>
          <p className="text-gray-600">
            Click pe butonul &quot;Asistent AI&quot; din partea de jos pentru a deschide bara de
            acțiuni rapide.
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof QuickActionsBar>;

/**
 * Default state - floating pill (collapsed by default in real app,
 * but Storybook shows expanded for demo purposes based on store mock)
 */
export const Default: Story = {
  args: {
    onSubmit: (input: string) => {
      console.log('Submitted:', input);
      alert(`Comandă trimisă: "${input}"`);
    },
    onSuggestionClick: (suggestion: string) => {
      console.log('Suggestion clicked:', suggestion);
    },
  },
};

/**
 * With all handlers attached
 */
export const WithHandlers: Story = {
  args: {
    onSubmit: (input: string) => {
      console.log('Quick action submitted:', input);
      alert(`Ați trimis: "${input}"\n\nAceasta ar declanșa o acțiune AI în aplicația reală.`);
    },
    onSuggestionClick: (suggestion: string) => {
      console.log('Suggestion clicked:', suggestion);
    },
    onActionComplete: (result) => {
      console.log('Action completed:', result);
    },
  },
};

/**
 * Mobile viewport - pill design adapts nicely
 */
export const Mobile: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

/**
 * Tablet viewport
 */
export const Tablet: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};
