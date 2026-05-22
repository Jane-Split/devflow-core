/**
 * Learning Engine
 * Records patterns and pitfalls from execution history
 * Provides suggestions for similar tasks
 */

import { MemoryManager } from '../memory/manager.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('LearningEngine');

/**
 * Pattern categories
 */
export const PatternCategory = {
  IMPLEMENTATION: 'implementation',
  TESTING: 'testing',
  REFACTORING: 'refactoring',
  OPTIMIZATION: 'optimization',
  ARCHITECTURE: 'architecture',
  DEBUGGING: 'debugging',
};

/**
 * Learning Engine
 */
export class LearningEngine {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.projectRoot = config.projectRoot || process.cwd();
    this.memoryManager = null;
    this.patternCache = new Map();
  }

  /**
   * Initialize learning engine
   */
  async initialize() {
    this.memoryManager = new MemoryManager({
      projectRoot: this.projectRoot,
      config: this.config,
    });
    await this.memoryManager.initialize();

    // Load patterns into cache
    await this._loadPatternCache();

    logger.debug('Learning engine initialized');
  }

  /**
   * Load patterns into memory cache
   */
  async _loadPatternCache() {
    const patterns = await this.memoryManager.list('patterns');
    const pitfalls = await this.memoryManager.list('pitfalls');

    this.patternCache.set('patterns', patterns);
    this.patternCache.set('pitfalls', pitfalls);
  }

  /**
   * Record a successful pattern
   * @param {Object} pattern - Pattern to record
   */
  async recordPattern(pattern) {
    logger.debug(`Recording pattern: ${pattern.name || pattern.title}`);

    const patternEntry = {
      name: pattern.name || pattern.title,
      description: pattern.description,
      category: pattern.category || PatternCategory.IMPLEMENTATION,
      context: pattern.context,
      solution: pattern.solution,
      taskType: pattern.taskType,
      technologies: pattern.technologies || [],
      tags: pattern.tags || [],
      success: true,
      recordedAt: new Date().toISOString(),
    };

    await this.memoryManager.recordPattern(patternEntry);

    // Update cache
    const patterns = this.patternCache.get('patterns') || [];
    patterns.push(patternEntry);
    this.patternCache.set('patterns', patterns);

    logger.info(`Pattern recorded: ${patternEntry.name}`);
  }

  /**
   * Record a pitfall
   * @param {Object} pitfall - Pitfall to record
   */
  async recordPitfall(pitfall) {
    logger.debug(`Recording pitfall: ${pitfall.name || pitfall.title}`);

    const pitfallEntry = {
      name: pitfall.name || pitfall.title,
      description: pitfall.description,
      category: pitfall.category || PatternCategory.IMPLEMENTATION,
      context: pitfall.context,
      symptom: pitfall.symptom,
      solution: pitfall.solution,
      taskType: pitfall.taskType,
      technologies: pitfall.technologies || [],
      tags: pitfall.tags || [],
      severity: pitfall.severity || 'medium',
      recordedAt: new Date().toISOString(),
    };

    await this.memoryManager.recordPitfall(pitfallEntry);

    // Update cache
    const pitfalls = this.patternCache.get('pitfalls') || [];
    pitfalls.push(pitfallEntry);
    this.patternCache.set('pitfalls', pitfalls);

    logger.info(`Pitfall recorded: ${pitfallEntry.name}`);
  }

  /**
   * Suggest patterns for a task
   * @param {Object} task - Task to get suggestions for
   * @returns {Promise<Array>} Suggested patterns
   */
  async suggestPatterns(task) {
    logger.debug(`Getting pattern suggestions for task: ${task.title}`);

    const searchContext = [
      task.title,
      task.description,
      task.type,
      ...(task.tags || []),
    ].join(' ');

    const results = await this.memoryManager.findSimilarPatterns(searchContext, {
      limit: 5,
    });

    return results.map(r => ({
      ...r.entry?.content,
      score: r.score,
    }));
  }

  /**
   * Get relevant pitfalls for a task
   * @param {Object} task - Task to get pitfalls for
   * @returns {Promise<Array>} Relevant pitfalls
   */
  async getRelevantPitfalls(task) {
    logger.debug(`Getting pitfall warnings for task: ${task.title}`);

    const searchContext = [
      task.title,
      task.description,
      task.type,
      ...(task.tags || []),
    ].join(' ');

    const results = await this.memoryManager.findRelevantPitfalls(searchContext, {
      limit: 5,
    });

    return results.map(r => ({
      ...r.entry?.content,
      score: r.score,
    }));
  }

  /**
   * Learn from workflow execution
   * @param {Object} execution - Execution data
   */
  async learnFromExecution(execution) {
    const { task, result, duration, errors } = execution;

    // Record patterns from successful executions
    if (result?.success && task) {
      await this.recordPattern({
        name: `Successful: ${task.title}`,
        description: `Successfully completed task: ${task.title}`,
        category: this._inferCategory(task.type),
        context: {
          taskType: task.type,
          projectType: execution.projectType,
        },
        solution: result.output || result.summary,
        taskType: task.type,
        technologies: execution.technologies || [],
        tags: [task.type, 'successful', execution.projectType],
      });
    }

    // Record pitfalls from failed executions
    if (!result?.success && errors?.length > 0) {
      for (const error of errors) {
        await this.recordPitfall({
          name: `Error in: ${task?.title || 'Unknown'}`,
          description: error.message || error,
          category: this._inferCategory(task?.type),
          symptom: error.message || String(error),
          solution: error.solution || 'Needs investigation',
          taskType: task?.type,
          technologies: execution.technologies || [],
          tags: [task?.type, 'failed', execution.projectType],
          severity: this._inferSeverity(error),
        });
      }
    }

    // Record execution metrics
    await this._recordMetrics(execution);
  }

  /**
   * Infer category from task type
   */
  _inferCategory(taskType) {
    const mapping = {
      implementation: PatternCategory.IMPLEMENTATION,
      testing: PatternCategory.TESTING,
      refactoring: PatternCategory.REFACTORING,
      optimization: PatternCategory.OPTIMIZATION,
      architecture: PatternCategory.ARCHITECTURE,
      debugging: PatternCategory.DEBUGGING,
    };

    return mapping[taskType] || PatternCategory.IMPLEMENTATION;
  }

  /**
   * Infer severity from error
   */
  _inferSeverity(error) {
    if (error.severity) return error.severity;

    const message = String(error.message || error).toLowerCase();
    
    if (message.includes('fatal') || message.includes('critical')) {
      return 'critical';
    }
    if (message.includes('timeout') || message.includes('memory')) {
      return 'high';
    }
    if (message.includes('warning')) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Record execution metrics
   */
  async _recordMetrics(execution) {
    const metrics = {
      taskType: execution.task?.type,
      projectType: execution.projectType,
      duration: execution.duration,
      success: execution.result?.success,
      timestamp: new Date().toISOString(),
    };

    await this.memoryManager.store('learning', `metrics-${Date.now()}`, metrics, {
      source: 'learning-engine',
      type: 'metrics',
    });
  }

  /**
   * Get statistics
   */
  async getStats() {
    const patterns = this.patternCache.get('patterns') || [];
    const pitfalls = this.patternCache.get('pitfalls') || [];

    const categoryStats = {};
    
    for (const pattern of patterns) {
      categoryStats[pattern.category] = (categoryStats[pattern.category] || 0) + 1;
    }

    const pitfallSeverityStats = {};
    for (const pitfall of pitfalls) {
      pitfallSeverityStats[pitfall.severity] = (pitfallSeverityStats[pitfall.severity] || 0) + 1;
    }

    return {
      totalPatterns: patterns.length,
      totalPitfalls: pitfalls.length,
      patternsByCategory: categoryStats,
      pitfallsBySeverity: pitfallSeverityStats,
      cachedAt: new Date().toISOString(),
    };
  }

  /**
   * Export learning data
   */
  async export() {
    return {
      patterns: this.patternCache.get('patterns') || [],
      pitfalls: this.patternCache.get('pitfalls') || [],
      exportedAt: new Date().toISOString(),
    };
  }
}

/**
 * Create learning engine
 */
export function createLearningEngine(config = {}) {
  return new LearningEngine(config);
}
