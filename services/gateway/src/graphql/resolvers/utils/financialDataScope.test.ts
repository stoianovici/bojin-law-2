/**
 * Financial Data Scope Utilities Tests
 * Story 2.11.1: Business Owner Role & Financial Data Scope
 */

import {
  getFinancialDataScope,
  getFinancialDataFilter,
  hasFinancialAccess,
  isBusinessOwner,
  type FinancialDataScope,
} from './financialDataScope';
import type { Context } from '../case.resolvers';

// Helper to create mock context
function createMockContext(
  role: string | null,
  authenticated: boolean = true,
  userId: string = 'user-123',
  firmId: string = 'firm-456'
): Context {
  return {
    user: authenticated && role
      ? {
          id: userId,
          firmId,
          role,
          email: 'test@example.com',
        }
      : undefined,
  } as Context;
}

describe('Financial Data Scope Utilities', () => {
  describe('getFinancialDataScope', () => {
    it('returns "firm" for BusinessOwner', () => {
      const context = createMockContext('BusinessOwner');
      expect(getFinancialDataScope(context)).toBe('firm');
    });

    it('returns "own" for Partner', () => {
      const context = createMockContext('Partner');
      expect(getFinancialDataScope(context)).toBe('own');
    });

    it('throws FORBIDDEN error for Associate', () => {
      const context = createMockContext('Associate');
      expect(() => getFinancialDataScope(context)).toThrow();
      try {
        getFinancialDataScope(context);
      } catch (error: any) {
        expect(error.message).toBe('Financial data access denied');
        expect(error.extensions.code).toBe('FORBIDDEN');
        expect(error.extensions.requiredRoles).toEqual(['Partner', 'BusinessOwner']);
        expect(error.extensions.userRole).toBe('Associate');
      }
    });

    it('throws FORBIDDEN error for Paralegal', () => {
      const context = createMockContext('Paralegal');
      expect(() => getFinancialDataScope(context)).toThrow();
      try {
        getFinancialDataScope(context);
      } catch (error: any) {
        expect(error.message).toBe('Financial data access denied');
        expect(error.extensions.code).toBe('FORBIDDEN');
      }
    });

    it('throws UNAUTHENTICATED error when user is not authenticated', () => {
      const context = createMockContext(null, false);
      expect(() => getFinancialDataScope(context)).toThrow();
      try {
        getFinancialDataScope(context);
      } catch (error: any) {
        expect(error.message).toBe('Authentication required');
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
      }
    });
  });

  describe('getFinancialDataFilter', () => {
    it('returns firm-wide filter for BusinessOwner', () => {
      const context = createMockContext('BusinessOwner', true, 'owner-123', 'firm-abc');
      const filter = getFinancialDataFilter(context);

      expect(filter).toEqual({
        firmId: 'firm-abc',
      });
    });

    it('returns managed-cases filter for Partner', () => {
      const context = createMockContext('Partner', true, 'partner-123', 'firm-def');
      const filter = getFinancialDataFilter(context);

      expect(filter).toEqual({
        firmId: 'firm-def',
        teamMembers: {
          some: {
            userId: 'partner-123',
            role: 'Lead',
          },
        },
      });
    });

    it('throws error for Associate', () => {
      const context = createMockContext('Associate');
      expect(() => getFinancialDataFilter(context)).toThrow();
    });

    it('throws error for Paralegal', () => {
      const context = createMockContext('Paralegal');
      expect(() => getFinancialDataFilter(context)).toThrow();
    });

    it('throws UNAUTHENTICATED error when user is not authenticated', () => {
      const context = createMockContext(null, false);
      expect(() => getFinancialDataFilter(context)).toThrow();
    });
  });

  describe('hasFinancialAccess', () => {
    it('returns true for BusinessOwner', () => {
      const context = createMockContext('BusinessOwner');
      expect(hasFinancialAccess(context)).toBe(true);
    });

    it('returns true for Partner', () => {
      const context = createMockContext('Partner');
      expect(hasFinancialAccess(context)).toBe(true);
    });

    it('returns false for Associate', () => {
      const context = createMockContext('Associate');
      expect(hasFinancialAccess(context)).toBe(false);
    });

    it('returns false for Paralegal', () => {
      const context = createMockContext('Paralegal');
      expect(hasFinancialAccess(context)).toBe(false);
    });

    it('returns false when user is not authenticated', () => {
      const context = createMockContext(null, false);
      expect(hasFinancialAccess(context)).toBe(false);
    });

    it('returns false when context has no user', () => {
      const context = {} as Context;
      expect(hasFinancialAccess(context)).toBe(false);
    });
  });

  describe('isBusinessOwner', () => {
    it('returns true for BusinessOwner', () => {
      const context = createMockContext('BusinessOwner');
      expect(isBusinessOwner(context)).toBe(true);
    });

    it('returns false for Partner', () => {
      const context = createMockContext('Partner');
      expect(isBusinessOwner(context)).toBe(false);
    });

    it('returns false for Associate', () => {
      const context = createMockContext('Associate');
      expect(isBusinessOwner(context)).toBe(false);
    });

    it('returns false for Paralegal', () => {
      const context = createMockContext('Paralegal');
      expect(isBusinessOwner(context)).toBe(false);
    });

    it('returns false when user is not authenticated', () => {
      const context = createMockContext(null, false);
      expect(isBusinessOwner(context)).toBe(false);
    });
  });

  describe('Scope type validation', () => {
    it('scope types are correctly typed', () => {
      const firmScope: FinancialDataScope = 'firm';
      const ownScope: FinancialDataScope = 'own';

      expect(firmScope).toBe('firm');
      expect(ownScope).toBe('own');
    });
  });

  // ============================================================================
  // Story 2.11.5 - Additional Edge Cases (Task 1)
  // ============================================================================

  describe('Edge Cases - Story 2.11.5', () => {
    describe('User with no cases', () => {
      it('Partner filter should still be valid (will return empty results)', () => {
        const context = createMockContext('Partner', true, 'partner-no-cases', 'firm-123');
        const filter = getFinancialDataFilter(context);

        // Filter is valid and scoped - when applied, will return empty dataset
        expect(filter).toEqual({
          firmId: 'firm-123',
          teamMembers: {
            some: {
              userId: 'partner-no-cases',
              role: 'Lead',
            },
          },
        });
      });

      it('BusinessOwner filter should still be valid (will return empty results for new firm)', () => {
        const context = createMockContext('BusinessOwner', true, 'owner-new', 'firm-new');
        const filter = getFinancialDataFilter(context);

        // Filter is valid - when applied to a firm with no cases, will return empty dataset
        expect(filter).toEqual({
          firmId: 'firm-new',
        });
      });
    });

    describe('Cross-firm isolation', () => {
      it('filters for different firms should be completely isolated', () => {
        const contextFirmA = createMockContext('BusinessOwner', true, 'owner-a', 'firm-alpha');
        const contextFirmB = createMockContext('BusinessOwner', true, 'owner-b', 'firm-beta');

        const filterA = getFinancialDataFilter(contextFirmA);
        const filterB = getFinancialDataFilter(contextFirmB);

        // Verify complete isolation
        expect(filterA.firmId).toBe('firm-alpha');
        expect(filterB.firmId).toBe('firm-beta');
        expect(filterA.firmId).not.toBe(filterB.firmId);
      });

      it('Partner filters should include both firm and user isolation', () => {
        const contextFirmA = createMockContext('Partner', true, 'partner-a', 'firm-alpha');
        const contextFirmB = createMockContext('Partner', true, 'partner-b', 'firm-beta');

        const filterA = getFinancialDataFilter(contextFirmA);
        const filterB = getFinancialDataFilter(contextFirmB);

        // Verify firm isolation
        expect(filterA.firmId).toBe('firm-alpha');
        expect(filterB.firmId).toBe('firm-beta');

        // Verify user isolation
        expect(filterA.teamMembers?.some?.userId).toBe('partner-a');
        expect(filterB.teamMembers?.some?.userId).toBe('partner-b');
      });

      it('BusinessOwner in Firm A should not be able to access Firm B data via filter', () => {
        // Even if someone tried to modify the filter, the firmId is tied to user's context
        const contextFirmA = createMockContext('BusinessOwner', true, 'owner-a', 'firm-alpha');
        const filter = getFinancialDataFilter(contextFirmA);

        // The filter is constrained to user's firm - no way to access other firms
        expect(filter.firmId).toBe('firm-alpha');
        // Cannot query with a different firmId without creating a new context
      });

      it('Partner should never see cases from another firm even if same userId exists', () => {
        // Hypothetical: Same user ID exists in two firms (shouldn't happen, but testing defense)
        const contextFirmA = createMockContext('Partner', true, 'shared-partner-id', 'firm-alpha');
        const contextFirmB = createMockContext('Partner', true, 'shared-partner-id', 'firm-beta');

        const filterA = getFinancialDataFilter(contextFirmA);
        const filterB = getFinancialDataFilter(contextFirmB);

        // Both filters require firmId match - firm isolation preserved
        expect(filterA.firmId).toBe('firm-alpha');
        expect(filterB.firmId).toBe('firm-beta');
      });
    });

    describe('Multiple role scenarios', () => {
      it('should throw for Admin role (non-financial role)', () => {
        const context = createMockContext('Admin');
        expect(() => getFinancialDataScope(context)).toThrow();
        try {
          getFinancialDataScope(context);
        } catch (error: any) {
          expect(error.extensions.code).toBe('FORBIDDEN');
        }
      });

      it('should throw for unknown roles', () => {
        const context = createMockContext('UnknownRole');
        expect(() => getFinancialDataScope(context)).toThrow();
      });

      it('should handle empty string role', () => {
        // Empty string role - create context manually since helper treats '' as falsy
        const context = {
          user: {
            id: 'user-123',
            firmId: 'firm-456',
            role: '' as any, // Force empty string for edge case testing
            email: 'test@example.com',
          },
        } as unknown as Context;
        expect(() => getFinancialDataScope(context)).toThrow();
        try {
          getFinancialDataScope(context);
        } catch (error: any) {
          expect(error.extensions.code).toBe('FORBIDDEN');
        }
      });
    });

    describe('Edge case with missing user properties', () => {
      it('should handle context with user but missing firmId', () => {
        const context = {
          user: {
            id: 'user-123',
            firmId: undefined as any, // Missing firmId
            role: 'Partner',
            email: 'test@example.com',
          },
        } as Context;

        // getFinancialDataScope should work (doesn't use firmId)
        expect(getFinancialDataScope(context)).toBe('own');

        // getFinancialDataFilter uses firmId - should return filter with undefined firmId
        // This edge case should be validated at higher levels
        const filter = getFinancialDataFilter(context);
        expect(filter.firmId).toBeUndefined();
      });

      it('should handle context with user but missing id', () => {
        const context = {
          user: {
            id: undefined as any, // Missing id
            firmId: 'firm-123',
            role: 'Partner',
            email: 'test@example.com',
          },
        } as Context;

        expect(getFinancialDataScope(context)).toBe('own');

        const filter = getFinancialDataFilter(context);
        expect(filter.teamMembers?.some?.userId).toBeUndefined();
      });
    });
  });
});
