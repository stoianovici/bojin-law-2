import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Fill a form with the provided field values
 * @param fields - Object mapping field labels/names to values
 */
export async function fillForm(fields: Record<string, string>): Promise<void> {
  const user = userEvent.setup();

  for (const [label, value] of Object.entries(fields)) {
    // Try to find input by label first
    let input = screen.queryByLabelText(label);

    // If not found by label, try by placeholder
    if (!input) {
      input = screen.queryByPlaceholderText(label);
    }

    // If not found by placeholder, try by name
    if (!input) {
      input = screen.queryByRole('textbox', { name: label });
    }

    if (!input) {
      throw new Error(`Could not find form field for: ${label}`);
    }

    await user.clear(input);
    await user.type(input, value);
  }
}

/**
 * Fill a specific input field by label
 */
export async function fillField(label: string, value: string): Promise<void> {
  const user = userEvent.setup();
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, value);
}

/**
 * Select an option from a select/dropdown field
 */
export async function selectOption(label: string, option: string): Promise<void> {
  const user = userEvent.setup();
  const select = screen.getByLabelText(label);
  await user.selectOptions(select, option);
}

/**
 * Click a checkbox or radio button
 */
export async function clickCheckbox(label: string): Promise<void> {
  const user = userEvent.setup();
  const checkbox = screen.getByLabelText(label);
  await user.click(checkbox);
}

/**
 * Submit a form by clicking its submit button
 */
export async function submitForm(buttonText: string = 'Submit'): Promise<void> {
  const user = userEvent.setup();
  const submitButton = screen.getByRole('button', { name: buttonText });
  await user.click(submitButton);
}
