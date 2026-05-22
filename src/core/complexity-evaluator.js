/**
 * Complexity Evaluator
 * Evaluates task complexity based on multiple dimensions
 * Supports auto-evaluation and user override
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('ComplexityEvaluator');

/**
 * Complexity levels
 */
export const ComplexityLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

/**
 * Complexity thresholds
 */
const COMPLEXITY_THRESHOLDS = {
  linesOfCode: {
    low: 50,
    medium: 200,
    high: Infinity,
  },
  dependencies: {
    low: 1,
    medium: 3,
    high: Infinity,
  },
  interfaces: {
    low: 1,
    medium: 3,
    high: Infinity,
  },
};

/**
 * Business logic complexity indicators
 */
const BUSINESS_LOGIC_INDICATORS = {
  low: ['crud', 'simple', 'basic', 'list', 'get', 'create', 'update', 'delete'],
  medium: ['validate', 'transform', 'calculate', 'process', 'convert', 'parse'],
  high: ['transaction', 'async', 'concurrent', 'distributed', 'complex', 'multi-table', 'workflow'],
};

/**
 * Complexity Evaluator
 */
export class ComplexityEvaluator {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.defaultComplexity = config.defaultComplexity || 'auto';
  }

  /**
   * Evaluate task complexity
   * @param {Object} task - Task to evaluate
   * @param {Object} options - Evaluation options
   * @returns {Object} Evaluation result
   */
  evaluate(task, options = {}) {
    const {
      override = null, // User override
      projectProfile = null, // Project context
    } = options;

    // If user specified complexity, use that
    if (override && override !== 'auto') {
      logger.debug(`Using user-specified complexity: ${override}`);
      return {
        level: override,
        confidence: 1.0,
        source: 'user-override',
        dimensions: null,
      };
    }

    // Auto-evaluate
    const dimensions = this._evaluateDimensions(task, projectProfile);
    const level = this._determineLevel(dimensions);
    const confidence = this._calculateConfidence(dimensions);

    logger.debug(`Evaluated complexity: ${level} (confidence: ${confidence})`);

    return {
      level,
      confidence,
      source: 'auto-evaluated',
      dimensions,
      suggestions: this._generateSuggestions(level, dimensions),
    };
  }

  /**
   * Evaluate all complexity dimensions
   * @param {Object} task - Task to evaluate
   * @param {Object} projectProfile - Project profile
   * @returns {Object} Dimension scores
   */
  _evaluateDimensions(task, projectProfile) {
    return {
      linesOfCode: this._evaluateLinesOfCode(task),
      dependencies: this._evaluateDependencies(task),
      interfaces: this._evaluateInterfaces(task),
      businessLogic: this._evaluateBusinessLogic(task),
      risk: this._evaluateRisk(task, projectProfile),
    };
  }

  /**
   * Evaluate lines of code estimate
   * @param {Object} task - Task object
   * @returns {Object} LOC evaluation
   */
  _evaluateLinesOfCode(task) {
    // Estimate from task description and outputs
    let estimatedLOC = 0;

    // Base estimate from task type
    const typeEstimates = {
      'api-endpoint': 50,
      'ui-component': 80,
      'page': 150,
      'service': 100,
      'utility': 30,
      'test': 40,
      'refactor': 100,
      'bugfix': 20,
      'implementation': 100,
    };

    estimatedLOC = typeEstimates[task.type] || 50;

    // Adjust based on output files
    if (task.output?.files) {
      estimatedLOC += task.output.files.length * 30;
    }

    // Adjust based on acceptance criteria
    if (task.acceptanceCriteria) {
      estimatedLOC += task.acceptanceCriteria.length * 10;
    }

    // Determine level
    let level = ComplexityLevel.LOW;
    if (estimatedLOC > COMPLEXITY_THRESHOLDS.linesOfCode.medium) {
      level = ComplexityLevel.HIGH;
    } else if (estimatedLOC > COMPLEXITY_THRESHOLDS.linesOfCode.low) {
      level = ComplexityLevel.MEDIUM;
    }

    return {
      estimated: estimatedLOC,
      level,
      score: estimatedLOC,
    };
  }

  /**
   * Evaluate dependency complexity
   * @param {Object} task - Task object
   * @returns {Object} Dependency evaluation
   */
  _evaluateDependencies(task) {
    const depCount = (task.dependsOn || []).length;

    let level = ComplexityLevel.LOW;
    if (depCount > COMPLEXITY_THRESHOLDS.dependencies.medium) {
      level = ComplexityLevel.HIGH;
    } else if (depCount > COMPLEXITY_THRESHOLDS.dependencies.low) {
      level = ComplexityLevel.MEDIUM;
    }

    return {
      count: depCount,
      level,
      score: depCount,
    };
  }

  /**
   * Evaluate interface complexity
   * @param {Object} task - Task object
   * @returns {Object} Interface evaluation
   */
  _evaluateInterfaces(task) {
    let interfaceCount = 0;

    // Count from task specification
    if (task.interfaceSpec) {
      if (task.interfaceSpec.methods) {
        interfaceCount += task.interfaceSpec.methods.length;
      }
      if (task.interfaceSpec.endpoints) {
        interfaceCount += task.interfaceSpec.endpoints.length;
      }
    }

    // Estimate from task type
    if (task.type === 'api-endpoint') {
      interfaceCount = Math.max(interfaceCount, 1);
    } else if (task.type === 'service') {
      interfaceCount = Math.max(interfaceCount, 3);
    }

    let level = ComplexityLevel.LOW;
    if (interfaceCount > COMPLEXITY_THRESHOLDS.interfaces.medium) {
      level = ComplexityLevel.HIGH;
    } else if (interfaceCount > COMPLEXITY_THRESHOLDS.interfaces.low) {
      level = ComplexityLevel.MEDIUM;
    }

    return {
      count: interfaceCount,
      level,
      score: interfaceCount,
    };
  }

  /**
   * Evaluate business logic complexity
   * @param {Object} task - Task object
   * @returns {Object} Business logic evaluation
   */
  _evaluateBusinessLogic(task) {
    const description = (task.description || '').toLowerCase();
    const title = (task.title || '').toLowerCase();
    const combined = `${title} ${description}`;

    // Check for complexity indicators
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const indicator of BUSINESS_LOGIC_INDICATORS.high) {
      if (combined.includes(indicator)) highCount++;
    }

    for (const indicator of BUSINESS_LOGIC_INDICATORS.medium) {
      if (combined.includes(indicator)) mediumCount++;
    }

    for (const indicator of BUSINESS_LOGIC_INDICATORS.low) {
      if (combined.includes(indicator)) lowCount++;
    }

    // Determine level
    let level = ComplexityLevel.LOW;
    if (highCount > 0) {
      level = ComplexityLevel.HIGH;
    } else if (mediumCount > 0) {
      level = ComplexityLevel.MEDIUM;
    }

    return {
      highIndicators: highCount,
      mediumIndicators: mediumCount,
      lowIndicators: lowCount,
      level,
      score: highCount * 3 + mediumCount * 2 + lowCount,
    };
  }

  /**
   * Evaluate risk factors
   * @param {Object} task - Task object
   * @param {Object} projectProfile - Project profile
   * @returns {Object} Risk evaluation
   */
  _evaluateRisk(task, projectProfile) {
    const riskFactors = [];

    // Check for high-risk patterns
    if (task.type === 'refactor') {
      riskFactors.push('refactoring-risk');
    }

    if (task.dependsOn && task.dependsOn.length > 3) {
      riskFactors.push('high-dependency-risk');
    }

    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 5) {
      riskFactors.push('many-criteria-risk');
    }

    // Check if task involves critical components
    const criticalKeywords = ['auth', 'payment', 'security', 'encryption', 'user-data'];
    const description = (task.description || '').toLowerCase();
    for (const keyword of criticalKeywords) {
      if (description.includes(keyword)) {
        riskFactors.push(`critical-${keyword}`);
      }
    }

    // Determine level based on risk factors
    let level = ComplexityLevel.LOW;
    if (riskFactors.length >= 3) {
      level = ComplexityLevel.HIGH;
    } else if (riskFactors.length >= 1) {
      level = ComplexityLevel.MEDIUM;
    }

    return {
      factors: riskFactors,
      level,
      score: riskFactors.length,
    };
  }

  /**
   * Determine overall complexity level
   * @param {Object} dimensions - Dimension evaluations
   * @returns {string} Complexity level
   */
  _determineLevel(dimensions) {
    const levels = Object.values(dimensions).map(d => d.level);

    // Count each level
    const highCount = levels.filter(l => l === ComplexityLevel.HIGH).length;
    const mediumCount = levels.filter(l => l === ComplexityLevel.MEDIUM).length;

    // Determine overall level
    if (highCount >= 2) {
      return ComplexityLevel.HIGH;
    }
    if (highCount >= 1 || mediumCount >= 3) {
      return ComplexityLevel.MEDIUM;
    }
    return ComplexityLevel.LOW;
  }

  /**
   * Calculate confidence in evaluation
   * @param {Object} dimensions - Dimension evaluations
   * @returns {number} Confidence score (0-1)
   */
  _calculateConfidence(dimensions) {
    // Higher confidence when dimensions agree
    const levels = Object.values(dimensions).map(d => d.level);
    const uniqueLevels = new Set(levels).size;

    // More agreement = higher confidence
    if (uniqueLevels === 1) return 0.9;
    if (uniqueLevels === 2) return 0.7;
    return 0.5;
  }

  /**
   * Generate suggestions based on complexity
   * @param {string} level - Complexity level
   * @param {Object} dimensions - Dimension evaluations
   * @returns {Array} Suggestions
   */
  _generateSuggestions(level, dimensions) {
    const suggestions = [];

    if (level === ComplexityLevel.HIGH) {
      suggestions.push('Consider splitting this task into smaller subtasks');
      suggestions.push('Review dependencies before starting');

      if (dimensions.risk.factors.length > 0) {
        suggestions.push('Pay attention to risk factors: ' + dimensions.risk.factors.join(', '));
      }
    }

    if (dimensions.dependencies.count > 3) {
      suggestions.push('Multiple dependencies - ensure they are completed first');
    }

    if (dimensions.businessLogic.highIndicators > 0) {
      suggestions.push('Complex business logic detected - consider detailed design');
    }

    return suggestions;
  }

  /**
   * Batch evaluate multiple tasks
   * @param {Array} tasks - Tasks to evaluate
   * @param {Object} options - Evaluation options
   * @returns {Array} Evaluation results
   */
  batchEvaluate(tasks, options = {}) {
    return tasks.map(task => ({
      taskId: task.id,
      ...this.evaluate(task, options),
    }));
  }

  /**
   * Get complexity statistics for a set of tasks
   * @param {Array} evaluations - Evaluation results
   * @returns {Object} Statistics
   */
  getStats(evaluations) {
    const stats = {
      total: evaluations.length,
      byLevel: {
        [ComplexityLevel.LOW]: 0,
        [ComplexityLevel.MEDIUM]: 0,
        [ComplexityLevel.HIGH]: 0,
      },
      averageConfidence: 0,
      highComplexityTasks: [],
    };

    let totalConfidence = 0;

    for (const eval of evaluations) {
      stats.byLevel[eval.level]++;
      totalConfidence += eval.confidence;

      if (eval.level === ComplexityLevel.HIGH) {
        stats.highComplexityTasks.push(eval.taskId);
      }
    }

    stats.averageConfidence = evaluations.length > 0
      ? totalConfidence / evaluations.length
      : 0;

    return stats;
  }
}

/**
 * Create complexity evaluator instance
 */
export function createComplexityEvaluator(config = {}) {
  return new ComplexityEvaluator(config);
}
