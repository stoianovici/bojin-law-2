/**
 * Simple Logger Utility
 * Provides structured logging for the application
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMetadata {
  [key: string]: any;
}

class Logger {
  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...metadata,
    };

    const formattedMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, metadata || '');
        break;
      case 'info':
        console.log(formattedMessage, metadata || '');
        break;
      case 'warn':
        console.warn(formattedMessage, metadata || '');
        break;
      case 'error':
        console.error(formattedMessage, metadata || '');
        break;
    }
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: LogMetadata): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: LogMetadata): void {
    this.log('error', message, metadata);
  }
}

export default new Logger();
