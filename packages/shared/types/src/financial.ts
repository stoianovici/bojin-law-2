/**
 * Financial Data Types and Enums
 * Story 2.8.3: Role-Based Financial Visibility
 *
 * This file defines all financial-related types and field identifiers
 * used across the application for enforcing financial data access controls.
 */

/**
 * Enum of all financial fields in the GraphQL schema
 * These fields require Partner role to access
 *
 * Field naming convention: {TypeName}_{fieldName}
 *
 * Current fields (Story 2.8):
 * - Case.value: Monetary value of case
 *
 * Future fields (Story 2.8.1 - Billing & Rates):
 * - Case.billingType: Hourly vs Fixed billing
 * - Case.fixedAmount: Fixed fee amount
 * - Case.customRates: Custom hourly rates per role
 * - Firm.defaultRates: Default billing rates
 *
 * Future fields (Story 2.8.4+ - Invoicing):
 * - TimeEntry.rate: Hourly rate for time entry
 * - TimeEntry.billableAmount: Calculated billable amount
 * - Invoice.*: All invoice fields
 * - Payment.*: All payment fields
 * - KPI.*: Financial KPI metrics
 */
export enum FinancialField {
  // Case financial fields (current)
  CASE_VALUE = 'Case.value',

  // Case financial fields (future - Story 2.8.1)
  CASE_BILLING_TYPE = 'Case.billingType',
  CASE_FIXED_AMOUNT = 'Case.fixedAmount',
  CASE_CUSTOM_RATES = 'Case.customRates',
  CASE_RATE_HISTORY = 'Case.rateHistory',

  // Retainer fields (Story 2.11.2)
  CASE_RETAINER_AMOUNT = 'Case.retainerAmount',
  CASE_RETAINER_PERIOD = 'Case.retainerPeriod',
  CASE_RETAINER_ROLLOVER = 'Case.retainerRollover',
  CASE_RETAINER_AUTO_RENEW = 'Case.retainerAutoRenew',
  CASE_CURRENT_RETAINER_USAGE = 'Case.currentRetainerUsage',

  // Time tracking financial fields (future)
  TIME_ENTRY_RATE = 'TimeEntry.rate',
  TIME_ENTRY_BILLABLE_AMOUNT = 'TimeEntry.billableAmount',

  // Firm settings financial fields (future - Story 2.8.1)
  FIRM_DEFAULT_RATES = 'Firm.defaultRates',

  // Invoice fields (future)
  INVOICE_ALL = 'Invoice.*',

  // Payment fields (future)
  PAYMENT_ALL = 'Payment.*',

  // KPI fields (future)
  KPI_ALL = 'KPI.*',
}

/**
 * Type guard to check if a field is financial
 * @param fieldName - GraphQL field name to check
 * @returns true if field is financial and requires Partner access
 */
export function isFinancialField(fieldName: string): boolean {
  return Object.values(FinancialField).includes(fieldName as FinancialField);
}

/**
 * Financial field categories for documentation and access control
 */
export enum FinancialFieldCategory {
  CASE_MANAGEMENT = 'Case Management',
  TIME_TRACKING = 'Time Tracking',
  BILLING_INVOICING = 'Billing & Invoicing',
  PAYMENTS = 'Payments',
  KPI_REPORTS = 'KPIs & Reports',
  SETTINGS = 'Settings',
}

/**
 * Mapping of financial fields to their categories
 */
export const FINANCIAL_FIELD_CATEGORIES: Record<FinancialField, FinancialFieldCategory> = {
  [FinancialField.CASE_VALUE]: FinancialFieldCategory.CASE_MANAGEMENT,
  [FinancialField.CASE_BILLING_TYPE]: FinancialFieldCategory.CASE_MANAGEMENT,
  [FinancialField.CASE_FIXED_AMOUNT]: FinancialFieldCategory.CASE_MANAGEMENT,
  [FinancialField.CASE_CUSTOM_RATES]: FinancialFieldCategory.CASE_MANAGEMENT,
  [FinancialField.CASE_RATE_HISTORY]: FinancialFieldCategory.CASE_MANAGEMENT,
  // Retainer fields (Story 2.11.2)
  [FinancialField.CASE_RETAINER_AMOUNT]: FinancialFieldCategory.CASE_MANAGEMENT,
  [FinancialField.CASE_RETAINER_PERIOD]: FinancialFieldCategory.CASE_MANAGEMENT,
  [FinancialField.CASE_RETAINER_ROLLOVER]: FinancialFieldCategory.CASE_MANAGEMENT,
  [FinancialField.CASE_RETAINER_AUTO_RENEW]: FinancialFieldCategory.CASE_MANAGEMENT,
  [FinancialField.CASE_CURRENT_RETAINER_USAGE]: FinancialFieldCategory.CASE_MANAGEMENT,
  [FinancialField.TIME_ENTRY_RATE]: FinancialFieldCategory.TIME_TRACKING,
  [FinancialField.TIME_ENTRY_BILLABLE_AMOUNT]: FinancialFieldCategory.TIME_TRACKING,
  [FinancialField.FIRM_DEFAULT_RATES]: FinancialFieldCategory.SETTINGS,
  [FinancialField.INVOICE_ALL]: FinancialFieldCategory.BILLING_INVOICING,
  [FinancialField.PAYMENT_ALL]: FinancialFieldCategory.PAYMENTS,
  [FinancialField.KPI_ALL]: FinancialFieldCategory.KPI_REPORTS,
};

/**
 * Financial field metadata for documentation
 */
export interface FinancialFieldMetadata {
  field: FinancialField;
  category: FinancialFieldCategory;
  description: string;
  graphqlType: string;
  implementedInStory: string;
  requiresPartnerRole: true;
}

/**
 * Complete financial field taxonomy
 */
export const FINANCIAL_FIELDS_METADATA: FinancialFieldMetadata[] = [
  // Case Management
  {
    field: FinancialField.CASE_VALUE,
    category: FinancialFieldCategory.CASE_MANAGEMENT,
    description: 'Monetary value of the case',
    graphqlType: 'Float',
    implementedInStory: '2.8',
    requiresPartnerRole: true,
  },
  {
    field: FinancialField.CASE_BILLING_TYPE,
    category: FinancialFieldCategory.CASE_MANAGEMENT,
    description: 'Billing type (Hourly vs Fixed)',
    graphqlType: 'BillingType',
    implementedInStory: '2.8.1',
    requiresPartnerRole: true,
  },
  {
    field: FinancialField.CASE_FIXED_AMOUNT,
    category: FinancialFieldCategory.CASE_MANAGEMENT,
    description: 'Fixed fee amount for fixed-rate cases',
    graphqlType: 'Float',
    implementedInStory: '2.8.1',
    requiresPartnerRole: true,
  },
  {
    field: FinancialField.CASE_CUSTOM_RATES,
    category: FinancialFieldCategory.CASE_MANAGEMENT,
    description: 'Custom hourly rates per role (Partner/Associate/Paralegal)',
    graphqlType: 'CustomRates',
    implementedInStory: '2.8.1',
    requiresPartnerRole: true,
  },
  {
    field: FinancialField.CASE_RATE_HISTORY,
    category: FinancialFieldCategory.CASE_MANAGEMENT,
    description: 'History of rate changes for the case',
    graphqlType: '[RateHistoryEntry!]!',
    implementedInStory: '2.8.1',
    requiresPartnerRole: true,
  },

  // Retainer fields (Story 2.11.2)
  {
    field: FinancialField.CASE_RETAINER_AMOUNT,
    category: FinancialFieldCategory.CASE_MANAGEMENT,
    description: 'Retainer amount per billing period in USD cents',
    graphqlType: 'Float',
    implementedInStory: '2.11.2',
    requiresPartnerRole: true,
  },
  {
    field: FinancialField.CASE_RETAINER_PERIOD,
    category: FinancialFieldCategory.CASE_MANAGEMENT,
    description: 'Retainer billing period (Monthly, Quarterly, Annually)',
    graphqlType: 'RetainerPeriod',
    implementedInStory: '2.11.2',
    requiresPartnerRole: true,
  },
  {
    field: FinancialField.CASE_RETAINER_ROLLOVER,
    category: FinancialFieldCategory.CASE_MANAGEMENT,
    description: 'Whether unused hours roll over to next period',
    graphqlType: 'Boolean',
    implementedInStory: '2.11.2',
    requiresPartnerRole: true,
  },
  {
    field: FinancialField.CASE_RETAINER_AUTO_RENEW,
    category: FinancialFieldCategory.CASE_MANAGEMENT,
    description: 'Whether retainer auto-renews each period',
    graphqlType: 'Boolean',
    implementedInStory: '2.11.2',
    requiresPartnerRole: true,
  },
  {
    field: FinancialField.CASE_CURRENT_RETAINER_USAGE,
    category: FinancialFieldCategory.CASE_MANAGEMENT,
    description: 'Current retainer usage for this billing period',
    graphqlType: 'RetainerUsage',
    implementedInStory: '2.11.2',
    requiresPartnerRole: true,
  },

  // Time Tracking
  {
    field: FinancialField.TIME_ENTRY_RATE,
    category: FinancialFieldCategory.TIME_TRACKING,
    description: 'Hourly rate for this time entry',
    graphqlType: 'Float',
    implementedInStory: '2.8.1+',
    requiresPartnerRole: true,
  },
  {
    field: FinancialField.TIME_ENTRY_BILLABLE_AMOUNT,
    category: FinancialFieldCategory.TIME_TRACKING,
    description: 'Calculated billable amount (hours * rate)',
    graphqlType: 'Float',
    implementedInStory: '2.8.1+',
    requiresPartnerRole: true,
  },

  // Settings
  {
    field: FinancialField.FIRM_DEFAULT_RATES,
    category: FinancialFieldCategory.SETTINGS,
    description: 'Default hourly rates per role for the firm',
    graphqlType: 'DefaultRates',
    implementedInStory: '2.8.1',
    requiresPartnerRole: true,
  },

  // Billing & Invoicing
  {
    field: FinancialField.INVOICE_ALL,
    category: FinancialFieldCategory.BILLING_INVOICING,
    description: 'All invoice fields (entire type)',
    graphqlType: 'Invoice',
    implementedInStory: 'Future',
    requiresPartnerRole: true,
  },

  // Payments
  {
    field: FinancialField.PAYMENT_ALL,
    category: FinancialFieldCategory.PAYMENTS,
    description: 'All payment fields (entire type)',
    graphqlType: 'Payment',
    implementedInStory: 'Future',
    requiresPartnerRole: true,
  },

  // KPIs & Reports
  {
    field: FinancialField.KPI_ALL,
    category: FinancialFieldCategory.KPI_REPORTS,
    description: 'All financial KPI metrics',
    graphqlType: 'KPI',
    implementedInStory: 'Future',
    requiresPartnerRole: true,
  },
];
