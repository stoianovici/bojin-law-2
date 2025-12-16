/**
 * Personal Snippets Service
 * Story 5.6: AI Learning and Personalization (Task 10)
 *
 * Handles CRUD operations for personal snippets - frequently used phrases
 * that users can insert quickly using shortcuts.
 */

import { prisma } from '@legal-platform/database';
import { SnippetCategory } from '@prisma/client';
import type {
  PersonalSnippet,
  PersonalSnippetInput,
  SnippetSuggestion,
  SnippetSourceContext,
} from '@legal-platform/types';

// Input types
interface CreateSnippetInput {
  shortcut: string;
  title: string;
  content: string;
  category: SnippetCategory;
}

interface UpdateSnippetInput {
  shortcut?: string;
  title?: string;
  content?: string;
  category?: SnippetCategory;
}

interface SearchSnippetsInput {
  query?: string;
  category?: SnippetCategory;
  limit?: number;
  offset?: number;
}

export class PersonalSnippetsService {
  /**
   * Create a new personal snippet
   */
  async createSnippet(
    input: CreateSnippetInput,
    userId: string,
    firmId: string
  ): Promise<PersonalSnippet> {
    // Validate shortcut format
    if (!this.isValidShortcut(input.shortcut)) {
      throw new Error(
        'Shortcut-ul poate conține doar litere, cifre, liniuțe și underscore (max 50 caractere)'
      );
    }

    // Check for duplicate shortcut
    const existing = await prisma.personalSnippet.findUnique({
      where: {
        userId_shortcut: {
          userId,
          shortcut: input.shortcut.toLowerCase(),
        },
      },
    });

    if (existing) {
      throw new Error(`Shortcut-ul "/${input.shortcut}" este deja folosit`);
    }

    // Validate content length
    if (input.content.length > 10000) {
      throw new Error('Conținutul snippet-ului nu poate depăși 10000 de caractere');
    }

    const snippet = await prisma.personalSnippet.create({
      data: {
        firmId,
        userId,
        shortcut: input.shortcut.toLowerCase(),
        title: input.title,
        content: input.content,
        category: input.category,
        isAutoDetected: false,
        usageCount: 0,
      },
    });

    return this.mapToPersonalSnippet(snippet);
  }

  /**
   * Update an existing snippet
   */
  async updateSnippet(
    snippetId: string,
    input: UpdateSnippetInput,
    userId: string
  ): Promise<PersonalSnippet> {
    // Verify ownership
    const existing = await prisma.personalSnippet.findFirst({
      where: {
        id: snippetId,
        userId,
      },
    });

    if (!existing) {
      throw new Error('Snippet-ul nu a fost găsit');
    }

    // Validate shortcut if changing
    if (input.shortcut && input.shortcut !== existing.shortcut) {
      if (!this.isValidShortcut(input.shortcut)) {
        throw new Error('Shortcut-ul poate conține doar litere, cifre, liniuțe și underscore');
      }

      // Check for duplicate
      const duplicate = await prisma.personalSnippet.findUnique({
        where: {
          userId_shortcut: {
            userId,
            shortcut: input.shortcut.toLowerCase(),
          },
        },
      });

      if (duplicate && duplicate.id !== snippetId) {
        throw new Error(`Shortcut-ul "/${input.shortcut}" este deja folosit`);
      }
    }

    const updated = await prisma.personalSnippet.update({
      where: { id: snippetId },
      data: {
        ...(input.shortcut && { shortcut: input.shortcut.toLowerCase() }),
        ...(input.title && { title: input.title }),
        ...(input.content && { content: input.content }),
        ...(input.category && { category: input.category }),
      },
    });

    return this.mapToPersonalSnippet(updated);
  }

  /**
   * Delete a snippet
   */
  async deleteSnippet(snippetId: string, userId: string): Promise<boolean> {
    const snippet = await prisma.personalSnippet.findFirst({
      where: {
        id: snippetId,
        userId,
      },
    });

    if (!snippet) {
      throw new Error('Snippet-ul nu a fost găsit');
    }

    await prisma.personalSnippet.delete({
      where: { id: snippetId },
    });

    return true;
  }

  /**
   * Get a snippet by ID
   */
  async getSnippetById(snippetId: string, userId: string): Promise<PersonalSnippet | null> {
    const snippet = await prisma.personalSnippet.findFirst({
      where: {
        id: snippetId,
        userId,
      },
    });

    return snippet ? this.mapToPersonalSnippet(snippet) : null;
  }

  /**
   * Get all snippets for a user, optionally filtered by category
   */
  async getUserSnippets(userId: string, category?: SnippetCategory): Promise<PersonalSnippet[]> {
    const snippets = await prisma.personalSnippet.findMany({
      where: {
        userId,
        ...(category && { category }),
      },
      orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
    });

    return snippets.map(this.mapToPersonalSnippet);
  }

  /**
   * Search snippets by query (searches shortcut, title, content)
   */
  async searchSnippets(userId: string, input: SearchSnippetsInput): Promise<PersonalSnippet[]> {
    const { query, category, limit = 50, offset = 0 } = input;

    const snippets = await prisma.personalSnippet.findMany({
      where: {
        userId,
        ...(category && { category }),
        ...(query && {
          OR: [
            { shortcut: { contains: query, mode: 'insensitive' } },
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { usageCount: 'desc' },
      take: limit,
      skip: offset,
    });

    return snippets.map(this.mapToPersonalSnippet);
  }

  /**
   * Expand a shortcut to its full content
   */
  async expandShortcut(shortcut: string, userId: string): Promise<PersonalSnippet | null> {
    const normalizedShortcut = shortcut.toLowerCase().replace(/^\//, '');

    const snippet = await prisma.personalSnippet.findUnique({
      where: {
        userId_shortcut: {
          userId,
          shortcut: normalizedShortcut,
        },
      },
    });

    return snippet ? this.mapToPersonalSnippet(snippet) : null;
  }

  /**
   * Record usage of a snippet (called when snippet is inserted)
   */
  async recordUsage(snippetId: string, userId: string): Promise<PersonalSnippet> {
    const snippet = await prisma.personalSnippet.findFirst({
      where: {
        id: snippetId,
        userId,
      },
    });

    if (!snippet) {
      throw new Error('Snippet-ul nu a fost găsit');
    }

    const updated = await prisma.personalSnippet.update({
      where: { id: snippetId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return this.mapToPersonalSnippet(updated);
  }

  /**
   * Get most used snippets
   */
  async getMostUsedSnippets(userId: string, limit: number = 5): Promise<PersonalSnippet[]> {
    const snippets = await prisma.personalSnippet.findMany({
      where: {
        userId,
        usageCount: { gt: 0 },
      },
      orderBy: { usageCount: 'desc' },
      take: limit,
    });

    return snippets.map(this.mapToPersonalSnippet);
  }

  /**
   * Get recently used snippets
   */
  async getRecentlyUsedSnippets(userId: string, limit: number = 5): Promise<PersonalSnippet[]> {
    const snippets = await prisma.personalSnippet.findMany({
      where: {
        userId,
        lastUsedAt: { not: null },
      },
      orderBy: { lastUsedAt: 'desc' },
      take: limit,
    });

    return snippets.map(this.mapToPersonalSnippet);
  }

  /**
   * Create snippet from AI suggestion
   */
  async acceptSuggestion(
    suggestion: SnippetSuggestion,
    userId: string,
    firmId: string,
    customizations?: { shortcut?: string; title?: string }
  ): Promise<PersonalSnippet> {
    const shortcut = customizations?.shortcut || suggestion.suggestedShortcut;
    const title = customizations?.title || suggestion.suggestedTitle;

    // Validate shortcut
    if (!this.isValidShortcut(shortcut)) {
      throw new Error('Shortcut-ul poate conține doar litere, cifre, liniuțe și underscore');
    }

    // Check for duplicate
    const existing = await prisma.personalSnippet.findUnique({
      where: {
        userId_shortcut: {
          userId,
          shortcut: shortcut.toLowerCase(),
        },
      },
    });

    if (existing) {
      throw new Error(`Shortcut-ul "/${shortcut}" este deja folosit`);
    }

    const snippet = await prisma.personalSnippet.create({
      data: {
        firmId,
        userId,
        shortcut: shortcut.toLowerCase(),
        title,
        content: suggestion.content,
        category: suggestion.category as SnippetCategory,
        isAutoDetected: true,
        sourceContext: suggestion.sourceContext as object,
        usageCount: 0,
      },
    });

    return this.mapToPersonalSnippet(snippet);
  }

  /**
   * Get auto-detected snippets count
   */
  async getAutoDetectedCount(userId: string): Promise<number> {
    return prisma.personalSnippet.count({
      where: {
        userId,
        isAutoDetected: true,
      },
    });
  }

  /**
   * Get snippets by category with counts
   */
  async getSnippetsByCategory(userId: string): Promise<Record<SnippetCategory, PersonalSnippet[]>> {
    const snippets = await prisma.personalSnippet.findMany({
      where: { userId },
      orderBy: { usageCount: 'desc' },
    });

    const result: Record<SnippetCategory, PersonalSnippet[]> = {
      Greeting: [],
      Closing: [],
      LegalPhrase: [],
      ClientResponse: [],
      InternalNote: [],
      Custom: [],
    };

    for (const snippet of snippets) {
      result[snippet.category].push(this.mapToPersonalSnippet(snippet));
    }

    return result;
  }

  /**
   * Validate shortcut format
   */
  private isValidShortcut(shortcut: string): boolean {
    // Allow alphanumeric, hyphens, underscores
    // Max 50 chars, must start with letter
    const pattern = /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/;
    return pattern.test(shortcut);
  }

  /**
   * Map Prisma model to domain type
   */
  private mapToPersonalSnippet(snippet: {
    id: string;
    firmId: string;
    userId: string;
    shortcut: string;
    title: string;
    content: string;
    category: SnippetCategory;
    usageCount: number;
    lastUsedAt: Date | null;
    isAutoDetected: boolean;
    sourceContext: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): PersonalSnippet {
    return {
      id: snippet.id,
      firmId: snippet.firmId,
      userId: snippet.userId,
      shortcut: snippet.shortcut,
      title: snippet.title,
      content: snippet.content,
      category: snippet.category as PersonalSnippet['category'],
      usageCount: snippet.usageCount,
      lastUsedAt: snippet.lastUsedAt,
      isAutoDetected: snippet.isAutoDetected,
      sourceContext: snippet.sourceContext as SnippetSourceContext | null,
      createdAt: snippet.createdAt,
      updatedAt: snippet.updatedAt,
    };
  }
}

// Export singleton instance
export const personalSnippetsService = new PersonalSnippetsService();
