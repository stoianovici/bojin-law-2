/**
 * Case Factory Tests
 */

import {
  createCase,
  createActiveCase,
  createOnHoldCase,
  createClosedCase,
  createArchivedCase,
  createCases,
} from './case.factory';

describe('Case Factory', () => {
  describe('createCase', () => {
    it('should create a valid Case entity', () => {
      const caseEntity = createCase();

      expect(caseEntity).toMatchObject({
        id: expect.any(String),
        caseNumber: expect.any(String),
        title: expect.any(String),
        clientId: expect.any(String),
        status: expect.stringMatching(/^(Active|OnHold|Closed|Archived)$/),
        type: expect.any(String),
        description: expect.any(String),
        openedDate: expect.any(Date),
        metadata: expect.any(Object),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should generate valid case numbers', () => {
      const caseEntity = createCase();
      // Format: YYYY-XXX-NNNN (e.g., 2024-CIV-0123)
      expect(caseEntity.caseNumber).toMatch(/^\d{4}-[A-Z]+-\d{4}$/);
    });

    it('should set closedDate to null for Active and OnHold cases', () => {
      const activeCase = createCase({ status: 'Active' });
      const onHoldCase = createCase({ status: 'OnHold' });

      expect(activeCase.closedDate).toBeNull();
      expect(onHoldCase.closedDate).toBeNull();
    });

    it('should set closedDate for Closed and Archived cases', () => {
      const closedCase = createCase({ status: 'Closed' });
      const archivedCase = createCase({ status: 'Archived' });

      expect(closedCase.closedDate).toBeInstanceOf(Date);
      expect(archivedCase.closedDate).toBeInstanceOf(Date);
    });

    it('should ensure closedDate is after openedDate', () => {
      const closedCase = createCase({ status: 'Closed' });

      if (closedCase.closedDate) {
        expect(closedCase.closedDate.getTime()).toBeGreaterThan(closedCase.openedDate.getTime());
      }
    });

    it('should accept overrides', () => {
      const customTitle = 'Custom Case Title';
      const caseEntity = createCase({ title: customTitle, status: 'Active' });

      expect(caseEntity.title).toBe(customTitle);
      expect(caseEntity.status).toBe('Active');
    });

    it('should include Romanian case types', () => {
      // Run multiple times to increase chance of getting Romanian types
      const cases = Array.from({ length: 50 }, () => createCase());
      const hasRomanianType = cases.some((c) => /[ăâîșț]/i.test(c.type));

      expect(hasRomanianType).toBe(true);
    });

    it('should have valid metadata', () => {
      const caseEntity = createCase();

      expect(caseEntity.metadata).toHaveProperty('court');
      expect(caseEntity.metadata).toHaveProperty('judge');
      expect(caseEntity.metadata).toHaveProperty('urgency');
    });

    it('should have value as number or null', () => {
      const caseEntity = createCase();
      expect(typeof caseEntity.value === 'number' || caseEntity.value === null).toBe(true);
    });
  });

  describe('createActiveCase', () => {
    it('should create a Case with Active status', () => {
      const activeCase = createActiveCase();
      expect(activeCase.status).toBe('Active');
      expect(activeCase.closedDate).toBeNull();
    });

    it('should accept overrides while maintaining Active status', () => {
      const activeCase = createActiveCase({ title: 'Active Case' });
      expect(activeCase.status).toBe('Active');
      expect(activeCase.title).toBe('Active Case');
    });
  });

  describe('createOnHoldCase', () => {
    it('should create a Case with OnHold status', () => {
      const onHoldCase = createOnHoldCase();
      expect(onHoldCase.status).toBe('OnHold');
      expect(onHoldCase.closedDate).toBeNull();
    });

    it('should accept overrides while maintaining OnHold status', () => {
      const onHoldCase = createOnHoldCase({ title: 'On Hold Case' });
      expect(onHoldCase.status).toBe('OnHold');
      expect(onHoldCase.title).toBe('On Hold Case');
    });
  });

  describe('createClosedCase', () => {
    it('should create a Case with Closed status', () => {
      const closedCase = createClosedCase();
      expect(closedCase.status).toBe('Closed');
      expect(closedCase.closedDate).toBeInstanceOf(Date);
    });

    it('should accept overrides while maintaining Closed status', () => {
      const closedCase = createClosedCase({ title: 'Closed Case' });
      expect(closedCase.status).toBe('Closed');
      expect(closedCase.title).toBe('Closed Case');
    });
  });

  describe('createArchivedCase', () => {
    it('should create a Case with Archived status', () => {
      const archivedCase = createArchivedCase();
      expect(archivedCase.status).toBe('Archived');
      expect(archivedCase.closedDate).toBeInstanceOf(Date);
    });

    it('should accept overrides while maintaining Archived status', () => {
      const archivedCase = createArchivedCase({ title: 'Archived Case' });
      expect(archivedCase.status).toBe('Archived');
      expect(archivedCase.title).toBe('Archived Case');
    });
  });

  describe('createCases', () => {
    it('should create specified number of cases', () => {
      const cases = createCases(5);
      expect(cases).toHaveLength(5);
    });

    it('should create cases with different IDs', () => {
      const cases = createCases(10);
      const ids = cases.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    it('should apply overrides to all cases', () => {
      const cases = createCases(3, { status: 'Active' });
      cases.forEach((caseEntity) => {
        expect(caseEntity.status).toBe('Active');
      });
    });
  });
});
