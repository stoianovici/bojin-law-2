/**
 * Tests for Financial Types and Field Taxonomy
 * Story 2.8.3: Role-Based Financial Visibility
 */

import {
  FinancialField,
  FinancialFieldCategory,
  FINANCIAL_FIELD_CATEGORIES,
  FINANCIAL_FIELDS_METADATA,
  isFinancialField,
} from './financial';

describe('Financial Types', () => {
  describe('FinancialField enum', () => {
    it('should define all current financial fields', () => {
      expect(FinancialField.CASE_VALUE).toBe('Case.value');
    });

    it('should define future case financial fields', () => {
      expect(FinancialField.CASE_BILLING_TYPE).toBe('Case.billingType');
      expect(FinancialField.CASE_FIXED_AMOUNT).toBe('Case.fixedAmount');
      expect(FinancialField.CASE_CUSTOM_RATES).toBe('Case.customRates');
      expect(FinancialField.CASE_RATE_HISTORY).toBe('Case.rateHistory');
    });

    it('should define time tracking financial fields', () => {
      expect(FinancialField.TIME_ENTRY_RATE).toBe('TimeEntry.rate');
      expect(FinancialField.TIME_ENTRY_BILLABLE_AMOUNT).toBe('TimeEntry.billableAmount');
    });

    it('should define firm settings financial fields', () => {
      expect(FinancialField.FIRM_DEFAULT_RATES).toBe('Firm.defaultRates');
    });

    it('should define invoice and payment fields', () => {
      expect(FinancialField.INVOICE_ALL).toBe('Invoice.*');
      expect(FinancialField.PAYMENT_ALL).toBe('Payment.*');
      expect(FinancialField.KPI_ALL).toBe('KPI.*');
    });
  });

  describe('isFinancialField', () => {
    it('should return true for valid financial fields', () => {
      expect(isFinancialField('Case.value')).toBe(true);
      expect(isFinancialField('Case.billingType')).toBe(true);
      expect(isFinancialField('TimeEntry.rate')).toBe(true);
    });

    it('should return false for non-financial fields', () => {
      expect(isFinancialField('Case.title')).toBe(false);
      expect(isFinancialField('Case.status')).toBe(false);
      expect(isFinancialField('User.email')).toBe(false);
      expect(isFinancialField('invalid')).toBe(false);
    });
  });

  describe('FinancialFieldCategory enum', () => {
    it('should define all categories', () => {
      expect(FinancialFieldCategory.CASE_MANAGEMENT).toBe('Case Management');
      expect(FinancialFieldCategory.TIME_TRACKING).toBe('Time Tracking');
      expect(FinancialFieldCategory.BILLING_INVOICING).toBe('Billing & Invoicing');
      expect(FinancialFieldCategory.PAYMENTS).toBe('Payments');
      expect(FinancialFieldCategory.KPI_REPORTS).toBe('KPIs & Reports');
      expect(FinancialFieldCategory.SETTINGS).toBe('Settings');
    });
  });

  describe('FINANCIAL_FIELD_CATEGORIES mapping', () => {
    it('should map all financial fields to categories', () => {
      // Get all enum values
      const allFields = Object.values(FinancialField);

      // Verify all fields have category mappings
      allFields.forEach((field) => {
        expect(FINANCIAL_FIELD_CATEGORIES[field]).toBeDefined();
      });
    });

    it('should correctly categorize case management fields', () => {
      expect(FINANCIAL_FIELD_CATEGORIES[FinancialField.CASE_VALUE]).toBe(
        FinancialFieldCategory.CASE_MANAGEMENT
      );
      expect(FINANCIAL_FIELD_CATEGORIES[FinancialField.CASE_BILLING_TYPE]).toBe(
        FinancialFieldCategory.CASE_MANAGEMENT
      );
    });

    it('should correctly categorize time tracking fields', () => {
      expect(FINANCIAL_FIELD_CATEGORIES[FinancialField.TIME_ENTRY_RATE]).toBe(
        FinancialFieldCategory.TIME_TRACKING
      );
    });

    it('should correctly categorize settings fields', () => {
      expect(FINANCIAL_FIELD_CATEGORIES[FinancialField.FIRM_DEFAULT_RATES]).toBe(
        FinancialFieldCategory.SETTINGS
      );
    });
  });

  describe('FINANCIAL_FIELDS_METADATA', () => {
    it('should define metadata for all financial fields', () => {
      // Get all enum values
      const allFields = Object.values(FinancialField);

      // Verify metadata exists for all fields
      expect(FINANCIAL_FIELDS_METADATA.length).toBe(allFields.length);
    });

    it('should have valid metadata structure', () => {
      FINANCIAL_FIELDS_METADATA.forEach((metadata) => {
        // Verify required properties exist
        expect(metadata.field).toBeDefined();
        expect(metadata.category).toBeDefined();
        expect(metadata.description).toBeDefined();
        expect(metadata.graphqlType).toBeDefined();
        expect(metadata.implementedInStory).toBeDefined();
        expect(metadata.requiresPartnerRole).toBe(true);

        // Verify field is a valid FinancialField enum value
        expect(Object.values(FinancialField)).toContain(metadata.field);

        // Verify category is a valid FinancialFieldCategory enum value
        expect(Object.values(FinancialFieldCategory)).toContain(metadata.category);
      });
    });

    it('should include Case.value metadata', () => {
      const caseValueMetadata = FINANCIAL_FIELDS_METADATA.find(
        (m) => m.field === FinancialField.CASE_VALUE
      );

      expect(caseValueMetadata).toBeDefined();
      expect(caseValueMetadata?.description).toBe('Monetary value of the case');
      expect(caseValueMetadata?.graphqlType).toBe('Float');
      expect(caseValueMetadata?.implementedInStory).toBe('2.8');
      expect(caseValueMetadata?.requiresPartnerRole).toBe(true);
    });

    it('should include future billing fields metadata', () => {
      const billingTypeMetadata = FINANCIAL_FIELDS_METADATA.find(
        (m) => m.field === FinancialField.CASE_BILLING_TYPE
      );

      expect(billingTypeMetadata).toBeDefined();
      expect(billingTypeMetadata?.implementedInStory).toBe('2.8.1');
    });

    it('should mark all fields as requiring Partner role', () => {
      FINANCIAL_FIELDS_METADATA.forEach((metadata) => {
        expect(metadata.requiresPartnerRole).toBe(true);
      });
    });
  });

  describe('Field taxonomy completeness', () => {
    it('should have no duplicate field definitions', () => {
      const fieldValues = FINANCIAL_FIELDS_METADATA.map((m) => m.field);
      const uniqueFields = new Set(fieldValues);

      expect(fieldValues.length).toBe(uniqueFields.size);
    });

    it('should cover all categories', () => {
      const categories = FINANCIAL_FIELDS_METADATA.map((m) => m.category);
      const uniqueCategories = new Set(categories);

      // Verify all category enum values are used
      Object.values(FinancialFieldCategory).forEach((category) => {
        expect(uniqueCategories.has(category)).toBe(true);
      });
    });

    it('should include current and future implementations', () => {
      const currentFields = FINANCIAL_FIELDS_METADATA.filter((m) => m.implementedInStory === '2.8');
      const futureFields = FINANCIAL_FIELDS_METADATA.filter((m) => m.implementedInStory !== '2.8');

      // Should have at least one current field
      expect(currentFields.length).toBeGreaterThan(0);

      // Should have multiple future fields
      expect(futureFields.length).toBeGreaterThan(0);
    });
  });
});
