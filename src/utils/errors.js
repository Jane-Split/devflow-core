/**
 * Error Handling Framework
 * Custom error classes for DevFlow
 */

/**
 * Error codes for different types of errors
 */
export const ErrorCodes = {
  // Configuration errors (1xxx)
  CONFIG_NOT_FOUND: 'DF1001',
  CONFIG_INVALID: 'DF1002',
  CONFIG_PARSE_ERROR: 'DF1003',

  // Memory errors (2xxx)
  MEMORY_READ_ERROR: 'DF2001',
  MEMORY_WRITE_ERROR: 'DF2002',
  MEMORY_NOT_FOUND: 'DF2003',
  EMBEDDING_ERROR: 'DF2004',
  VECTOR_INDEX_ERROR: 'DF2005',

  // Analysis errors (3xxx)
  ANALYSIS_FAILED: 'DF3001',
  PROJECT_TYPE_UNKNOWN: 'DF3002',
  CONVENTION_EXTRACT_ERROR: 'DF3003',

  // Orchestration errors (4xxx)
  TASK_GRAPH_CYCLE: 'DF4001',
  TASK_NOT_FOUND: 'DF4002',
  TASK_EXECUTION_FAILED: 'DF4003',
  TOKEN_BUDGET_EXCEEDED: 'DF4004',
  CONTEXT_OVERFLOW: 'DF4005',

  // Testing errors (5xxx)
  TEST_GENERATION_FAILED: 'DF5001',
  TEST_EXECUTION_FAILED: 'DF5002',
  BROWSER_NOT_FOUND: 'DF5003',
  COVERAGE_CHECK_FAILED: 'DF5004',

  // CLI errors (6xxx)
  COMMAND_NOT_FOUND: 'DF6001',
  INVALID_ARGUMENTS: 'DF6002',
  PERMISSION_DENIED: 'DF6003',

  // Tool adapter errors (7xxx)
  TOOL_DETECTION_FAILED: 'DF7001',
  UNSUPPORTED_TOOL: 'DF7002',
  ADAPTER_ERROR: 'DF7003',

  // General errors (9xxx)
  UNKNOWN_ERROR: 'DF9001',
  NOT_IMPLEMENTED: 'DF9002',
  NETWORK_ERROR: 'DF9003',
  FILE_SYSTEM_ERROR: 'DF9004',
};

/**
 * Base error class for DevFlow
 */
export class DevFlowError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code from ErrorCodes
   * @param {Object} details - Additional error details
   */
  constructor(message, code = ErrorCodes.UNKNOWN_ERROR, details = {}) {
    super(message);
    this.name = 'DevFlowError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DevFlowError);
    }
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Get user-friendly error message
   */
  toUserMessage() {
    return `[${this.code}] ${this.message}`;
  }
}

/**
 * Configuration-related errors
 */
export class ConfigError extends DevFlowError {
  constructor(message, code = ErrorCodes.CONFIG_INVALID, details = {}) {
    super(message, code, details);
    this.name = 'ConfigError';
  }
}

/**
 * Memory system errors
 */
export class MemoryError extends DevFlowError {
  constructor(message, code = ErrorCodes.MEMORY_READ_ERROR, details = {}) {
    super(message, code, details);
    this.name = 'MemoryError';
  }
}

/**
 * Analysis errors
 */
export class AnalysisError extends DevFlowError {
  constructor(message, code = ErrorCodes.ANALYSIS_FAILED, details = {}) {
    super(message, code, details);
    this.name = 'AnalysisError';
  }
}

/**
 * Orchestration errors
 */
export class OrchestrationError extends DevFlowError {
  constructor(message, code = ErrorCodes.TASK_EXECUTION_FAILED, details = {}) {
    super(message, code, details);
    this.name = 'OrchestrationError';
  }
}

/**
 * Testing errors
 */
export class TestingError extends DevFlowError {
  constructor(message, code = ErrorCodes.TEST_EXECUTION_FAILED, details = {}) {
    super(message, code, details);
    this.name = 'TestingError';
  }
}

/**
 * Tool adapter errors
 */
export class ToolAdapterError extends DevFlowError {
  constructor(message, code = ErrorCodes.ADAPTER_ERROR, details = {}) {
    super(message, code, details);
    this.name = 'ToolAdapterError';
  }
}

/**
 * Error handler for CLI
 * @param {Error} error - Error to handle
 * @param {boolean} debug - Whether to show debug info
 */
export function handleCliError(error, debug = false) {
  const isDevFlowError = error instanceof DevFlowError;

  if (isDevFlowError) {
    console.error(`\n❌ Error: ${error.toUserMessage()}`);

    if (debug && Object.keys(error.details).length > 0) {
      console.error('\nDetails:');
      console.error(JSON.stringify(error.details, null, 2));
    }

    if (debug && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  } else {
    console.error(`\n❌ Unexpected error: ${error.message}`);

    if (debug && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }

  // Exit with appropriate code
  process.exit(isDevFlowError ? 1 : 2);
}

/**
 * Wrap async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {Function} errorHandler - Error handler function
 */
export function withErrorHandling(fn, errorHandler = handleCliError) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const debug = process.env.DEVFLOW_DEBUG === 'true';
      errorHandler(error, debug);
    }
  };
}
