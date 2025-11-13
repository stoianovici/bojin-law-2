/**
 * Input Component Tests
 * Tests all validation states, sizes, and accessibility features
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  describe('Rendering', () => {
    it('renders without label', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Input label="Email Address" />);
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    });

    it('renders with Romanian diacritics', () => {
      render(<Input label="Oraș" placeholder="Introduceți orașul" />);
      expect(screen.getByLabelText('Oraș')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Introduceți orașul')).toBeInTheDocument();
    });

    it('renders required indicator', () => {
      render(<Input label="Name" required />);
      expect(screen.getByText('*')).toBeInTheDocument();
      expect(screen.getByLabelText('required')).toBeInTheDocument();
    });
  });

  describe('Input Types', () => {
    it('renders text input by default', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('renders email input', () => {
      render(<Input type="email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('renders password input', () => {
      render(<Input type="password" />);
      const input = document.querySelector('input[type="password"]');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      render(<Input size="sm" data-testid="input-sm" />);
      const input = screen.getByTestId('input-sm');
      expect(input).toHaveClass('h-8');
    });

    it('renders medium size (default)', () => {
      render(<Input size="md" data-testid="input-md" />);
      const input = screen.getByTestId('input-md');
      expect(input).toHaveClass('h-10');
    });

    it('renders large size', () => {
      render(<Input size="lg" data-testid="input-lg" />);
      const input = screen.getByTestId('input-lg');
      expect(input).toHaveClass('h-12');
    });
  });

  describe('Validation States', () => {
    it('renders default state', () => {
      render(<Input validationState="default" data-testid="input-default" />);
      const input = screen.getByTestId('input-default');
      expect(input).toHaveClass('border-neutral-300');
    });

    it('renders error state with message', () => {
      render(
        <Input
          validationState="error"
          errorMessage="This field is required"
          data-testid="input-error"
        />
      );
      const input = screen.getByTestId('input-error');
      expect(input).toHaveClass('border-error-500');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('This field is required');
    });

    it('renders success state with message', () => {
      render(
        <Input
          validationState="success"
          successMessage="Valid email address"
          data-testid="input-success"
        />
      );
      const input = screen.getByTestId('input-success');
      expect(input).toHaveClass('border-success-500');
      expect(screen.getByRole('status')).toHaveTextContent('Valid email address');
    });

    it('renders warning state with message', () => {
      render(
        <Input
          validationState="warning"
          warningMessage="This email looks unusual"
          data-testid="input-warning"
        />
      );
      const input = screen.getByTestId('input-warning');
      expect(input).toHaveClass('border-warning-500');
      expect(screen.getByRole('status')).toHaveTextContent('This email looks unusual');
    });

    it('renders helper text in default state', () => {
      render(<Input helperText="Enter your email address" />);
      expect(screen.getByText('Enter your email address')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('accepts user input', async () => {
      const user = userEvent.setup();
      render(<Input />);
      const input = screen.getByRole('textbox');

      await user.type(input, 'test@example.com');

      expect(input).toHaveValue('test@example.com');
    });

    it('accepts Romanian diacritic input', async () => {
      const user = userEvent.setup();
      render(<Input />);
      const input = screen.getByRole('textbox');

      await user.type(input, 'București');

      expect(input).toHaveValue('București');
    });

    it('calls onChange when value changes', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();

      render(<Input onChange={handleChange} />);
      const input = screen.getByRole('textbox');

      await user.type(input, 'a');

      expect(handleChange).toHaveBeenCalled();
    });

    it('does not accept input when disabled', async () => {
      const user = userEvent.setup();
      render(<Input disabled />);
      const input = screen.getByRole('textbox');

      await user.type(input, 'test');

      expect(input).toHaveValue('');
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes for required field', () => {
      render(<Input label="Email" required />);
      const input = screen.getByLabelText(/Email/);
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('has correct ARIA attributes for error state', () => {
      render(
        <Input
          label="Email"
          validationState="error"
          errorMessage="Invalid email"
        />
      );
      const input = screen.getByLabelText('Email');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
    });

    it('associates label with input correctly', () => {
      render(<Input label="Username" />);
      const input = screen.getByLabelText('Username');
      expect(input).toBeInTheDocument();
    });

    it('is keyboard accessible', async () => {
      const user = userEvent.setup();
      render(<Input />);
      const input = screen.getByRole('textbox');

      await user.tab();

      expect(input).toHaveFocus();
    });

    it('has proper disabled state styling', () => {
      render(<Input disabled data-testid="input-disabled" />);
      const input = screen.getByTestId('input-disabled');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('disabled:opacity-50');
    });
  });

  describe('Custom ID', () => {
    it('uses provided id', () => {
      render(<Input id="custom-input" label="Email" />);
      const input = screen.getByLabelText('Email');
      expect(input).toHaveAttribute('id', 'custom-input');
    });

    it('generates unique id when not provided', () => {
      const { container } = render(<Input label="Email" />);
      const input = container.querySelector('input');
      expect(input?.id).toMatch(/^input-/);
    });
  });
});
