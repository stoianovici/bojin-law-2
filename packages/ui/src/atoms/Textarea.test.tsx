/**
 * Textarea Component Tests
 * Tests all validation states and accessibility features
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  describe('Rendering', () => {
    it('renders without label', () => {
      render(<Textarea placeholder="Enter description" />);
      expect(screen.getByPlaceholderText('Enter description')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Textarea label="Description" />);
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });

    it('renders with Romanian diacritics', () => {
      render(<Textarea label="Descriere" placeholder="Introduceți descrierea" />);
      expect(screen.getByLabelText('Descriere')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Introduceți descrierea')).toBeInTheDocument();
    });

    it('renders required indicator', () => {
      render(<Textarea label="Comments" required />);
      expect(screen.getByText('*')).toBeInTheDocument();
      expect(screen.getByLabelText('required')).toBeInTheDocument();
    });

    it('renders with custom rows', () => {
      render(<Textarea rows={6} data-testid="textarea-custom" />);
      const textarea = screen.getByTestId('textarea-custom');
      expect(textarea).toHaveAttribute('rows', '6');
    });

    it('renders with default 4 rows', () => {
      const { container } = render(<Textarea />);
      const textarea = container.querySelector('textarea');
      expect(textarea).toHaveAttribute('rows', '4');
    });
  });

  describe('Validation States', () => {
    it('renders default state', () => {
      render(<Textarea validationState="default" data-testid="textarea-default" />);
      const textarea = screen.getByTestId('textarea-default');
      expect(textarea).toHaveClass('border-neutral-300');
    });

    it('renders error state with message', () => {
      render(
        <Textarea
          validationState="error"
          errorMessage="Description is too short"
          data-testid="textarea-error"
        />
      );
      const textarea = screen.getByTestId('textarea-error');
      expect(textarea).toHaveClass('border-error-500');
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('Description is too short');
    });

    it('renders success state with message', () => {
      render(
        <Textarea
          validationState="success"
          successMessage="Description looks good"
          data-testid="textarea-success"
        />
      );
      const textarea = screen.getByTestId('textarea-success');
      expect(textarea).toHaveClass('border-success-500');
      expect(screen.getByRole('status')).toHaveTextContent('Description looks good');
    });

    it('renders warning state with message', () => {
      render(
        <Textarea
          validationState="warning"
          warningMessage="Description might be too long"
          data-testid="textarea-warning"
        />
      );
      const textarea = screen.getByTestId('textarea-warning');
      expect(textarea).toHaveClass('border-warning-500');
      expect(screen.getByRole('status')).toHaveTextContent('Description might be too long');
    });

    it('renders helper text in default state', () => {
      render(<Textarea helperText="Maximum 500 characters" />);
      expect(screen.getByText('Maximum 500 characters')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('accepts user input', async () => {
      const user = userEvent.setup();
      const { container } = render(<Textarea />);
      const textarea = container.querySelector('textarea');

      await user.type(textarea!, 'This is a test description');

      expect(textarea).toHaveValue('This is a test description');
    });

    it('accepts Romanian diacritic input', async () => {
      const user = userEvent.setup();
      const { container } = render(<Textarea />);
      const textarea = container.querySelector('textarea');

      await user.type(textarea!, 'Șeful a vândut o sticlă în oraș și țară');

      expect(textarea).toHaveValue('Șeful a vândut o sticlă în oraș și țară');
    });

    it('accepts multiline input', async () => {
      const user = userEvent.setup();
      const { container } = render(<Textarea />);
      const textarea = container.querySelector('textarea');

      await user.type(textarea!, 'Line 1{Enter}Line 2{Enter}Line 3');

      expect(textarea).toHaveValue('Line 1\nLine 2\nLine 3');
    });

    it('calls onChange when value changes', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      const { container } = render(<Textarea onChange={handleChange} />);
      const textarea = container.querySelector('textarea');

      await user.type(textarea!, 'a');

      expect(handleChange).toHaveBeenCalled();
    });

    it('does not accept input when disabled', async () => {
      const user = userEvent.setup();
      const { container } = render(<Textarea disabled />);
      const textarea = container.querySelector('textarea');

      await user.type(textarea!, 'test');

      expect(textarea).toHaveValue('');
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes for required field', () => {
      render(<Textarea label="Description" required />);
      const textarea = screen.getByLabelText(/Description/);
      expect(textarea).toHaveAttribute('aria-required', 'true');
    });

    it('has correct ARIA attributes for error state', () => {
      render(
        <Textarea
          label="Description"
          validationState="error"
          errorMessage="Required field"
        />
      );
      const textarea = screen.getByLabelText('Description');
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
      expect(textarea).toHaveAttribute('aria-describedby');
    });

    it('associates label with textarea correctly', () => {
      render(<Textarea label="Comments" />);
      const textarea = screen.getByLabelText('Comments');
      expect(textarea).toBeInTheDocument();
    });

    it('is keyboard accessible', async () => {
      const user = userEvent.setup();
      const { container } = render(<Textarea />);
      const textarea = container.querySelector('textarea');

      await user.tab();

      expect(textarea).toHaveFocus();
    });

    it('has proper disabled state styling', () => {
      render(<Textarea disabled data-testid="textarea-disabled" />);
      const textarea = screen.getByTestId('textarea-disabled');
      expect(textarea).toBeDisabled();
      expect(textarea).toHaveClass('disabled:opacity-50');
    });

    it('supports vertical resize', () => {
      render(<Textarea data-testid="textarea-resize" />);
      const textarea = screen.getByTestId('textarea-resize');
      expect(textarea).toHaveClass('resize-vertical');
    });
  });

  describe('Custom ID', () => {
    it('uses provided id', () => {
      render(<Textarea id="custom-textarea" label="Description" />);
      const textarea = screen.getByLabelText('Description');
      expect(textarea).toHaveAttribute('id', 'custom-textarea');
    });

    it('generates unique id when not provided', () => {
      const { container } = render(<Textarea label="Description" />);
      const textarea = container.querySelector('textarea');
      expect(textarea?.id).toMatch(/^textarea-/);
    });
  });
});
