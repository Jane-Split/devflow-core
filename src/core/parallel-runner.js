/**
 * Parallel Runner
 * Manages parallel execution of tasks with concurrency control
 */

import { ErrorCodes, OrchestrationError } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ParallelRunner');

/**
 * Task execution status
 */
export const ExecutionStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

/**
 * Parallel Runner
 * Executes tasks in parallel with configurable concurrency
 */
export class ParallelRunner {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.maxConcurrency = config.maxConcurrency || config.parallelTasks || 3;
    this.timeout = config.timeout || 300000; // 5 minutes default
    this.retryCount = config.retryCount || 0;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * Execute tasks in parallel with dependency awareness
   * @param {Array} tasks - Tasks to execute
   * @param {Function} executor - Async function to execute each task
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution results
   */
  async execute(tasks, executor, options = {}) {
    const {
      onTaskStart = null,
      onTaskComplete = null,
      onTaskError = null,
      onBatchStart = null,
      onBatchComplete = null,
    } = options;

    logger.info(
      `Starting parallel execution of ${tasks.length} tasks (max concurrency: ${this.maxConcurrency})`
    );

    const results = {
      tasks: new Map(),
      batches: [],
      stats: {
        total: tasks.length,
        completed: 0,
        failed: 0,
        skipped: 0,
        startTime: Date.now(),
        endTime: null,
      },
    };

    // Build dependency graph
    const graph = this._buildDependencyGraph(tasks);

    // Execute in batches based on dependencies
    let batchIndex = 0;
    while (results.stats.completed + results.stats.failed + results.stats.skipped < tasks.length) {
      // Get next batch of ready tasks
      const readyTasks = this._getReadyTasks(graph, results.tasks);

      if (readyTasks.length === 0) {
        // Check for deadlock
        const pendingCount =
          tasks.length - results.stats.completed - results.stats.failed - results.stats.skipped;
        if (pendingCount > 0) {
          logger.error('Deadlock detected - no ready tasks but pending tasks remain');
          break;
        }
        break;
      }

      batchIndex++;
      const batchTasks = readyTasks.slice(0, this.maxConcurrency);

      logger.debug(`Starting batch ${batchIndex} with ${batchTasks.length} tasks`);

      if (onBatchStart) {
        await onBatchStart(batchIndex, batchTasks);
      }

      // Execute batch in parallel
      const batchResults = await this._executeBatch(batchTasks, executor, {
        onTaskStart,
        onTaskComplete,
        onTaskError,
      });

      // Record results
      for (const result of batchResults) {
        results.tasks.set(result.taskId, result);

        if (result.status === ExecutionStatus.COMPLETED) {
          results.stats.completed++;
        } else if (result.status === ExecutionStatus.FAILED) {
          results.stats.failed++;
        } else if (result.status === ExecutionStatus.SKIPPED) {
          results.stats.skipped++;
        }
      }

      results.batches.push({
        index: batchIndex,
        tasks: batchTasks.map(t => t.id),
        results: batchResults,
      });

      if (onBatchComplete) {
        await onBatchComplete(batchIndex, batchResults);
      }
    }

    results.stats.endTime = Date.now();
    results.stats.duration = results.stats.endTime - results.stats.startTime;
    results.stats.success = results.stats.failed === 0;

    logger.info(
      `Parallel execution complete: ${results.stats.completed}/${results.stats.total} completed, ${results.stats.failed} failed`
    );

    return results;
  }

  /**
   * Build dependency graph from tasks
   * @param {Array} tasks - Tasks
   * @returns {Map} Dependency graph
   */
  _buildDependencyGraph(tasks) {
    const graph = new Map();

    for (const task of tasks) {
      graph.set(task.id, {
        task,
        dependencies: new Set(task.dependsOn || []),
        dependents: new Set(),
        status: ExecutionStatus.PENDING,
      });
    }

    // Build reverse dependencies (dependents)
    for (const task of tasks) {
      for (const depId of task.dependsOn || []) {
        const depNode = graph.get(depId);
        if (depNode) {
          depNode.dependents.add(task.id);
        }
      }
    }

    return graph;
  }

  /**
   * Get tasks that are ready to execute (all dependencies satisfied)
   * @param {Map} graph - Dependency graph
   * @param {Map} results - Current results
   * @returns {Array} Ready tasks
   */
  _getReadyTasks(graph, results) {
    const readyTasks = [];

    for (const [, node] of graph) {
      // Skip if already processed
      if (node.status !== ExecutionStatus.PENDING) {
        continue;
      }

      // Check if all dependencies are completed
      let allDepsCompleted = true;
      for (const depId of node.dependencies) {
        const depResult = results.get(depId);
        if (!depResult || depResult.status !== ExecutionStatus.COMPLETED) {
          allDepsCompleted = false;
          break;
        }
      }

      if (allDepsCompleted) {
        readyTasks.push(node.task);
      }
    }

    return readyTasks;
  }

  /**
   * Execute a batch of tasks in parallel
   * @param {Array} tasks - Tasks to execute
   * @param {Function} executor - Executor function
   * @param {Object} callbacks - Callbacks
   * @returns {Promise<Array>} Batch results
   */
  async _executeBatch(tasks, executor, callbacks) {
    const { onTaskStart, onTaskComplete, onTaskError } = callbacks;

    const promises = tasks.map(async task => {
      const startTime = Date.now();
      let result;
      let attempts = 0;
      const maxAttempts = this.retryCount + 1;

      while (attempts < maxAttempts) {
        attempts++;

        try {
          if (onTaskStart) {
            await onTaskStart(task);
          }

          // Execute with timeout
          result = await this._executeWithTimeout(executor, task, this.timeout);

          const endTime = Date.now();

          if (onTaskComplete) {
            await onTaskComplete(task, result);
          }

          return {
            taskId: task.id,
            status: ExecutionStatus.COMPLETED,
            result,
            startTime,
            endTime,
            duration: endTime - startTime,
            attempts,
          };
        } catch (error) {
          logger.warn(
            `Task ${task.id} failed (attempt ${attempts}/${maxAttempts}): ${error.message}`
          );

          if (attempts < maxAttempts) {
            // Wait before retry
            await this._sleep(this.retryDelay);
            continue;
          }

          const endTime = Date.now();

          if (onTaskError) {
            await onTaskError(task, error);
          }

          return {
            taskId: task.id,
            status: ExecutionStatus.FAILED,
            error: error.message,
            startTime,
            endTime,
            duration: endTime - startTime,
            attempts,
          };
        }
      }
    });

    return Promise.all(promises);
  }

  /**
   * Execute with timeout
   * @param {Function} executor - Executor function
   * @param {Object} task - Task
   * @param {number} timeout - Timeout in ms
   * @returns {Promise} Execution result
   */
  async _executeWithTimeout(executor, task, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new OrchestrationError(
            `Task ${task.id} timed out after ${timeout}ms`,
            ErrorCodes.TASK_EXECUTION_FAILED,
            { taskId: task.id, timeout }
          )
        );
      }, timeout);

      (async () => {
        try {
          const result = await executor(task);
          clearTimeout(timeoutId);
          resolve(result);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      })();
    });
  }

  /**
   * Sleep for specified duration
   * @param {number} ms - Milliseconds
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute tasks with priority ordering
   * @param {Array} tasks - Tasks to execute
   * @param {Function} executor - Executor function
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution results
   */
  async executeWithPriority(tasks, executor, options = {}) {
    // Sort tasks by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortedTasks = [...tasks].sort((a, b) => {
      const pa = priorityOrder[a.priority] || 1;
      const pb = priorityOrder[b.priority] || 1;
      return pa - pb;
    });

    return this.execute(sortedTasks, executor, options);
  }

  /**
   * Get execution statistics
   * @param {Object} results - Execution results
   * @returns {Object} Statistics
   */
  getStats(results) {
    const taskResults = Array.from(results.tasks.values());

    const durations = taskResults.filter(r => r.duration).map(r => r.duration);

    return {
      ...results.stats,
      averageDuration:
        durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      maxDuration: Math.max(...durations, 0),
      minDuration: Math.min(...durations, Infinity),
      batchCount: results.batches.length,
      successRate:
        results.stats.total > 0
          ? `${((results.stats.completed / results.stats.total) * 100).toFixed(1)}%`
          : 'N/A',
    };
  }
}

/**
 * Create parallel runner instance
 */
export function createParallelRunner(config = {}) {
  return new ParallelRunner(config);
}
