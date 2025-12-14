// @ts-nocheck
/**
 * Task Collaboration DataLoaders
 * Story 4.6 QA Fix: PERF-001
 *
 * Batches lookups to prevent N+1 query problem in field resolvers.
 * Used by task-collaboration.resolvers.ts for user, task, and document relations.
 */

import { prisma } from '@legal-platform/database';

// ============================================================================
// User DataLoader (extends existing pattern for task collaboration context)
// ============================================================================

interface UserBasicInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export class TaskCollaborationUserLoader {
  private batch: Map<
    string,
    { resolve: (user: UserBasicInfo | null) => void; reject: (err: Error) => void }[]
  > = new Map();
  private scheduled = false;

  async load(id: string): Promise<UserBasicInfo | null> {
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

  async loadMany(ids: string[]): Promise<(UserBasicInfo | null)[]> {
    return Promise.all(ids.map((id) => this.load(id)));
  }

  private async executeBatch(): Promise<void> {
    const currentBatch = this.batch;
    this.batch = new Map();
    this.scheduled = false;

    const ids = Array.from(currentBatch.keys());
    if (ids.length === 0) return;

    try {
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      });

      const userMap = new Map<string, UserBasicInfo>();
      for (const user of users) {
        userMap.set(user.id, user);
      }

      for (const [id, callbacks] of currentBatch) {
        const user = userMap.get(id) || null;
        for (const { resolve } of callbacks) {
          resolve(user);
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
// Task DataLoader
// ============================================================================

interface TaskBasicInfo {
  id: string;
  title: string;
  caseId: string;
  type: string;
  status: string;
  assignedTo: string;
}

export class TaskDataLoader {
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
          caseId: true,
          type: true,
          status: true,
          assignedTo: true,
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
// Document DataLoader
// ============================================================================

interface DocumentBasicInfo {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
}

export class DocumentDataLoader {
  private batch: Map<
    string,
    { resolve: (doc: DocumentBasicInfo | null) => void; reject: (err: Error) => void }[]
  > = new Map();
  private scheduled = false;

  async load(id: string): Promise<DocumentBasicInfo | null> {
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
      const documents = await prisma.document.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          storagePath: true,
        },
      });

      const docMap = new Map<string, DocumentBasicInfo>();
      for (const doc of documents) {
        docMap.set(doc.id, doc);
      }

      for (const [id, callbacks] of currentBatch) {
        const doc = docMap.get(id) || null;
        for (const { resolve } of callbacks) {
          resolve(doc);
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
// Case DataLoader
// ============================================================================

interface CaseBasicInfo {
  id: string;
  title: string;
  caseNumber: string;
  status: string;
}

export class CaseDataLoader {
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
// DataLoader Context Interface
// ============================================================================

export interface TaskCollaborationLoaders {
  userLoader: TaskCollaborationUserLoader;
  taskLoader: TaskDataLoader;
  documentLoader: DocumentDataLoader;
  caseLoader: CaseDataLoader;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create all DataLoaders for a single request
 * Should be created per-request to avoid cross-request caching issues
 */
export function createTaskCollaborationLoaders(): TaskCollaborationLoaders {
  return {
    userLoader: new TaskCollaborationUserLoader(),
    taskLoader: new TaskDataLoader(),
    documentLoader: new DocumentDataLoader(),
    caseLoader: new CaseDataLoader(),
  };
}

// Request-scoped loaders (for simple use within a single GraphQL request)
let requestLoaders: TaskCollaborationLoaders | null = null;

/**
 * Get the current request's loaders
 * Creates new ones if none exist
 */
export function getTaskCollaborationLoaders(): TaskCollaborationLoaders {
  if (!requestLoaders) {
    requestLoaders = createTaskCollaborationLoaders();
  }
  return requestLoaders;
}

/**
 * Reset the request loaders (call at end of each request)
 */
export function resetTaskCollaborationLoaders(): void {
  requestLoaders = null;
}
