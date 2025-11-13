import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from './Tooltip';
import { Button } from './Button';

const meta: Meta<typeof Tooltip> = {
  title: 'Components/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  args: {
    content: 'Salvați modificările',
    children: <Button>Salvează</Button>,
  },
};

export const Positions: Story = {
  render: () => (
    <div className="flex gap-4 justify-center items-center min-h-[200px]">
      <Tooltip content="Sus" position="top">
        <Button>Top</Button>
      </Tooltip>
      <Tooltip content="Jos" position="bottom">
        <Button>Bottom</Button>
      </Tooltip>
      <Tooltip content="Stânga" position="left">
        <Button>Left</Button>
      </Tooltip>
      <Tooltip content="Dreapta" position="right">
        <Button>Right</Button>
      </Tooltip>
    </div>
  ),
};
