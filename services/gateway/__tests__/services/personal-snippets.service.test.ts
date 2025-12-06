/**
 * Unit tests for Personal Snippets Service
 * Story 5.6: AI Learning and Personalization (Task 41)
 */

import { PersonalSnippetsService } from '../../src/services/personal-snippets.service';
import { prisma } from '@legal-platform/database';
import { SnippetCategory } from '@prisma/client';

// Mock Prisma
jest.mock('@legal-platform/database', () => ({
  prisma: {
    personalSnippet: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('PersonalSnippetsService', () => {
  let service: PersonalSnippetsService;
  const userId = 'user-123';
  const firmId = 'firm-456';

  const mockSnippet = {
    id: 'snip-1',
    firmId,
    userId,
    shortcut: 'greet',
    title: 'Formal Greeting',
    content: 'Stimate Domn/Stimată Doamnă,',
    category: SnippetCategory.Greeting,
    usageCount: 5,
    lastUsedAt: new Date(),
    isAutoDetected: false,
    sourceContext: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    service = new PersonalSnippetsService();
    jest.clearAllMocks();
  });

  describe('createSnippet', () => {
    it('should create a new snippet successfully', async () => {
      (mockPrisma.personalSnippet.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.personalSnippet.create as jest.Mock).mockResolvedValue(mockSnippet);

      const input = {
        shortcut: 'greet',
        title: 'Formal Greeting',
        content: 'Stimate Domn/Stimată Doamnă,',
        category: SnippetCategory.Greeting,
      };

      const result = await service.createSnippet(input, userId, firmId);

      expect(result.id).toBe('snip-1');
      expect(result.shortcut).toBe('greet');
      expect(mockPrisma.personalSnippet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firmId,
          userId,
          shortcut: 'greet',
          title: 'Formal Greeting',
          category: SnippetCategory.Greeting,
          isAutoDetected: false,
          usageCount: 0,
        }),
      });
    });

    it('should throw error for duplicate shortcut', async () => {
      (mockPrisma.personalSnippet.findUnique as jest.Mock).mockResolvedValue(mockSnippet);

      const input = {
        shortcut: 'greet',
        title: 'Another Greeting',
        content: 'Hello',
        category: SnippetCategory.Greeting,
      };

      await expect(service.createSnippet(input, userId, firmId)).rejects.toThrow(
        'Shortcut-ul "/greet" este deja folosit'
      );
    });

    it('should throw error for invalid shortcut format', async () => {
      const input = {
        shortcut: '123invalid',
        title: 'Test',
        content: 'Test content',
        category: SnippetCategory.Custom,
      };

      await expect(service.createSnippet(input, userId, firmId)).rejects.toThrow(
        'Shortcut-ul poate conține doar litere'
      );
    });

    it('should throw error for content exceeding max length', async () => {
      (mockPrisma.personalSnippet.findUnique as jest.Mock).mockResolvedValue(null);

      const input = {
        shortcut: 'longcontent',
        title: 'Test',
        content: 'x'.repeat(10001),
        category: SnippetCategory.Custom,
      };

      await expect(service.createSnippet(input, userId, firmId)).rejects.toThrow(
        'Conținutul snippet-ului nu poate depăși 10000 de caractere'
      );
    });

    it('should normalize shortcut to lowercase', async () => {
      (mockPrisma.personalSnippet.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.personalSnippet.create as jest.Mock).mockResolvedValue({
        ...mockSnippet,
        shortcut: 'myshortcut',
      });

      const input = {
        shortcut: 'MyShortcut',
        title: 'Test',
        content: 'Test content',
        category: SnippetCategory.Custom,
      };

      await service.createSnippet(input, userId, firmId);

      expect(mockPrisma.personalSnippet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shortcut: 'myshortcut',
        }),
      });
    });
  });

  describe('updateSnippet', () => {
    it('should update snippet successfully', async () => {
      (mockPrisma.personalSnippet.findFirst as jest.Mock).mockResolvedValue(mockSnippet);
      (mockPrisma.personalSnippet.update as jest.Mock).mockResolvedValue({
        ...mockSnippet,
        title: 'Updated Title',
      });

      const result = await service.updateSnippet('snip-1', { title: 'Updated Title' }, userId);

      expect(result.title).toBe('Updated Title');
      expect(mockPrisma.personalSnippet.update).toHaveBeenCalledWith({
        where: { id: 'snip-1' },
        data: { title: 'Updated Title' },
      });
    });

    it('should throw error when snippet not found', async () => {
      (mockPrisma.personalSnippet.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateSnippet('nonexistent', { title: 'New Title' }, userId)
      ).rejects.toThrow('Snippet-ul nu a fost găsit');
    });

    it('should check for duplicate when changing shortcut', async () => {
      (mockPrisma.personalSnippet.findFirst as jest.Mock).mockResolvedValue(mockSnippet);
      (mockPrisma.personalSnippet.findUnique as jest.Mock).mockResolvedValue({
        id: 'other-snip',
        shortcut: 'newshortcut',
      });

      await expect(
        service.updateSnippet('snip-1', { shortcut: 'newshortcut' }, userId)
      ).rejects.toThrow('Shortcut-ul "/newshortcut" este deja folosit');
    });
  });

  describe('deleteSnippet', () => {
    it('should delete snippet successfully', async () => {
      (mockPrisma.personalSnippet.findFirst as jest.Mock).mockResolvedValue(mockSnippet);
      (mockPrisma.personalSnippet.delete as jest.Mock).mockResolvedValue(mockSnippet);

      const result = await service.deleteSnippet('snip-1', userId);

      expect(result).toBe(true);
      expect(mockPrisma.personalSnippet.delete).toHaveBeenCalledWith({
        where: { id: 'snip-1' },
      });
    });

    it('should throw error when snippet not found', async () => {
      (mockPrisma.personalSnippet.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteSnippet('nonexistent', userId)).rejects.toThrow(
        'Snippet-ul nu a fost găsit'
      );
    });
  });

  describe('getUserSnippets', () => {
    it('should return all user snippets', async () => {
      (mockPrisma.personalSnippet.findMany as jest.Mock).mockResolvedValue([mockSnippet]);

      const result = await service.getUserSnippets(userId);

      expect(result).toHaveLength(1);
      expect(result[0].shortcut).toBe('greet');
      expect(mockPrisma.personalSnippet.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
      });
    });

    it('should filter by category when provided', async () => {
      (mockPrisma.personalSnippet.findMany as jest.Mock).mockResolvedValue([mockSnippet]);

      await service.getUserSnippets(userId, SnippetCategory.Greeting);

      expect(mockPrisma.personalSnippet.findMany).toHaveBeenCalledWith({
        where: { userId, category: SnippetCategory.Greeting },
        orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
      });
    });
  });

  describe('searchSnippets', () => {
    it('should search snippets by query', async () => {
      (mockPrisma.personalSnippet.findMany as jest.Mock).mockResolvedValue([mockSnippet]);

      const result = await service.searchSnippets(userId, { query: 'greet' });

      expect(result).toHaveLength(1);
      expect(mockPrisma.personalSnippet.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          OR: [
            { shortcut: { contains: 'greet', mode: 'insensitive' } },
            { title: { contains: 'greet', mode: 'insensitive' } },
            { content: { contains: 'greet', mode: 'insensitive' } },
          ],
        },
        orderBy: { usageCount: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should apply pagination', async () => {
      (mockPrisma.personalSnippet.findMany as jest.Mock).mockResolvedValue([]);

      await service.searchSnippets(userId, { limit: 10, offset: 20 });

      expect(mockPrisma.personalSnippet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });

  describe('expandShortcut', () => {
    it('should expand shortcut to full content', async () => {
      (mockPrisma.personalSnippet.findUnique as jest.Mock).mockResolvedValue(mockSnippet);

      const result = await service.expandShortcut('/greet', userId);

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Stimate Domn/Stimată Doamnă,');
    });

    it('should return null for unknown shortcut', async () => {
      (mockPrisma.personalSnippet.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.expandShortcut('/unknown', userId);

      expect(result).toBeNull();
    });

    it('should normalize shortcut without leading slash', async () => {
      (mockPrisma.personalSnippet.findUnique as jest.Mock).mockResolvedValue(mockSnippet);

      await service.expandShortcut('greet', userId);

      expect(mockPrisma.personalSnippet.findUnique).toHaveBeenCalledWith({
        where: {
          userId_shortcut: {
            userId,
            shortcut: 'greet',
          },
        },
      });
    });
  });

  describe('recordUsage', () => {
    it('should increment usage count', async () => {
      (mockPrisma.personalSnippet.findFirst as jest.Mock).mockResolvedValue(mockSnippet);
      (mockPrisma.personalSnippet.update as jest.Mock).mockResolvedValue({
        ...mockSnippet,
        usageCount: 6,
      });

      const result = await service.recordUsage('snip-1', userId);

      expect(result.usageCount).toBe(6);
      expect(mockPrisma.personalSnippet.update).toHaveBeenCalledWith({
        where: { id: 'snip-1' },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: expect.any(Date),
        },
      });
    });

    it('should throw error when snippet not found', async () => {
      (mockPrisma.personalSnippet.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.recordUsage('nonexistent', userId)).rejects.toThrow(
        'Snippet-ul nu a fost găsit'
      );
    });
  });

  describe('getMostUsedSnippets', () => {
    it('should return most used snippets', async () => {
      (mockPrisma.personalSnippet.findMany as jest.Mock).mockResolvedValue([mockSnippet]);

      const result = await service.getMostUsedSnippets(userId, 5);

      expect(result).toHaveLength(1);
      expect(mockPrisma.personalSnippet.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          usageCount: { gt: 0 },
        },
        orderBy: { usageCount: 'desc' },
        take: 5,
      });
    });
  });

  describe('getRecentlyUsedSnippets', () => {
    it('should return recently used snippets', async () => {
      (mockPrisma.personalSnippet.findMany as jest.Mock).mockResolvedValue([mockSnippet]);

      const result = await service.getRecentlyUsedSnippets(userId, 5);

      expect(result).toHaveLength(1);
      expect(mockPrisma.personalSnippet.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          lastUsedAt: { not: null },
        },
        orderBy: { lastUsedAt: 'desc' },
        take: 5,
      });
    });
  });

  describe('acceptSuggestion', () => {
    it('should create snippet from suggestion', async () => {
      (mockPrisma.personalSnippet.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.personalSnippet.create as jest.Mock).mockResolvedValue({
        ...mockSnippet,
        isAutoDetected: true,
      });

      const suggestion = {
        content: 'Suggested content',
        suggestedShortcut: 'suggest',
        suggestedTitle: 'Suggested Snippet',
        category: 'Custom' as const,
        confidence: 0.85,
        occurrenceCount: 3,
        sourceContext: { emailType: 'formal', detectedAt: new Date() },
      };

      const result = await service.acceptSuggestion(suggestion, userId, firmId);

      expect(result.isAutoDetected).toBe(true);
      expect(mockPrisma.personalSnippet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isAutoDetected: true,
        }),
      });
    });

    it('should allow customizing shortcut and title', async () => {
      (mockPrisma.personalSnippet.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.personalSnippet.create as jest.Mock).mockResolvedValue({
        ...mockSnippet,
        shortcut: 'customshortcut',
        title: 'Custom Title',
      });

      const suggestion = {
        content: 'Content',
        suggestedShortcut: 'original',
        suggestedTitle: 'Original',
        category: 'Custom' as const,
        confidence: 0.9,
        occurrenceCount: 2,
        sourceContext: { detectedAt: new Date() },
      };

      await service.acceptSuggestion(suggestion, userId, firmId, {
        shortcut: 'customshortcut',
        title: 'Custom Title',
      });

      expect(mockPrisma.personalSnippet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shortcut: 'customshortcut',
          title: 'Custom Title',
        }),
      });
    });
  });

  describe('getSnippetsByCategory', () => {
    it('should group snippets by category', async () => {
      const snippets = [
        { ...mockSnippet, category: SnippetCategory.Greeting },
        { ...mockSnippet, id: 'snip-2', category: SnippetCategory.Closing },
      ];
      (mockPrisma.personalSnippet.findMany as jest.Mock).mockResolvedValue(snippets);

      const result = await service.getSnippetsByCategory(userId);

      expect(result.Greeting).toHaveLength(1);
      expect(result.Closing).toHaveLength(1);
      expect(result.LegalPhrase).toHaveLength(0);
    });
  });

  describe('getAutoDetectedCount', () => {
    it('should count auto-detected snippets', async () => {
      (mockPrisma.personalSnippet.count as jest.Mock).mockResolvedValue(3);

      const result = await service.getAutoDetectedCount(userId);

      expect(result).toBe(3);
      expect(mockPrisma.personalSnippet.count).toHaveBeenCalledWith({
        where: {
          userId,
          isAutoDetected: true,
        },
      });
    });
  });
});
