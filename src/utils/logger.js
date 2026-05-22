/**
 * Logger Utility
 * Structured logging with multiple levels
 */

import { format } from 'util';

/**
 * Log levels
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
};

/**
 * Log level names for output
 */
const LogLevelNames = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

/**
 * ANSI color codes
 */
const Colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Level colors
 */
const LevelColors = {
  [LogLevel.DEBUG]: Colors.dim,
  [LogLevel.INFO]: Colors.blue,
  [LogLevel.WARN]: Colors.yellow,
  [LogLevel.ERROR]: Colors.red,
};

/**
 * Logger class
 */
export class Logger {
  /**
   * @param {string} context - Logger context (usually module name)
   * @param {number} level - Log level
   */
  constructor(context = 'DevFlow', level = null) {
    this.context = context;
    this.level = level ?? this._getDefaultLevel();
    this.useColors = process.stdout.isTTY;
  }

  /**
   * Get default log level from environment
   */
  _getDefaultLevel() {
    if (process.env.DEVFLOW_DEBUG === 'true') {
      return LogLevel.DEBUG;
    }
    if (process.env.NODE_ENV === 'test') {
      return LogLevel.ERROR;
    }
    return LogLevel.INFO;
  }

  /**
   * Format log message
   */
  _format(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const levelName = LogLevelNames[level];
    const formattedMessage = args.length > 0 ? format(message, ...args) : message;

    if (this.useColors) {
      const color = LevelColors[level];
      return `${Colors.dim}[${timestamp}]${Colors.reset} ${color}[${levelName}]${Colors.reset} ${Colors.cyan}[${this.context}]${Colors.reset} ${formattedMessage}`;
    }

    return `[${timestamp}] [${levelName}] [${this.context}] ${formattedMessage}`;
  }

  /**
   * Log message if level is sufficient
   */
  _log(level, message, ...args) {
    if (level < this.level) {
      return;
    }

    const output = this._format(level, message, ...args);

    if (level >= LogLevel.ERROR) {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  /**
   * Debug level log
   */
  debug(message, ...args) {
    this._log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * Info level log
   */
  info(message, ...args) {
    this._log(LogLevel.INFO, message, ...args);
  }

  /**
   * Warn level log
   */
  warn(message, ...args) {
    this._log(LogLevel.WARN, message, ...args);
  }

  /**
   * Error level log
   */
  error(message, ...args) {
    this._log(LogLevel.ERROR, message, ...args);
  }

  /**
   * Set log level
   */
  setLevel(level) {
    this.level = level;
  }

  /**
   * Create child logger with context
   */
  child(context) {
    return new Logger(`${this.context}:${context}`, this.level);
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger('DevFlow');

/**
 * Create a logger for a specific module
 */
export function createLogger(context) {
  return new Logger(context);
}
