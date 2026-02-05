/**
 * Email Utility Functions
 *
 * Shared functions for email address processing used across the codebase.
 */

/**
 * Extract domain from email address
 * @param email - The email address
 * @returns lowercase domain or null if invalid
 */
export function extractDomain(email: string): string | null {
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return null;
  return email.substring(atIndex + 1).toLowerCase();
}

/**
 * Normalize email address (lowercase, trim)
 * @param email - The email address to normalize
 * @returns normalized email address
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Check if a string is a valid email address format
 * @param email - The string to check
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  // Basic email validation - checks for @ symbol and domain
  const atIndex = email.indexOf('@');
  if (atIndex < 1) return false; // @ must not be first character
  const domain = email.substring(atIndex + 1);
  return domain.length > 0 && domain.includes('.');
}
