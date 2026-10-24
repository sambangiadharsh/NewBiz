export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: unknown;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production';

  private format(payload: LogPayload): string {
    if (this.isProduction) {
      return JSON.stringify(payload);
    }
    const color = {
      debug: '\x1b[34m', // Blue
      info: '\x1b[32m',  // Green 
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
    }[payload.level];
    const reset = '\x1b[0m';
    const ctx = payload.context ? `[${payload.context}] ` : '';
    const details = payload.data ? `\n${JSON.stringify(payload.data, null, 2)}` : '';
    const errStack = payload.error?.stack ? `\n${payload.error.stack}` : '';
    return `${payload.timestamp} ${color}[${payload.level.toUpperCase()}]${reset} ${ctx}${payload.message}${details}${errStack}`;
  }

  private log(level: LogLevel, message: string, data?: unknown, context?: string): void {
    const payload: LogPayload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      data: data instanceof Error ? undefined : data,
      error: data instanceof Error ? { name: data.name, message: data.message, stack: data.stack } : undefined,
    };

    const formatted = this.format(payload);
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  debug(message: string, data?: unknown, context?: string): void {
    if (!this.isProduction) {
      this.log('debug', message, data, context);
    }
  }

  info(message: string, data?: unknown, context?: string): void {
    this.log('info', message, data, context);
  }

  warn(message: string, data?: unknown, context?: string): void {
    this.log('warn', message, data, context);
  }

  error(message: string, errorOrData?: unknown, context?: string): void {
    this.log('error', message, errorOrData, context);
  }
}

export const logger = new Logger();
