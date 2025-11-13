import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from './Textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Components/Textarea',
  component: Textarea,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: {
    label: 'Descriere',
    placeholder: 'Introduceți descrierea...',
  },
};

export const WithError: Story = {
  args: {
    label: 'Comentarii',
    validationState: 'error',
    errorMessage: 'Comentariul este prea scurt',
    value: 'Prea scurt',
  },
};

export const WithRomanianText: Story = {
  args: {
    label: 'Mesaj',
    value: 'Șeful a vândut o sticlă în oraș și țară',
    rows: 3,
  },
};
