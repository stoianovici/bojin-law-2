// ============================================================================
// Currency Conversion Utilities
// ============================================================================
// Converts USD costs (stored as cents) to EUR for display in the Romanian UI.

// Default exchange rate (USD to EUR)
const DEFAULT_USD_EUR_RATE = 0.92;

// Get rate from env or use default
// Note: Environment variable must be prefixed with NEXT_PUBLIC_ for client-side access
const USD_EUR_RATE =
  typeof window !== 'undefined'
    ? parseFloat(process.env.NEXT_PUBLIC_USD_EUR_RATE || '') || DEFAULT_USD_EUR_RATE
    : parseFloat(process.env.NEXT_PUBLIC_USD_EUR_RATE || '') || DEFAULT_USD_EUR_RATE;

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert USD cents to EUR value (number)
 * @param costCents - Cost in USD cents
 * @returns EUR value as number (0 for invalid inputs)
 */
export function centsToEur(costCents: number | undefined | null): number {
  // Handle edge cases
  if (costCents === undefined || costCents === null || isNaN(costCents)) {
    return 0;
  }

  // Handle negative values - return 0 as costs should not be negative
  if (costCents < 0) {
    return 0;
  }

  // Convert cents to dollars, then to EUR
  const usdDollars = costCents / 100;
  const eurValue = usdDollars * USD_EUR_RATE;

  return eurValue;
}

/**
 * Convert USD cents to formatted EUR string
 * @param costCents - Cost in USD cents
 * @returns Formatted EUR string (e.g., "€12.45")
 */
export function formatCostEur(costCents: number | undefined | null): string {
  const eurValue = centsToEur(costCents);

  // Format with 2 decimal places and EUR symbol
  return `€${eurValue.toFixed(2)}`;
}

// ============================================================================
// Additional Utilities
// ============================================================================

/**
 * Get the current USD to EUR exchange rate being used
 * @returns The exchange rate (e.g., 0.92)
 */
export function getExchangeRate(): number {
  return USD_EUR_RATE;
}

/**
 * Format a EUR value (already in EUR, not cents) as a string
 * @param eurValue - Value in EUR
 * @returns Formatted EUR string (e.g., "€12.45")
 */
export function formatEur(eurValue: number | undefined | null): string {
  if (eurValue === undefined || eurValue === null || isNaN(eurValue)) {
    return '€0.00';
  }

  if (eurValue < 0) {
    return '€0.00';
  }

  return `€${eurValue.toFixed(2)}`;
}
