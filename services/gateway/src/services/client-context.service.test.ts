/**
 * Client Context Service Tests
 * OPS-260: Client Context Aggregation Service
 */

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    client: {
      findUnique: jest.fn(),
    },
    case: {
      findMany: jest.fn(),
    },
    caseActor: {
      findMany: jest.fn(),
    },
    email: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  },
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  },
}));

import { ClientContextService, type ClientContext } from './client-context.service';
import { prisma, redis } from '@legal-platform/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRedis = redis as jest.Mocked<typeof redis>;

describe('ClientContextService', () => {
  let service: ClientContextService;
  const testFirmId = 'firm-123';
  const testClientId = 'client-456';

  // Sample client data
  const mockClient = {
    id: testClientId,
    name: 'SC Exemplu SRL',
    address: 'Str. Test Nr. 1, București',
    contactInfo: {
      email: 'contact@exemplu.ro',
      phone: '+40 21 123 4567',
      cui: 'RO12345678',
    },
    createdAt: new Date('2023-01-15'),
  };

  // Sample cases data
  const mockCases = [
    {
      id: 'case-1',
      title: 'Litigiu comercial Alpha',
      status: 'Active',
      type: 'Litigiu',
      createdAt: new Date('2024-06-01'),
    },
    {
      id: 'case-2',
      title: 'Contract furnizare Beta',
      status: 'Active',
      type: 'Contract',
      createdAt: new Date('2024-03-15'),
    },
    {
      id: 'case-3',
      title: 'Recuperare creanțe Gamma',
      status: 'Closed',
      type: 'Litigiu',
      createdAt: new Date('2023-08-01'),
    },
  ];

  // Sample case actors
  const mockActors = [
    {
      name: 'Ion Popescu',
      email: 'ion.popescu@exemplu.ro',
      phone: '+40 722 123 456',
      role: 'Client',
    },
    {
      name: 'Maria Ionescu',
      email: 'maria.ionescu@exemplu.ro',
      phone: null,
      role: 'Other',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClientContextService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getForClient', () => {
    it('should return cached context if exists', async () => {
      const cachedContext: ClientContext = {
        id: testClientId,
        name: 'SC Exemplu SRL',
        contactInfo: { email: 'test@test.ro' },
        relationshipStartDate: '2023-01-15T00:00:00.000Z',
        totalCaseCount: 3,
        activeCaseCount: 2,
        closedCaseCount: 1,
        casesByType: [],
        recentCases: [],
        primaryContacts: [],
        totalEmailCount: 0,
      };

      (mockRedis.get as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          data: cachedContext,
          contextText: 'cached text',
          cachedAt: new Date().toISOString(),
        })
      );

      const result = await service.getForClient(testClientId, testFirmId);

      expect(result).toEqual(cachedContext);
      expect(mockRedis.get).toHaveBeenCalledWith(`client-context:${testClientId}`);
      expect(mockPrisma.client.findUnique).not.toHaveBeenCalled();
    });

    it('should generate fresh context when cache miss', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(null);
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValueOnce(mockClient);
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValueOnce(mockCases);
      (mockPrisma.caseActor.findMany as jest.Mock).mockResolvedValueOnce(mockActors);
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValueOnce({
        receivedDateTime: new Date('2024-12-20'),
      });
      (mockPrisma.email.count as jest.Mock).mockResolvedValueOnce(45);

      const result = await service.getForClient(testClientId, testFirmId);

      expect(result.id).toBe(testClientId);
      expect(result.name).toBe('SC Exemplu SRL');
      expect(result.totalCaseCount).toBe(3);
      expect(result.activeCaseCount).toBe(2);
      expect(result.closedCaseCount).toBe(1);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should throw error when client not found', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(null);
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValueOnce([]);
      (mockPrisma.caseActor.findMany as jest.Mock).mockResolvedValueOnce([]);
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (mockPrisma.email.count as jest.Mock).mockResolvedValueOnce(0);

      await expect(service.getForClient(testClientId, testFirmId)).rejects.toThrow(
        `Client not found: ${testClientId}`
      );
    });
  });

  describe('generateContext - aggregations', () => {
    beforeEach(() => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(mockClient);
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValue(mockCases);
      (mockPrisma.caseActor.findMany as jest.Mock).mockResolvedValue(mockActors);
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.email.count as jest.Mock).mockResolvedValue(0);
    });

    it('should parse contact info from JSON', async () => {
      const result = await service.getForClient(testClientId, testFirmId);

      expect(result.contactInfo.email).toBe('contact@exemplu.ro');
      expect(result.contactInfo.phone).toBe('+40 21 123 4567');
      expect(result.contactInfo.cui).toBe('RO12345678');
    });

    it('should handle missing contact info gracefully', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockClient,
        contactInfo: {},
      });

      const result = await service.getForClient(testClientId, testFirmId);

      expect(result.contactInfo.email).toBeUndefined();
      expect(result.contactInfo.phone).toBeUndefined();
      expect(result.contactInfo.cui).toBeUndefined();
    });

    it('should aggregate cases by type correctly', async () => {
      const result = await service.getForClient(testClientId, testFirmId);

      // mockCases has 2 Litigiu cases and 1 Contract case
      expect(result.casesByType).toEqual([
        { type: 'Litigiu', count: 2 },
        { type: 'Contract', count: 1 },
      ]);
    });

    it('should return most recent cases first', async () => {
      const result = await service.getForClient(testClientId, testFirmId);

      // mockCases are already sorted by createdAt desc
      expect(result.recentCases.length).toBe(3);
      expect(result.recentCases[0].title).toBe('Litigiu comercial Alpha');
    });

    it('should limit recent cases to 5', async () => {
      const manyCases = Array.from({ length: 10 }, (_, i) => ({
        id: `case-${i}`,
        title: `Case ${i}`,
        status: 'Active',
        type: 'Litigiu',
        createdAt: new Date(2024, 0, 10 - i),
      }));
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValueOnce(manyCases);

      const result = await service.getForClient(testClientId, testFirmId);

      expect(result.recentCases.length).toBe(5);
    });

    it('should deduplicate contacts by email', async () => {
      const duplicateActors = [
        { name: 'Ion Popescu', email: 'ion@test.ro', phone: '123', role: 'Client' },
        {
          name: 'Ion P.',
          email: 'ion@test.ro',
          phone: '456',
          role: 'Other',
        }, // Same email
        { name: 'Maria Ionescu', email: 'maria@test.ro', phone: null, role: 'Other' },
      ];
      (mockPrisma.caseActor.findMany as jest.Mock).mockResolvedValueOnce(duplicateActors);

      const result = await service.getForClient(testClientId, testFirmId);

      expect(result.primaryContacts.length).toBe(2);
      expect(result.primaryContacts[0].name).toBe('Ion Popescu');
    });

    it('should limit primary contacts to 3', async () => {
      const manyActors = Array.from({ length: 6 }, (_, i) => ({
        name: `Contact ${i}`,
        email: `contact${i}@test.ro`,
        phone: null,
        role: 'Other',
      }));
      (mockPrisma.caseActor.findMany as jest.Mock).mockResolvedValueOnce(manyActors);

      const result = await service.getForClient(testClientId, testFirmId);

      expect(result.primaryContacts.length).toBe(3);
    });
  });

  describe('formatForPrompt', () => {
    it('should format context as Romanian text', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(null);
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValueOnce(mockClient);
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValueOnce(mockCases);
      (mockPrisma.caseActor.findMany as jest.Mock).mockResolvedValueOnce(mockActors);
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValueOnce({
        receivedDateTime: new Date('2024-12-20'),
      });
      (mockPrisma.email.count as jest.Mock).mockResolvedValueOnce(45);

      const result = await service.getForClient(testClientId, testFirmId);
      const formatted = service.formatForPrompt(result);

      // Check header
      expect(formatted).toContain('## Client: SC Exemplu SRL');

      // Check contact info
      expect(formatted).toContain('CUI: RO12345678');
      expect(formatted).toContain('Email: contact@exemplu.ro');

      // Check case stats
      expect(formatted).toContain('Dosare: 2 active, 1 închise');

      // Check portfolio section
      expect(formatted).toContain('### Portofoliu dosare');
      expect(formatted).toContain('Litigiu: 2');

      // Check recent cases
      expect(formatted).toContain('### Dosare recente');

      // Check contacts section
      expect(formatted).toContain('### Contacte principale');
      expect(formatted).toContain('Ion Popescu');

      // Check communication section
      expect(formatted).toContain('### Comunicare');
      expect(formatted).toContain('Total emailuri: 45');
    });

    it('should translate case status to Romanian', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(null);
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValueOnce(mockClient);
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'case-1',
          title: 'Active Case',
          status: 'Active',
          type: 'Litigiu',
          createdAt: new Date(),
        },
        {
          id: 'case-2',
          title: 'Closed Case',
          status: 'Closed',
          type: 'Litigiu',
          createdAt: new Date(),
        },
      ]);
      (mockPrisma.caseActor.findMany as jest.Mock).mockResolvedValueOnce([]);
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (mockPrisma.email.count as jest.Mock).mockResolvedValueOnce(0);

      const result = await service.getForClient(testClientId, testFirmId);
      const formatted = service.formatForPrompt(result);

      expect(formatted).toContain('(Activ)');
      expect(formatted).toContain('(Închis)');
    });

    it('should omit empty sections', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(null);
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockClient,
        contactInfo: {},
      });
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValueOnce([]);
      (mockPrisma.caseActor.findMany as jest.Mock).mockResolvedValueOnce([]);
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (mockPrisma.email.count as jest.Mock).mockResolvedValueOnce(0);

      const result = await service.getForClient(testClientId, testFirmId);
      const formatted = service.formatForPrompt(result);

      // Should not have these sections when empty
      expect(formatted).not.toContain('### Portofoliu dosare');
      expect(formatted).not.toContain('### Dosare recente');
      expect(formatted).not.toContain('### Contacte principale');
      expect(formatted).not.toContain('### Comunicare');
    });
  });

  describe('cache invalidation', () => {
    it('should delete cache key on invalidate', async () => {
      await service.invalidate(testClientId);

      expect(mockRedis.del).toHaveBeenCalledWith(`client-context:${testClientId}`);
    });

    it('should handle invalidation errors gracefully', async () => {
      (mockRedis.del as jest.Mock).mockRejectedValueOnce(new Error('Redis error'));

      // Should not throw
      await expect(service.invalidate(testClientId)).resolves.toBeUndefined();
    });
  });

  describe('getContextText', () => {
    it('should return cached text if available', async () => {
      const cachedEntry = {
        data: { name: 'Test' },
        contextText: '## Client: Test\nCached context',
        cachedAt: new Date().toISOString(),
      };
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedEntry));

      const result = await service.getContextText(testClientId, testFirmId);

      expect(result).toBe('## Client: Test\nCached context');
    });

    it('should generate text when cache miss', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValueOnce(mockClient);
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValueOnce([]);
      (mockPrisma.caseActor.findMany as jest.Mock).mockResolvedValueOnce([]);
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (mockPrisma.email.count as jest.Mock).mockResolvedValueOnce(0);

      const result = await service.getContextText(testClientId, testFirmId);

      expect(result).toContain('## Client: SC Exemplu SRL');
    });
  });
});
