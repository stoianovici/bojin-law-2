/**
 * Communication Template Service Unit Tests
 * Story 5.5: Multi-Channel Communication Hub - Task 37 (AC: 2)
 *
 * Tests for template CRUD and rendering operations
 */

import { CommunicationTemplateService } from './communication-template.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    communicationTemplate: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  },
  CommunicationChannel: {
    Email: 'Email',
    InternalNote: 'InternalNote',
  },
  TemplateCategory: {
    ClientUpdate: 'ClientUpdate',
    CourtFiling: 'CourtFiling',
    General: 'General',
  },
}));

// Mock template parser
jest.mock('../utils/template-parser', () => ({
  templateParser: {
    extractVariables: jest.fn(),
    replaceVariables: jest.fn(),
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');
const { templateParser } = jest.requireMock('../utils/template-parser');

describe('CommunicationTemplateService', () => {
  let service: CommunicationTemplateService;

  const mockFirmId = 'firm-123';
  const mockUserId = 'user-789';

  const mockUserContext = {
    userId: mockUserId,
    firmId: mockFirmId,
  };

  const mockTemplate = {
    id: 'template-1',
    firmId: mockFirmId,
    name: 'Case Update Template',
    description: 'Template for client case updates',
    category: 'ClientUpdate',
    channelType: 'Email',
    subject: 'Update on Case {{caseNumber}}',
    body: 'Dear {{clientName}}, Your case {{caseNumber}} has been updated.',
    htmlBody: null,
    variables: [
      { name: 'clientName', description: 'Client name', required: true },
      { name: 'caseNumber', description: 'Case number', required: true },
    ],
    isActive: true,
    isGlobal: false,
    createdBy: mockUserId,
    usageCount: 5,
    lastUsedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    templateParser.extractVariables.mockReturnValue(['clientName', 'caseNumber']);
    templateParser.replaceVariables.mockImplementation(
      (template: string, values: Record<string, string>) => {
        let result = template;
        for (const [key, value] of Object.entries(values)) {
          result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
        return result;
      }
    );
    service = new CommunicationTemplateService();
  });

  // ============================================================================
  // createTemplate Tests
  // ============================================================================

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      prisma.communicationTemplate.create.mockResolvedValue(mockTemplate);

      const result = await service.createTemplate(
        {
          name: 'Case Update Template',
          description: 'Template for client case updates',
          category: 'ClientUpdate' as any,
          channelType: 'Email' as any,
          subject: 'Update on Case {{caseNumber}}',
          body: 'Dear {{clientName}}, Your case {{caseNumber}} has been updated.',
          variables: [
            { name: 'clientName', description: 'Client name', required: true },
            { name: 'caseNumber', description: 'Case number', required: true },
          ],
          isGlobal: false,
        },
        mockUserContext
      );

      expect(result.id).toBe('template-1');
      expect(result.name).toBe('Case Update Template');
      expect(prisma.communicationTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firmId: mockFirmId,
            createdBy: mockUserId,
            isActive: true,
            usageCount: 0,
          }),
        })
      );
    });

    it('should set isActive to true by default', async () => {
      prisma.communicationTemplate.create.mockResolvedValue(mockTemplate);

      await service.createTemplate(
        {
          name: 'Test',
          category: 'General' as any,
          channelType: 'Email' as any,
          body: 'Test body',
          variables: [],
          isGlobal: false,
        },
        mockUserContext
      );

      const createCall = prisma.communicationTemplate.create.mock.calls[0][0];
      expect(createCall.data.isActive).toBe(true);
    });
  });

  // ============================================================================
  // updateTemplate Tests
  // ============================================================================

  describe('updateTemplate', () => {
    it('should update an existing template', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue(mockTemplate);
      prisma.communicationTemplate.update.mockResolvedValue({
        ...mockTemplate,
        name: 'Updated Template Name',
      });

      const result = await service.updateTemplate(
        'template-1',
        { name: 'Updated Template Name' },
        mockUserContext
      );

      expect(result.name).toBe('Updated Template Name');
      expect(prisma.communicationTemplate.update).toHaveBeenCalled();
    });

    it('should throw error when template not found', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTemplate('nonexistent', { name: 'Updated' }, mockUserContext)
      ).rejects.toThrow('Template not found');
    });

    it('should throw error when non-creator tries to update non-global template', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue({
        ...mockTemplate,
        createdBy: 'other-user',
        isGlobal: false,
      });

      await expect(
        service.updateTemplate('template-1', { name: 'Updated' }, mockUserContext)
      ).rejects.toThrow('Only the creator can update this template');
    });

    it('should allow updating global templates', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue({
        ...mockTemplate,
        createdBy: 'other-user',
        isGlobal: true,
      });
      prisma.communicationTemplate.update.mockResolvedValue({
        ...mockTemplate,
        name: 'Updated Global',
      });

      const result = await service.updateTemplate(
        'template-1',
        { name: 'Updated Global' },
        mockUserContext
      );

      expect(result.name).toBe('Updated Global');
    });
  });

  // ============================================================================
  // deleteTemplate Tests
  // ============================================================================

  describe('deleteTemplate', () => {
    it('should soft delete a template by setting isActive to false', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue(mockTemplate);
      prisma.communicationTemplate.update.mockResolvedValue({
        ...mockTemplate,
        isActive: false,
      });

      const result = await service.deleteTemplate('template-1', mockUserContext);

      expect(result).toBe(true);
      expect(prisma.communicationTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: { isActive: false },
      });
    });

    it('should throw error when template not found', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue(null);

      await expect(service.deleteTemplate('nonexistent', mockUserContext)).rejects.toThrow(
        'Template not found'
      );
    });
  });

  // ============================================================================
  // getTemplate Tests
  // ============================================================================

  describe('getTemplate', () => {
    it('should return template by ID', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue(mockTemplate);

      const result = await service.getTemplate('template-1', mockUserContext);

      expect(result).toBeDefined();
      expect(result?.id).toBe('template-1');
    });

    it('should return null when template not found', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue(null);

      const result = await service.getTemplate('nonexistent', mockUserContext);

      expect(result).toBeNull();
    });

    it('should query by firm ID or global templates', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue(mockTemplate);

      await service.getTemplate('template-1', mockUserContext);

      const findFirstCall = prisma.communicationTemplate.findFirst.mock.calls[0][0];
      expect(findFirstCall.where.OR).toEqual([{ firmId: mockFirmId }, { isGlobal: true }]);
    });
  });

  // ============================================================================
  // listTemplates Tests
  // ============================================================================

  describe('listTemplates', () => {
    it('should return list of templates', async () => {
      prisma.communicationTemplate.findMany.mockResolvedValue([mockTemplate]);
      prisma.communicationTemplate.count.mockResolvedValue(1);

      const result = await service.listTemplates({}, mockUserContext);

      expect(result.templates).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by category', async () => {
      prisma.communicationTemplate.findMany.mockResolvedValue([]);
      prisma.communicationTemplate.count.mockResolvedValue(0);

      await service.listTemplates({ category: 'ClientUpdate' as any }, mockUserContext);

      const findManyCall = prisma.communicationTemplate.findMany.mock.calls[0][0];
      expect(findManyCall.where.category).toBe('ClientUpdate');
    });

    it('should filter by channel type', async () => {
      prisma.communicationTemplate.findMany.mockResolvedValue([]);
      prisma.communicationTemplate.count.mockResolvedValue(0);

      await service.listTemplates({ channelType: 'Email' as any }, mockUserContext);

      const findManyCall = prisma.communicationTemplate.findMany.mock.calls[0][0];
      expect(findManyCall.where.channelType).toBe('Email');
    });

    it('should filter by search term', async () => {
      prisma.communicationTemplate.findMany.mockResolvedValue([]);
      prisma.communicationTemplate.count.mockResolvedValue(0);

      await service.listTemplates({ searchTerm: 'update' }, mockUserContext);

      const findManyCall = prisma.communicationTemplate.findMany.mock.calls[0][0];
      expect(findManyCall.where.AND).toBeDefined();
    });

    it('should support pagination', async () => {
      prisma.communicationTemplate.findMany.mockResolvedValue([]);
      prisma.communicationTemplate.count.mockResolvedValue(100);

      await service.listTemplates({}, mockUserContext, { limit: 10, offset: 20 });

      const findManyCall = prisma.communicationTemplate.findMany.mock.calls[0][0];
      expect(findManyCall.take).toBe(10);
      expect(findManyCall.skip).toBe(20);
    });
  });

  // ============================================================================
  // renderTemplate Tests
  // ============================================================================

  describe('renderTemplate', () => {
    it('should render template with provided variables', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue(mockTemplate);

      const result = await service.renderTemplate(
        'template-1',
        { clientName: 'John Doe', caseNumber: 'CASE-001' },
        mockUserContext
      );

      expect(result.body).toContain('John Doe');
      expect(result.body).toContain('CASE-001');
    });

    it('should throw error when template not found', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.renderTemplate('nonexistent', { clientName: 'John' }, mockUserContext)
      ).rejects.toThrow('Template not found');
    });

    it('should throw error when required variables are missing', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue(mockTemplate);

      await expect(
        service.renderTemplate(
          'template-1',
          { clientName: 'John' }, // Missing caseNumber
          mockUserContext
        )
      ).rejects.toThrow('Missing required variables: caseNumber');
    });

    it('should use default values for optional variables', async () => {
      const templateWithDefault = {
        ...mockTemplate,
        variables: [
          { name: 'clientName', description: 'Name', required: true },
          { name: 'greeting', description: 'Greeting', required: false, defaultValue: 'Hello' },
        ],
      };
      prisma.communicationTemplate.findFirst.mockResolvedValue(templateWithDefault);

      const result = await service.renderTemplate(
        'template-1',
        { clientName: 'John' },
        mockUserContext
      );

      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // incrementUsageCount Tests
  // ============================================================================

  describe('incrementUsageCount', () => {
    it('should increment usage count', async () => {
      prisma.communicationTemplate.update.mockResolvedValue({
        ...mockTemplate,
        usageCount: 6,
      });

      await service.incrementUsageCount('template-1');

      expect(prisma.communicationTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: expect.any(Date),
        },
      });
    });
  });

  // ============================================================================
  // getPopularTemplates Tests
  // ============================================================================

  describe('getPopularTemplates', () => {
    it('should return templates sorted by usage count', async () => {
      prisma.communicationTemplate.findMany.mockResolvedValue([
        { ...mockTemplate, usageCount: 100 },
        { ...mockTemplate, id: 'template-2', usageCount: 50 },
      ]);

      const result = await service.getPopularTemplates('Email' as any, mockUserContext, 5);

      expect(result).toHaveLength(2);
      const findManyCall = prisma.communicationTemplate.findMany.mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ usageCount: 'desc' });
      expect(findManyCall.take).toBe(5);
    });

    it('should filter by channel type and active status', async () => {
      prisma.communicationTemplate.findMany.mockResolvedValue([]);

      await service.getPopularTemplates('Email' as any, mockUserContext);

      const findManyCall = prisma.communicationTemplate.findMany.mock.calls[0][0];
      expect(findManyCall.where.channelType).toBe('Email');
      expect(findManyCall.where.isActive).toBe(true);
    });
  });

  // ============================================================================
  // duplicateTemplate Tests
  // ============================================================================

  describe('duplicateTemplate', () => {
    it('should create a copy of an existing template', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue(mockTemplate);
      prisma.communicationTemplate.create.mockResolvedValue({
        ...mockTemplate,
        id: 'template-copy',
        name: 'Copy of Template',
        isGlobal: false,
      });

      const result = await service.duplicateTemplate(
        'template-1',
        'Copy of Template',
        mockUserContext
      );

      expect(result.name).toBe('Copy of Template');
      expect(result.isGlobal).toBe(false);
    });

    it('should throw error when original template not found', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.duplicateTemplate('nonexistent', 'Copy', mockUserContext)
      ).rejects.toThrow('Template not found');
    });

    it('should always create duplicate as non-global', async () => {
      prisma.communicationTemplate.findFirst.mockResolvedValue({
        ...mockTemplate,
        isGlobal: true,
      });
      prisma.communicationTemplate.create.mockResolvedValue({
        ...mockTemplate,
        isGlobal: false,
      });

      await service.duplicateTemplate('template-1', 'Copy', mockUserContext);

      const createCall = prisma.communicationTemplate.create.mock.calls[0][0];
      expect(createCall.data.isGlobal).toBe(false);
    });
  });
});
