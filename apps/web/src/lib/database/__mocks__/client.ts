/**
 * Manual mock for database client
 * Used in Jest tests to avoid real database connections
 */

import { jest } from '@jest/globals';

export const query = jest.fn();
export const getPool = jest.fn();
export const getClient = jest.fn();
export const closePool = jest.fn();
