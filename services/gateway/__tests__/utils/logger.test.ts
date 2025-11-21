/**
 * Unit Tests for Logger Utility
 * Story 2.5: Microsoft Graph API Integration Foundation
 *
 * Tests simple logger utility for structured logging
 */

import logger from '../../src/utils/logger';

describe('Logger Utility', () => {
  // Store original console methods
  const originalConsoleDebug = console.debug;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  // Mock console methods
  let consoleDebugSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Create spies for console methods
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    // Restore console methods
    jest.restoreAllMocks();
  });

  afterAll(() => {
    // Ensure console is fully restored
    console.debug = originalConsoleDebug;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  describe('debug', () => {
    it('should log debug messages with timestamp and level', () => {
      const message = 'Debug message';
      const metadata = { userId: '123', action: 'test' };

      logger.debug(message, metadata);

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleDebugSpy.mock.calls[0];
      expect(callArgs[0]).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] DEBUG: Debug message/
      );
      expect(callArgs[1]).toEqual(metadata);
    });

    it('should log debug messages without metadata', () => {
      const message = 'Debug message without metadata';

      logger.debug(message);

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleDebugSpy.mock.calls[0];
      expect(callArgs[0]).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] DEBUG: Debug message without metadata/
      );
      expect(callArgs[1]).toBe('');
    });
  });

  describe('info', () => {
    it('should log info messages with timestamp and level', () => {
      const message = 'Info message';
      const metadata = { requestId: 'abc-123', endpoint: '/api/test' };

      logger.info(message, metadata);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleLogSpy.mock.calls[0];
      expect(callArgs[0]).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Info message/
      );
      expect(callArgs[1]).toEqual(metadata);
    });

    it('should log info messages without metadata', () => {
      const message = 'Info message without metadata';

      logger.info(message);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleLogSpy.mock.calls[0];
      expect(callArgs[0]).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Info message without metadata/
      );
      expect(callArgs[1]).toBe('');
    });
  });

  describe('warn', () => {
    it('should log warning messages with timestamp and level', () => {
      const message = 'Warning message';
      const metadata = { threshold: 90, current: 95 };

      logger.warn(message, metadata);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleWarnSpy.mock.calls[0];
      expect(callArgs[0]).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] WARN: Warning message/
      );
      expect(callArgs[1]).toEqual(metadata);
    });

    it('should log warning messages without metadata', () => {
      const message = 'Warning message without metadata';

      logger.warn(message);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleWarnSpy.mock.calls[0];
      expect(callArgs[0]).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] WARN: Warning message without metadata/
      );
      expect(callArgs[1]).toBe('');
    });
  });

  describe('error', () => {
    it('should log error messages with timestamp and level', () => {
      const message = 'Error message';
      const metadata = { error: 'Database connection failed', code: 'ECONNREFUSED' };

      logger.error(message, metadata);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleErrorSpy.mock.calls[0];
      expect(callArgs[0]).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: Error message/
      );
      expect(callArgs[1]).toEqual(metadata);
    });

    it('should log error messages without metadata', () => {
      const message = 'Error message without metadata';

      logger.error(message);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleErrorSpy.mock.calls[0];
      expect(callArgs[0]).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: Error message without metadata/
      );
      expect(callArgs[1]).toBe('');
    });
  });

  describe('timestamp format', () => {
    it('should include ISO 8601 timestamp in all log messages', () => {
      logger.debug('test');
      logger.info('test');
      logger.warn('test');
      logger.error('test');

      const debugCall = consoleDebugSpy.mock.calls[0][0];
      const infoCall = consoleLogSpy.mock.calls[0][0];
      const warnCall = consoleWarnSpy.mock.calls[0][0];
      const errorCall = consoleErrorSpy.mock.calls[0][0];

      // All should have ISO 8601 timestamp format
      const isoTimestampRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
      expect(debugCall).toMatch(isoTimestampRegex);
      expect(infoCall).toMatch(isoTimestampRegex);
      expect(warnCall).toMatch(isoTimestampRegex);
      expect(errorCall).toMatch(isoTimestampRegex);
    });
  });

  describe('metadata handling', () => {
    it('should handle complex metadata objects', () => {
      const complexMetadata = {
        user: { id: '123', name: 'Test User' },
        request: { method: 'GET', url: '/api/test' },
        nested: { deep: { value: 42 } },
      };

      logger.info('Complex metadata test', complexMetadata);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/INFO: Complex metadata test/),
        complexMetadata
      );
    });

    it('should handle metadata with special characters', () => {
      const metadata = {
        message: 'Error: \\"Something\\" went wrong',
        stack: 'at Function.test\n  at Object.<anonymous>',
      };

      logger.error('Special characters test', metadata);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/ERROR: Special characters test/),
        metadata
      );
    });
  });
});
