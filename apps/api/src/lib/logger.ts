import { config } from './config.js';

interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

const logLevel = levels[config.LOG_LEVEL];

function formatLog(level: string, message: string, meta?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const log = {
    timestamp,
    level,
    message,
    ...(meta && { meta }),
  };
  
  if (config.NODE_ENV === 'development') {
    return `${timestamp} [${level.toUpperCase()}] ${message}${
      meta ? ` ${JSON.stringify(meta)}` : ''
    }`;
  }
  
  return JSON.stringify(log);
}

export const logger: Logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (logLevel <= levels.debug) {
      console.log(formatLog('debug', message, meta));
    }
  },
  
  info(message: string, meta?: Record<string, unknown>) {
    if (logLevel <= levels.info) {
      console.log(formatLog('info', message, meta));
    }
  },
  
  warn(message: string, meta?: Record<string, unknown>) {
    if (logLevel <= levels.warn) {
      console.warn(formatLog('warn', message, meta));
    }
  },
  
  error(message: string, meta?: Record<string, unknown>) {
    if (logLevel <= levels.error) {
      console.error(formatLog('error', message, meta));
    }
  },
};