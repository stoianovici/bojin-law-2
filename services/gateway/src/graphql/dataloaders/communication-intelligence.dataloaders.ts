/**
 * Communication Intelligence DataLoaders
 * Story 5.2: Communication Intelligence Engine
 *
 * Batches lookups to prevent N+1 query problem in field resolvers.
 * Used by communication-intelligence.resolvers.ts for email, case, and task relations.
 */

import { prisma } from '@legal-platform/database';

// ============================================================================
// Email DataLoader
// ============================================================================

interface EmailBasicInfo {
  id: string;
  subject: string;
  from: unknown; // JSON field { name?: string, address: string }
  toRecipients: unknown; // JSON array of { name?, address }
  receivedDateTime: Date;
  caseId: string | null;
}

export class EmailDataLoader {
  private batch: Map<
    string,
    { resolve: (email: EmailBasicInfo | null) => void; reject: (err: Error) => void }[]
  > = new Map();
  private scheduled = false;

  async load(id: string): Promise<EmailBasicInfo | null> {
    return new Promise((resolve, reject) => {
      const callbacks = this.batch.get(id) || [];
      callbacks.push({ resolve, reject });
      this.batch.set(id, callbacks);

      if (!this.scheduled) {
        this.scheduled = true;
        setImmediate(() => this.executeBatch());
      }
    });
  }

  async loadMany(ids: string[]): Promise<(EmailBasicInfo | null)[]> {
    return Promise.all(ids.map((id) => this.load(id)));
  }

  private async executeBatch(): Promise<void> {
    const currentBatch = this.batch;
    this.batch = new Map();
    this.scheduled = false;

    const ids = Array.from(currentBatch.keys());
    if (ids.length === 0) return;

    try {
      const emails = await prisma.email.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          subject: true,
          from: true,
          toRecipients: true,
          receivedDateTime: true,
          caseId: true,
        },
      });

      const emailMap = new Map<string, EmailBasicInfo>();
      for (const email of emails) {
        emailMap.set(email.id, email);
      }

      for (const [id, callbacks] of currentBatch) {
        const email = emailMap.get(id) || null;
        for (const { resolve } of callbacks) {
          resolve(email);
        }
      }
    } catch (error) {
      for (const [, callbacks] of currentBatch) {
        for (const { reject } of callbacks) {
          reject(error as Error);
        }
      }
    }
  }

  clear(): void {
    this.batch.clear();
    this.scheduled = false;
  }
}

// ============================================================================
// Case DataLoader (for communication intelligence context)
// ============================================================================

interface CaseBasicInfo {
  id: string;
  title: string;
  caseNumber: string;
  status: string;
}

export class CommunicationIntelligenceCaseLoader {
  private batch: Map<
    string,
    { resolve: (caseInfo: CaseBasicInfo | null) => void; reject: (err: Error) => void }[]
  > = new Map();
  private scheduled = false;

  async load(id: string): Promise<CaseBasicInfo | null> {
    return new Promise((resolve, reject) => {
      const callbacks = this.batch.get(id) || [];
      callbacks.push({ resolve, reject });
      this.batch.set(id, callbacks);

      if (!this.scheduled) {
        this.scheduled = true;
        setImmediate(() => this.executeBatch());
      }
    });
  }

  async loadMany(ids: string[]): Promise<(CaseBasicInfo | null)[]> {
    return Promise.all(ids.map((id) => this.load(id)));
  }

  private async executeBatch(): Promise<void> {
    const currentBatch = this.batch;
    this.batch = new Map();
    this.scheduled = false;

    const ids = Array.from(currentBatch.keys());
    if (ids.length === 0) return;

    try {
      const cases = await prisma.case.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          title: true,
          caseNumber: true,
          status: true,
        },
      });

      const caseMap = new Map<string, CaseBasicInfo>();
      for (const c of cases) {
        caseMap.set(c.id, c);
      }

      for (const [id, callbacks] of currentBatch) {
        const c = caseMap.get(id) || null;
        for (const { resolve } of callbacks) {
          resolve(c);
        }
      }
    } catch (error) {
      for (const [, callbacks] of currentBatch) {
        for (const { reject } of callbacks) {
          reject(error as Error);
        }
      }
    }
  }

  clear(): void {
    this.batch.clear();
    this.scheduled = false;
  }
}

// ============================================================================
// Task DataLoader (for converted task lookups)
// ============================================================================

interface TaskBasicInfo {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
}

export class ConvertedTaskLoader {
  private batch: Map<
    string,
    { resolve: (task: TaskBasicInfo | null) => void; reject: (err: Error) => void }[]
  > = new Map();
  private scheduled = false;

  async load(id: string): Promise<TaskBasicInfo | null> {
    return new Promise((resolve, reject) => {
      const callbacks = this.batch.get(id) || [];
      callbacks.push({ resolve, reject });
      this.batch.set(id, callbacks);

      if (!this.scheduled) {
        this.scheduled = true;
        setImmediate(() => this.executeBatch());
      }
    });
  }

  private async executeBatch(): Promise<void> {
    const currentBatch = this.batch;
    this.batch = new Map();
    this.scheduled = false;

    const ids = Array.from(currentBatch.keys());
    if (ids.length === 0) return;

    try {
      const tasks = await prisma.task.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
        },
      });

      const taskMap = new Map<string, TaskBasicInfo>();
      for (const task of tasks) {
        taskMap.set(task.id, task);
      }

      for (const [id, callbacks] of currentBatch) {
        const task = taskMap.get(id) || null;
        for (const { resolve } of callbacks) {
          resolve(task);
        }
      }
    } catch (error) {
      for (const [, callbacks] of currentBatch) {
        for (const { reject } of callbacks) {
          reject(error as Error);
        }
      }
    }
  }

  clear(): void {
    this.batch.clear();
    this.scheduled = false;
  }
}

// ============================================================================
// DataLoader Context Interface
// ============================================================================

export interface CommunicationIntelligenceLoaders {
  emailLoader: EmailDataLoader;
  caseLoader: CommunicationIntelligenceCaseLoader;
  taskLoader: ConvertedTaskLoader;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create all DataLoaders for a single request
 * Should be created per-request to avoid cross-request caching issues
 */
export function createCommunicationIntelligenceLoaders(): CommunicationIntelligenceLoaders {
  return {
    emailLoader: new EmailDataLoader(),
    caseLoader: new CommunicationIntelligenceCaseLoader(),
    taskLoader: new ConvertedTaskLoader(),
  };
}

// Request-scoped loaders (for simple use within a single GraphQL request)
let requestLoaders: CommunicationIntelligenceLoaders | null = null;

/**
 * Get the current request's loaders
 * Creates new ones if none exist
 */
export function getCommunicationIntelligenceLoaders(): CommunicationIntelligenceLoaders {
  if (!requestLoaders) {
    requestLoaders = createCommunicationIntelligenceLoaders();
  }
  return requestLoaders;
}

/**
 * Reset the request loaders (call at end of each request)
 */
export function resetCommunicationIntelligenceLoaders(): void {
  requestLoaders = null;
}
