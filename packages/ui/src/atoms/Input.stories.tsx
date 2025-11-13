import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

/**
 * Input component with validation states and labels.
 * Fully supports Romanian diacritics (ă, â, î, ș, ț).
 *
 * ## Accessibility
 * - Proper label association via htmlFor
 * - Required fields marked with asterisk and aria-required
 * - Validation messages linked via aria-describedby
 * - Error states communicated via aria-invalid
 */
const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search'],
    },
    validationState: {
      control: 'select',
      options: ['default', 'error', 'success', 'warning'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    required: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    label: 'Nume',
    placeholder: 'Introduceți numele',
  },
};

export const WithHelperText: Story = {
  args: {
    label: 'Email',
    type: 'email',
    placeholder: 'exemplu@email.ro',
    helperText: 'Vom folosi acest email pentru comunicare',
  },
};

export const Required: Story = {
  args: {
    label: 'Nume complet',
    placeholder: 'Introduceți numele dvs.',
    required: true,
  },
};

export const ErrorState: Story = {
  args: {
    label: 'Email',
    type: 'email',
    value: 'invalid-email',
    validationState: 'error',
    errorMessage: 'Adresa de email este invalidă',
  },
};

export const SuccessState: Story = {
  args: {
    label: 'Oraș',
    value: 'București',
    validationState: 'success',
    successMessage: 'Orașul a fost validat',
  },
};

export const WarningState: Story = {
  args: {
    label: 'Parola',
    type: 'password',
    value: 'weak123',
    validationState: 'warning',
    warningMessage: 'Parola este slabă. Considerați adăugarea de caractere speciale.',
  },
};

export const RomanianDiacritics: Story = {
  args: {
    label: 'Text cu diacritice',
    value: 'Șeful a vândut o sticlă în oraș și țară',
    helperText: 'Testează: ă, â, î, ș, ț',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-md">
      <Input label="Mic" size="sm" placeholder="Size sm" />
      <Input label="Mediu" size="md" placeholder="Size md" />
      <Input label="Mare" size="lg" placeholder="Size lg" />
    </div>
  ),
};
