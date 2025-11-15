/**
 * Tests for CommandBar component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommandBar } from './CommandBar';

// Mock setTimeout for testing auto-hide functionality
jest.useFakeTimers();

describe('CommandBar', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Component Rendering', () => {
    it('renders the command bar', () => {
      render(<CommandBar />);

      expect(screen.getByPlaceholderText(/Scrie o comandă/)).toBeInTheDocument();
    });

    it('renders submit button', () => {
      render(<CommandBar />);

      expect(screen.getByLabelText('Trimite comandă')).toBeInTheDocument();
    });

    it('renders voice input button', () => {
      render(<CommandBar />);

      expect(screen.getByLabelText('Comandă vocală')).toBeInTheDocument();
    });

    it('displays helper text', () => {
      render(<CommandBar />);

      expect(screen.getByText(/Folosește limbaj natural/)).toBeInTheDocument();
      expect(screen.getByText(/AI va executa comanda/)).toBeInTheDocument();
    });

    it('shows keyboard shortcut hint when not focused', () => {
      render(<CommandBar />);

      expect(screen.getByText('Ctrl')).toBeInTheDocument();
      expect(screen.getByText('/')).toBeInTheDocument();
    });
  });

  describe('Command Input', () => {
    it('allows typing in the input field', () => {
      render(<CommandBar />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Test command' } });

      expect(input.value).toBe('Test command');
    });

    it('has proper placeholder text', () => {
      render(<CommandBar />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      expect(input).toHaveAttribute(
        'placeholder',
        expect.stringContaining('Adaugă clauză de confidențialitate')
      );
    });

    it('has proper ARIA label', () => {
      render(<CommandBar />);

      expect(screen.getByLabelText('Comandă document')).toBeInTheDocument();
    });

    it('clears input after submission', () => {
      const handleSubmit = jest.fn();
      render(<CommandBar onCommandSubmit={handleSubmit} />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Test command' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      expect(input.value).toBe('');
    });
  });

  describe('Command Submission', () => {
    it('calls onCommandSubmit when form is submitted', () => {
      const handleSubmit = jest.fn();
      render(<CommandBar onCommandSubmit={handleSubmit} />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.change(input, { target: { value: 'Test command' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      expect(handleSubmit).toHaveBeenCalledWith('Test command');
    });

    it('does not submit empty commands', () => {
      const handleSubmit = jest.fn();
      render(<CommandBar onCommandSubmit={handleSubmit} />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      const form = input.closest('form')!;
      fireEvent.submit(form);

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('does not submit whitespace-only commands', () => {
      const handleSubmit = jest.fn();
      render(<CommandBar onCommandSubmit={handleSubmit} />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.change(input, { target: { value: '   ' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('works without onCommandSubmit handler', () => {
      render(<CommandBar />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.change(input, { target: { value: 'Test' } });

      const form = input.closest('form')!;

      expect(() => fireEvent.submit(form)).not.toThrow();
    });

    it('disables submission when loading', () => {
      const handleSubmit = jest.fn();
      render(<CommandBar onCommandSubmit={handleSubmit} isLoading={true} />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.change(input, { target: { value: 'Test' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Submit Button', () => {
    it('is disabled when input is empty', () => {
      render(<CommandBar />);

      const submitButton = screen.getByLabelText('Trimite comandă');
      expect(submitButton).toBeDisabled();
    });

    it('is enabled when input has text', () => {
      render(<CommandBar />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.change(input, { target: { value: 'Test' } });

      const submitButton = screen.getByLabelText('Trimite comandă');
      expect(submitButton).not.toBeDisabled();
    });

    it('is disabled when loading', () => {
      render(<CommandBar isLoading={true} />);

      const submitButton = screen.getByLabelText('Trimite comandă');
      expect(submitButton).toBeDisabled();
    });

    it('has proper title attribute', () => {
      render(<CommandBar />);

      const submitButton = screen.getByLabelText('Trimite comandă');
      expect(submitButton).toHaveAttribute('title', 'Trimite comandă');
    });
  });

  describe('Suggested Commands', () => {
    it('shows suggested commands when input is focused', () => {
      render(<CommandBar />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.focus(input);

      expect(screen.getByText('Comenzi sugerate')).toBeInTheDocument();
      expect(screen.getByText('Adaugă clauză de confidențialitate')).toBeInTheDocument();
      expect(screen.getByText('Verifică pentru erori')).toBeInTheDocument();
      expect(screen.getByText('Generează rezumat')).toBeInTheDocument();
      expect(screen.getByText('Traduce în engleză')).toBeInTheDocument();
    });

    it('hides suggested commands when input is blurred', async () => {
      render(<CommandBar />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.focus(input);

      expect(screen.getByText('Comenzi sugerate')).toBeInTheDocument();

      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText('Comenzi sugerate')).not.toBeInTheDocument();
      }, { timeout: 300 });
    });

    it('populates input when suggestion is clicked', () => {
      render(<CommandBar />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/) as HTMLInputElement;
      fireEvent.focus(input);

      const suggestion = screen.getByText('Verifică pentru erori');
      fireEvent.click(suggestion);

      expect(input.value).toBe('Verifică pentru erori');
    });

    it('does not show suggestions when loading', () => {
      render(<CommandBar isLoading={true} />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.focus(input);

      expect(screen.queryByText('Comenzi sugerate')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(<CommandBar isLoading={true} />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('does not show loading spinner by default', () => {
      render(<CommandBar />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });

    it('disables input when loading', () => {
      render(<CommandBar isLoading={true} />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      expect(input).toBeDisabled();
    });

    it('disables voice button when loading', () => {
      render(<CommandBar isLoading={true} />);

      const voiceButton = screen.getByLabelText('Comandă vocală');
      expect(voiceButton).toBeDisabled();
    });

    it('hides keyboard shortcut hint when loading', () => {
      render(<CommandBar isLoading={true} />);

      // Loading spinner should be present instead of keyboard hint
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Result Message', () => {
    it('displays result message after submission', () => {
      render(<CommandBar resultMessage="Clauza a fost adăugată cu succes" />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.change(input, { target: { value: 'Test' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      expect(screen.getByText('Comandă executată')).toBeInTheDocument();
      expect(screen.getByText('Clauza a fost adăugată cu succes')).toBeInTheDocument();
    });

    it('does not display result message before submission', () => {
      render(<CommandBar resultMessage="Test message" />);

      expect(screen.queryByText('Comandă executată')).not.toBeInTheDocument();
    });

    it('hides result message when close button is clicked', () => {
      render(<CommandBar resultMessage="Test message" />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.change(input, { target: { value: 'Test' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      expect(screen.getByText('Comandă executată')).toBeInTheDocument();

      const closeButton = screen.getByLabelText('Închide');
      fireEvent.click(closeButton);

      expect(screen.queryByText('Comandă executată')).not.toBeInTheDocument();
    });

    it('auto-hides result message after 5 seconds', () => {
      render(<CommandBar resultMessage="Test message" />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.change(input, { target: { value: 'Test' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      expect(screen.getByText('Comandă executată')).toBeInTheDocument();

      // Fast-forward time by 5 seconds
      jest.advanceTimersByTime(5000);

      expect(screen.queryByText('Comandă executată')).not.toBeInTheDocument();
    });
  });

  describe('Voice Input Button', () => {
    it('renders voice input button', () => {
      render(<CommandBar />);

      expect(screen.getByLabelText('Comandă vocală')).toBeInTheDocument();
    });

    it('has proper title attribute', () => {
      render(<CommandBar />);

      const voiceButton = screen.getByLabelText('Comandă vocală');
      expect(voiceButton).toHaveAttribute('title', 'Comandă vocală');
    });

    it('logs to console when clicked', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      render(<CommandBar />);

      const voiceButton = screen.getByLabelText('Comandă vocală');
      fireEvent.click(voiceButton);

      expect(consoleSpy).toHaveBeenCalledWith('Voice input clicked');
      consoleSpy.mockRestore();
    });

    it('is disabled when loading', () => {
      render(<CommandBar isLoading={true} />);

      const voiceButton = screen.getByLabelText('Comandă vocală');
      expect(voiceButton).toBeDisabled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('focuses input when Ctrl+/ is pressed', () => {
      render(<CommandBar />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);

      // Simulate Ctrl+/ keydown
      fireEvent.keyDown(window, { key: '/', ctrlKey: true });

      expect(input).toHaveFocus();
    });

    it('prevents default behavior on Ctrl+/', () => {
      render(<CommandBar />);

      const event = new KeyboardEvent('keydown', { key: '/', ctrlKey: true });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does not focus on other key combinations', () => {
      render(<CommandBar />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);

      // Should not focus on Ctrl+A
      fireEvent.keyDown(window, { key: 'a', ctrlKey: true });

      expect(input).not.toHaveFocus();
    });

    it('hides keyboard hint when input has value', () => {
      render(<CommandBar />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);

      // Keyboard hint should be visible initially
      expect(screen.getByText('Ctrl')).toBeInTheDocument();

      // Type something
      fireEvent.change(input, { target: { value: 'Test' } });

      // Keyboard hint should be hidden
      expect(screen.queryByText('Ctrl')).not.toBeInTheDocument();
    });
  });

  describe('Romanian Diacritics', () => {
    it('renders Romanian diacritics in placeholder', () => {
      render(<CommandBar />);

      expect(screen.getByPlaceholderText(/clauză de confidențialitate/)).toBeInTheDocument();
    });

    it('renders Romanian diacritics in suggested commands', () => {
      render(<CommandBar />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.focus(input);

      expect(screen.getByText('Adaugă clauză de confidențialitate')).toBeInTheDocument();
      expect(screen.getByText('Verifică pentru erori')).toBeInTheDocument();
      expect(screen.getByText('Generează rezumat')).toBeInTheDocument();
    });

    it('renders Romanian diacritics in helper text', () => {
      render(<CommandBar />);

      expect(screen.getByText(/Folosește limbaj natural/)).toBeInTheDocument();
    });

    it('renders Romanian diacritics in result message', () => {
      render(<CommandBar resultMessage="Clauză adăugată" />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.change(input, { target: { value: 'Test' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      expect(screen.getByText('Comandă executată')).toBeInTheDocument();
      expect(screen.getByText('Clauză adăugată')).toBeInTheDocument();
    });

    it('renders Romanian diacritics in button labels', () => {
      render(<CommandBar />);

      expect(screen.getByLabelText('Comandă vocală')).toBeInTheDocument();
      expect(screen.getByLabelText('Trimite comandă')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for buttons', () => {
      render(<CommandBar />);

      expect(screen.getByLabelText('Comandă document')).toBeInTheDocument();
      expect(screen.getByLabelText('Comandă vocală')).toBeInTheDocument();
      expect(screen.getByLabelText('Trimite comandă')).toBeInTheDocument();
    });

    it('has proper title attributes on buttons', () => {
      render(<CommandBar />);

      const voiceButton = screen.getByLabelText('Comandă vocală');
      const submitButton = screen.getByLabelText('Trimite comandă');

      expect(voiceButton).toHaveAttribute('title', 'Comandă vocală');
      expect(submitButton).toHaveAttribute('title', 'Trimite comandă');
    });

    it('disables interactive elements when loading', () => {
      render(<CommandBar isLoading={true} />);

      const input = screen.getByLabelText('Comandă document');
      const voiceButton = screen.getByLabelText('Comandă vocală');
      const submitButton = screen.getByLabelText('Trimite comandă');

      expect(input).toBeDisabled();
      expect(voiceButton).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });

    it('close button in result has ARIA label', () => {
      render(<CommandBar resultMessage="Test" />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.change(input, { target: { value: 'Test' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      expect(screen.getByLabelText('Închide')).toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('defaults isLoading to false', () => {
      render(<CommandBar />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      expect(input).not.toBeDisabled();
    });

    it('accepts custom isLoading prop', () => {
      render(<CommandBar isLoading={true} />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('accepts custom resultMessage prop', () => {
      render(<CommandBar resultMessage="Custom message" />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.change(input, { target: { value: 'Test' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      expect(screen.getByText('Custom message')).toBeInTheDocument();
    });

    it('works without onCommandSubmit', () => {
      render(<CommandBar />);

      const input = screen.getByPlaceholderText(/Scrie o comandă/);
      fireEvent.change(input, { target: { value: 'Test' } });

      const form = input.closest('form')!;

      expect(() => fireEvent.submit(form)).not.toThrow();
    });
  });
});
