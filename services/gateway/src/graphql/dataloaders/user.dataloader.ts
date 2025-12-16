// @ts-nocheck
/**
 * User DataLoader
 * Story 4.5 QA Fix: PERF-001
 *
 * Batches user lookups to prevent N+1 query problem in field resolvers.
 * Collects all user IDs requested in a single tick and makes one batch query.
 */

import { prisma } from '@legal-platform/database';

interface UserBasicInfo {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

/**
 * Simple DataLoader implementation for batching user lookups
 * Collects IDs within a tick and resolves them all at once
 */
export class UserDataLoader {
  private batch: Map<
    string,
    { resolve: (user: UserBasicInfo | null) => void; reject: (err: Error) => void }[]
  > = new Map();
  private scheduled = false;

  /**
   * Load a single user by ID (batched)
   */
  async load(id: string): Promise<UserBasicInfo | null> {
    return new Promise((resolve, reject) => {
      const callbacks = this.batch.get(id) || [];
      callbacks.push({ resolve, reject });
      this.batch.set(id, callbacks);

      if (!this.scheduled) {
        this.scheduled = true;
        // Use setImmediate to batch all requests in the current tick
        setImmediate(() => this.executeBatch());
      }
    });
  }

  /**
   * Execute the batched query
   */
  private async executeBatch(): Promise<void> {
    const currentBatch = this.batch;
    this.batch = new Map();
    this.scheduled = false;

    const ids = Array.from(currentBatch.keys());

    if (ids.length === 0) return;

    try {
      // Single query for all users
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      // Map users by ID for quick lookup
      const userMap = new Map<string, UserBasicInfo>();
      for (const user of users) {
        userMap.set(user.id, user);
      }

      // Resolve all callbacks
      for (const [id, callbacks] of currentBatch) {
        const user = userMap.get(id) || null;
        for (const { resolve } of callbacks) {
          resolve(user);
        }
      }
    } catch (error) {
      // Reject all callbacks on error
      for (const [, callbacks] of currentBatch) {
        for (const { reject } of callbacks) {
          reject(error as Error);
        }
      }
    }
  }

  /**
   * Clear the loader cache (for testing)
   */
  clear(): void {
    this.batch.clear();
    this.scheduled = false;
  }
}

// Create a new loader per request to avoid cross-request caching issues
export function createUserDataLoader(): UserDataLoader {
  return new UserDataLoader();
}

// Singleton for simple use cases (e.g., within a single GraphQL request)
let requestLoader: UserDataLoader | null = null;

/**
 * Get the current request's user loader
 * Creates a new one if none exists
 */
export function getUserDataLoader(): UserDataLoader {
  if (!requestLoader) {
    requestLoader = new UserDataLoader();
  }
  return requestLoader;
}

/**
 * Reset the request loader (call at end of each request)
 */
export function resetUserDataLoader(): void {
  requestLoader = null;
}
