/**
 * Manual mock for logger
 * Provides all methods the real logger has plus child() for services that use it
 *
 * Note: Uses Object.assign to ensure child() always returns a new mock,
 * even when Jest's resetMocks option is enabled.
 */

interface LoggerMock {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  child: (meta?: Record<string, unknown>) => LoggerMock;
}

const createLoggerMock = (): LoggerMock => {
  const mock: LoggerMock = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: () => createLoggerMock(),
  };
  return mock;
};

// Export a single instance but child() always creates fresh mocks
export default createLoggerMock();
