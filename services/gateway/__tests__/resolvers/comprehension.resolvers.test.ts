/**
 * Case Comprehension Resolvers Unit Tests
 *
 * Tests for the case comprehension GraphQL resolvers including:
 * - Authentication requirements
 * - Input validation
 * - Soft delete behavior
 * - Multi-tenancy access control
 * - Role-based permissions
 */

// ============================================================================
// Mock Setup - All mocks must be defined BEFORE imports
// ============================================================================

const mockComprehensionAgentService = {
  generate: jest.fn(),
};

const mockComprehensionTriggerService = {
  handleEvent: jest.fn().mockResolvedValue(undefined),
};

const mockCheckRateLimit = jest.fn();

const mockPrisma = {
  case: {
    findUnique: jest.fn(),
  },
  caseComprehension: {
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  comprehensionAgentRun: {
    findMany: jest.fn(),
  },
  comprehensionCorrection: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
};

// Mock dependencies before importing
jest.mock('../../src/services/comprehension-agent.service', () => ({
  comprehensionAgentService: mockComprehensionAgentService,
  ComprehensionResult: {},
}));

jest.mock('../../src/services/comprehension-trigger.service', () => ({
  comprehensionTriggerService: mockComprehensionTriggerService,
}));

jest.mock('@legal-platform/database', () => ({
  prisma: mockPrisma,
}));

jest.mock('../../src/middleware/rate-limit.middleware', () => ({
  checkComprehensionGenerationRateLimit: mockCheckRateLimit,
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Import after mocks - crypto is NOT mocked because createHash uses native implementation
// Tests that reach createHash will pass since the actual crypto functions work
import {
  comprehensionQueryResolvers,
  comprehensionMutationResolvers,
} from '../../src/graphql/resolvers/comprehension.resolvers';

// ============================================================================
// Test Fixtures
// ============================================================================

interface TestContext {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'AssociateJr' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
}

const TEST_FIRM_ID = 'firm-123';
const OTHER_FIRM_ID = 'firm-other';
const TEST_CASE_ID = 'case-456';
const TEST_USER_ID = 'user-789';
const TEST_COMPREHENSION_ID = 'comp-001';

function createContext(
  role: TestContext['user']['role'] = 'Partner',
  firmId: string = TEST_FIRM_ID
): TestContext {
  return {
    user: {
      id: TEST_USER_ID,
      firmId,
      role,
      email: 'test@example.com',
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Comprehension Resolvers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Query Tests
  // ==========================================================================

  describe('Query: caseComprehension', () => {
    it('should require authentication', async () => {
      const context: TestContext = {}; // No user

      await expect(
        comprehensionQueryResolvers.caseComprehension({}, { caseId: TEST_CASE_ID }, context)
      ).rejects.toThrow('Authentication required');
    });

    it('should require Associate or above role', async () => {
      const context = createContext('Paralegal');

      await expect(
        comprehensionQueryResolvers.caseComprehension({}, { caseId: TEST_CASE_ID }, context)
      ).rejects.toThrow('Acces interzis');
    });

    it('should allow Associate role', async () => {
      const context = createContext('Associate');
      mockPrisma.case.findUnique.mockResolvedValue({ firmId: TEST_FIRM_ID });
      mockPrisma.caseComprehension.findUnique.mockResolvedValue(null);

      const result = await comprehensionQueryResolvers.caseComprehension(
        {},
        { caseId: TEST_CASE_ID },
        context
      );

      expect(result).toBeNull();
    });

    it('should allow Partner role', async () => {
      const context = createContext('Partner');
      mockPrisma.case.findUnique.mockResolvedValue({ firmId: TEST_FIRM_ID });
      mockPrisma.caseComprehension.findUnique.mockResolvedValue({
        id: TEST_COMPREHENSION_ID,
        caseId: TEST_CASE_ID,
        currentPicture: 'Test narrative',
        corrections: [],
      });

      const result = await comprehensionQueryResolvers.caseComprehension(
        {},
        { caseId: TEST_CASE_ID },
        context
      );

      expect(result).not.toBeNull();
      expect(result.id).toBe(TEST_COMPREHENSION_ID);
    });

    it('should enforce multi-tenancy - deny access to other firm cases', async () => {
      const context = createContext('Partner');
      mockPrisma.case.findUnique.mockResolvedValue({ firmId: OTHER_FIRM_ID });

      await expect(
        comprehensionQueryResolvers.caseComprehension({}, { caseId: TEST_CASE_ID }, context)
      ).rejects.toThrow('Dosarul nu a fost găsit sau accesul este interzis');
    });

    it('should return null when case has no comprehension', async () => {
      const context = createContext('Partner');
      mockPrisma.case.findUnique.mockResolvedValue({ firmId: TEST_FIRM_ID });
      mockPrisma.caseComprehension.findUnique.mockResolvedValue(null);

      const result = await comprehensionQueryResolvers.caseComprehension(
        {},
        { caseId: TEST_CASE_ID },
        context
      );

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Mutation Tests: generateCaseComprehension
  // ==========================================================================

  describe('Mutation: generateCaseComprehension', () => {
    beforeEach(() => {
      mockPrisma.case.findUnique.mockResolvedValue({ firmId: TEST_FIRM_ID });
      mockCheckRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0, remaining: 4 });
      mockComprehensionAgentService.generate.mockResolvedValue({
        id: 'comp-1',
        currentPicture: 'Generated content',
      });
      mockPrisma.caseComprehension.findUnique.mockResolvedValue({
        id: 'comp-1',
        caseId: TEST_CASE_ID,
        currentPicture: 'Generated content',
        corrections: [],
      });
    });

    it('should check rate limit before generating', async () => {
      const context = createContext('Associate');

      await comprehensionMutationResolvers.generateCaseComprehension(
        {},
        { caseId: TEST_CASE_ID },
        context
      );

      expect(mockCheckRateLimit).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('should reject when rate limit exceeded', async () => {
      const context = createContext('Associate');
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        retryAfter: 1800,
        remaining: 0,
      });

      await expect(
        comprehensionMutationResolvers.generateCaseComprehension(
          {},
          { caseId: TEST_CASE_ID },
          context
        )
      ).rejects.toThrow('Limită de generare depășită');
    });

    it('should allow generation when within rate limit', async () => {
      const context = createContext('Associate');

      const result = await comprehensionMutationResolvers.generateCaseComprehension(
        {},
        { caseId: TEST_CASE_ID },
        context
      );

      expect(mockComprehensionAgentService.generate).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'comp-1');
    });

    it('should require Associate or above role', async () => {
      const context = createContext('Paralegal');

      await expect(
        comprehensionMutationResolvers.generateCaseComprehension(
          {},
          { caseId: TEST_CASE_ID },
          context
        )
      ).rejects.toThrow('Acces interzis');
    });
  });

  // ==========================================================================
  // Mutation Tests: addComprehensionCorrection
  // ==========================================================================

  describe('Mutation: addComprehensionCorrection', () => {
    const validInput = {
      caseId: TEST_CASE_ID,
      anchorText: 'Some text to anchor',
      correctionType: 'OVERRIDE' as const,
      correctedValue: 'Corrected value',
      reason: 'Test reason',
    };

    beforeEach(() => {
      mockPrisma.case.findUnique.mockResolvedValue({ firmId: TEST_FIRM_ID });
      mockPrisma.caseComprehension.findUnique.mockResolvedValue({ id: TEST_COMPREHENSION_ID });
      mockComprehensionTriggerService.handleEvent.mockResolvedValue(undefined);
    });

    describe('role-based access', () => {
      it('should require Partner role', async () => {
        const context = createContext('Associate');

        await expect(
          comprehensionMutationResolvers.addComprehensionCorrection(
            {},
            { input: validInput },
            context
          )
        ).rejects.toThrow('Acces interzis. Doar partenerii pot modifica contextul');
      });

      it('should allow Partner role', async () => {
        const context = createContext('Partner');
        mockPrisma.comprehensionCorrection.create.mockResolvedValue({
          id: 'correction-1',
          ...validInput,
        });

        const result = await comprehensionMutationResolvers.addComprehensionCorrection(
          {},
          { input: validInput },
          context
        );

        expect(result.id).toBe('correction-1');
      });

      it('should allow BusinessOwner role', async () => {
        const context = createContext('BusinessOwner');
        mockPrisma.comprehensionCorrection.create.mockResolvedValue({
          id: 'correction-1',
          ...validInput,
        });

        const result = await comprehensionMutationResolvers.addComprehensionCorrection(
          {},
          { input: validInput },
          context
        );

        expect(result).toBeDefined();
      });
    });

    describe('input validation', () => {
      it('should reject empty anchorText', async () => {
        const context = createContext('Partner');
        const input = { ...validInput, anchorText: '' };

        await expect(
          comprehensionMutationResolvers.addComprehensionCorrection({}, { input }, context)
        ).rejects.toThrow('Textul de ancorare este obligatoriu');
      });

      it('should reject whitespace-only anchorText', async () => {
        const context = createContext('Partner');
        const input = { ...validInput, anchorText: '   ' };

        await expect(
          comprehensionMutationResolvers.addComprehensionCorrection({}, { input }, context)
        ).rejects.toThrow('Textul de ancorare este obligatoriu');
      });

      it('should reject anchorText over 500 characters', async () => {
        const context = createContext('Partner');
        const input = { ...validInput, anchorText: 'x'.repeat(501) };

        await expect(
          comprehensionMutationResolvers.addComprehensionCorrection({}, { input }, context)
        ).rejects.toThrow('Textul de ancorare nu poate depăși 500 de caractere');
      });

      it('should reject empty correctedValue', async () => {
        const context = createContext('Partner');
        const input = { ...validInput, correctedValue: '' };

        await expect(
          comprehensionMutationResolvers.addComprehensionCorrection({}, { input }, context)
        ).rejects.toThrow('Valoarea corectată este obligatorie');
      });

      it('should reject correctedValue over 10,000 characters', async () => {
        const context = createContext('Partner');
        const input = { ...validInput, correctedValue: 'x'.repeat(10001) };

        await expect(
          comprehensionMutationResolvers.addComprehensionCorrection({}, { input }, context)
        ).rejects.toThrow('Valoarea corectată nu poate depăși 10.000 de caractere');
      });

      it('should reject reason over 1,000 characters', async () => {
        const context = createContext('Partner');
        const input = { ...validInput, reason: 'x'.repeat(1001) };

        await expect(
          comprehensionMutationResolvers.addComprehensionCorrection({}, { input }, context)
        ).rejects.toThrow('Motivul nu poate depăși 1.000 de caractere');
      });

      it('should allow reason to be undefined', async () => {
        const context = createContext('Partner');
        const input = { ...validInput, reason: undefined };
        mockPrisma.comprehensionCorrection.create.mockResolvedValue({
          id: 'correction-1',
          ...input,
        });

        const result = await comprehensionMutationResolvers.addComprehensionCorrection(
          {},
          { input },
          context
        );

        expect(result).toBeDefined();
      });

      it('should allow valid input at boundary lengths', async () => {
        const context = createContext('Partner');
        const input = {
          ...validInput,
          anchorText: 'x'.repeat(500), // Max length
          correctedValue: 'y'.repeat(10000), // Max length
          reason: 'z'.repeat(1000), // Max length
        };
        mockPrisma.comprehensionCorrection.create.mockResolvedValue({
          id: 'correction-1',
          ...input,
        });

        const result = await comprehensionMutationResolvers.addComprehensionCorrection(
          {},
          { input },
          context
        );

        expect(result).toBeDefined();
      });
    });

    describe('regeneration trigger', () => {
      it('should pass correctionIds when triggering regeneration', async () => {
        const context = createContext('Partner');
        const createdCorrection = { id: 'correction-new', ...validInput };
        mockPrisma.comprehensionCorrection.create.mockResolvedValue(createdCorrection);

        await comprehensionMutationResolvers.addComprehensionCorrection(
          {},
          { input: validInput },
          context
        );

        // Verify trigger service was called with the correction ID
        expect(mockComprehensionTriggerService.handleEvent).toHaveBeenCalledWith(
          validInput.caseId,
          'correction_added',
          TEST_FIRM_ID,
          expect.objectContaining({
            userId: TEST_USER_ID,
            correctionIds: ['correction-new'],
          })
        );
      });
    });

    describe('multi-tenancy', () => {
      it('should deny access to other firm cases', async () => {
        const context = createContext('Partner');
        mockPrisma.case.findUnique.mockResolvedValue({ firmId: OTHER_FIRM_ID });

        await expect(
          comprehensionMutationResolvers.addComprehensionCorrection(
            {},
            { input: validInput },
            context
          )
        ).rejects.toThrow('Dosarul nu a fost găsit sau accesul este interzis');
      });
    });
  });

  // ==========================================================================
  // Mutation Tests: deleteComprehensionCorrection
  // ==========================================================================

  describe('Mutation: deleteComprehensionCorrection', () => {
    const TEST_CORRECTION_ID = 'correction-123';

    it('should require Partner role', async () => {
      const context = createContext('Associate');

      await expect(
        comprehensionMutationResolvers.deleteComprehensionCorrection(
          {},
          { id: TEST_CORRECTION_ID },
          context
        )
      ).rejects.toThrow('Acces interzis');
    });

    it('should soft-delete by setting isActive to false', async () => {
      const context = createContext('Partner');
      mockPrisma.comprehensionCorrection.findUnique.mockResolvedValue({
        id: TEST_CORRECTION_ID,
        isActive: true,
        comprehension: { firmId: TEST_FIRM_ID },
      });
      mockPrisma.comprehensionCorrection.update.mockResolvedValue({
        id: TEST_CORRECTION_ID,
        isActive: false,
      });

      const result = await comprehensionMutationResolvers.deleteComprehensionCorrection(
        {},
        { id: TEST_CORRECTION_ID },
        context
      );

      expect(result).toBe(true);
      expect(mockPrisma.comprehensionCorrection.update).toHaveBeenCalledWith({
        where: { id: TEST_CORRECTION_ID },
        data: { isActive: false },
      });
    });

    it('should deny access to other firm corrections', async () => {
      const context = createContext('Partner');
      mockPrisma.comprehensionCorrection.findUnique.mockResolvedValue({
        id: TEST_CORRECTION_ID,
        comprehension: { firmId: OTHER_FIRM_ID },
      });

      await expect(
        comprehensionMutationResolvers.deleteComprehensionCorrection(
          {},
          { id: TEST_CORRECTION_ID },
          context
        )
      ).rejects.toThrow('Correction not found or access denied');
    });

    it('should handle non-existent correction', async () => {
      const context = createContext('Partner');
      mockPrisma.comprehensionCorrection.findUnique.mockResolvedValue(null);

      await expect(
        comprehensionMutationResolvers.deleteComprehensionCorrection(
          {},
          { id: 'non-existent' },
          context
        )
      ).rejects.toThrow('Correction not found or access denied');
    });
  });

  // ==========================================================================
  // Mutation Tests: updateComprehensionCorrection
  // ==========================================================================

  describe('Mutation: updateComprehensionCorrection', () => {
    const TEST_CORRECTION_ID = 'correction-123';

    it('should require Partner role', async () => {
      const context = createContext('Associate');

      await expect(
        comprehensionMutationResolvers.updateComprehensionCorrection(
          {},
          { id: TEST_CORRECTION_ID, isActive: false },
          context
        )
      ).rejects.toThrow('Acces interzis');
    });

    it('should allow Partner to toggle isActive', async () => {
      const context = createContext('Partner');
      mockPrisma.comprehensionCorrection.findUnique.mockResolvedValue({
        id: TEST_CORRECTION_ID,
        isActive: true,
        comprehension: { firmId: TEST_FIRM_ID },
      });
      mockPrisma.comprehensionCorrection.update.mockResolvedValue({
        id: TEST_CORRECTION_ID,
        isActive: false,
      });

      const result = await comprehensionMutationResolvers.updateComprehensionCorrection(
        {},
        { id: TEST_CORRECTION_ID, isActive: false },
        context
      );

      expect(result.isActive).toBe(false);
    });
  });
});
