/**
 * Template Parser Utility
 * Story 5.5: Multi-Channel Communication Hub (AC: 2)
 *
 * Handles variable extraction and replacement in communication templates
 */

// Variable pattern: {{variableName}} or {{object.property}}
const VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\}\}/g;

/**
 * Extract all variable names from a template string
 * @param template - Template string containing {{variable}} placeholders
 * @returns Array of variable names (without the {{ }})
 */
export function extractVariables(template: string): string[] {
  const variables: string[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  VARIABLE_PATTERN.lastIndex = 0;

  while ((match = VARIABLE_PATTERN.exec(template)) !== null) {
    const varName = match[1];
    if (!variables.includes(varName)) {
      variables.push(varName);
    }
  }

  return variables;
}

/**
 * Replace variables in a template with their values
 * @param template - Template string containing {{variable}} placeholders
 * @param values - Object mapping variable names to their values
 * @param options - Configuration options
 * @returns Rendered template string
 */
export function replaceVariables(
  template: string,
  values: Record<string, string>,
  options?: {
    escapeHtml?: boolean;
    keepMissingPlaceholders?: boolean;
    defaultValue?: string;
  }
): string {
  const { escapeHtml = true, keepMissingPlaceholders = false, defaultValue = '' } = options || {};

  // Reset regex state
  VARIABLE_PATTERN.lastIndex = 0;

  return template.replace(VARIABLE_PATTERN, (match, varName) => {
    // Handle nested properties (e.g., client.firstName)
    const value = getNestedValue(values, varName);

    if (value === undefined || value === null) {
      if (keepMissingPlaceholders) {
        return match;
      }
      return defaultValue;
    }

    // Escape HTML if needed
    if (escapeHtml) {
      return escapeHtmlChars(String(value));
    }

    return String(value);
  });
}

/**
 * Get a nested value from an object using dot notation
 * @param obj - Object to get value from
 * @param path - Dot-separated path (e.g., "client.firstName")
 * @returns Value at path or undefined
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  // First check if the exact path exists as a key
  if (path in obj) {
    return obj[path];
  }

  // Otherwise try nested lookup
  const parts = path.split('.');
  let current: any = obj;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param str - String to escape
 * @returns Escaped string
 */
function escapeHtmlChars(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  return str.replace(/[&<>"'`=\/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Validate that all required variables are present in the values
 * @param template - Template string
 * @param values - Values object
 * @param requiredVars - List of required variable names
 * @returns Object with validation result
 */
export function validateVariables(
  template: string,
  values: Record<string, string>,
  requiredVars: string[]
): { valid: boolean; missing: string[]; unused: string[] } {
  const templateVars = extractVariables(template);
  const providedVars = Object.keys(values);

  const missing = requiredVars.filter((v) => templateVars.includes(v) && !providedVars.includes(v));

  const unused = providedVars.filter((v) => !templateVars.includes(v));

  return {
    valid: missing.length === 0,
    missing,
    unused,
  };
}

/**
 * Preview a template with sample data
 * @param template - Template string
 * @param sampleValues - Sample values for preview
 * @returns Rendered preview
 */
export function previewTemplate(template: string, sampleValues?: Record<string, string>): string {
  const variables = extractVariables(template);

  // Generate sample values for any missing variables
  const values: Record<string, string> = { ...sampleValues };
  for (const varName of variables) {
    if (!values[varName]) {
      values[varName] = `[${varName}]`;
    }
  }

  return replaceVariables(template, values, { escapeHtml: false });
}

/**
 * Count variables in a template
 * @param template - Template string
 * @returns Number of unique variables
 */
export function countVariables(template: string): number {
  return extractVariables(template).length;
}

/**
 * Check if a string contains any template variables
 * @param str - String to check
 * @returns True if contains variables
 */
export function hasVariables(str: string): boolean {
  VARIABLE_PATTERN.lastIndex = 0;
  return VARIABLE_PATTERN.test(str);
}

// Export as singleton object for consistent usage
export const templateParser = {
  extractVariables,
  replaceVariables,
  validateVariables,
  previewTemplate,
  countVariables,
  hasVariables,
};
