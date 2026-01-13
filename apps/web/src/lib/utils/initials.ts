/**
 * Get initials from a name.
 *
 * Supports two calling patterns:
 * - getInitials("John Doe") -> "JD"
 * - getInitials("John", "Doe") -> "JD"
 *
 * Edge cases:
 * - Single name: "John" -> "J"
 * - Empty/null input: "" or null -> ""
 * - Whitespace is trimmed
 */
export function getInitials(
  firstNameOrFullName: string | null | undefined,
  lastName?: string | null
): string {
  // Handle null/undefined
  if (!firstNameOrFullName) {
    return '';
  }

  const trimmedFirst = firstNameOrFullName.trim();

  // If lastName is provided, use firstName + lastName pattern
  if (lastName !== undefined) {
    const trimmedLast = (lastName || '').trim();
    const firstInitial = trimmedFirst[0] || '';
    const lastInitial = trimmedLast[0] || '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  }

  // Otherwise, treat as full name and split by spaces
  if (!trimmedFirst) {
    return '';
  }

  return trimmedFirst
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
