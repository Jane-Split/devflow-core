/**
 * Token Budget Manager
 * Manages context size and applies compression when overflow detected
 * 5-step compression pipeline
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('TokenBudgetManager');

/**
 * Compression strategies
 */
export const CompressionStrategy = {
  COMPRESS_DESIGN_DOC: 'compress-design-doc',
  SUMMARIZE_CODE_FILES: 'summarize-code-files',
  REMOVE_RETRIEVAL_CONTEXT: 'remove-retrieval-context',
  COMPRESS_TASK_CONTEXT: 'compress-task-context',
  SPLIT_SUBTASKS: 'split-subtasks',
};

/**
 * Compression result
 */
export class CompressionResult {
  constructor(originalTokens, compressedTokens, strategies) {
    this.originalTokens = originalTokens;
    this.compressedTokens = compressedTokens;
    this.strategies = strategies;
    this.savingsRatio =
      originalTokens > 0 ? (originalTokens - compressedTokens) / originalTokens : 0;
  }
}

/**
 * Token Budget Manager
 */
export class TokenBudgetManager {
  /**
   * @param {Object} config - Configuration
   * @param {number} config.contextLimit - Token budget limit
   * @param {number} config.safetyMargin - Safety margin (default 0.1 = 10%)
   */
  constructor(config = {}) {
    this.contextLimit = config.contextLimit || 128000;
    this.safetyMargin = config.safetyMargin || 0.1;
    this.effectiveLimit = Math.floor(this.contextLimit * (1 - this.safetyMargin));

    // Compression strategy configurations
    this.strategies = {
      [CompressionStrategy.COMPRESS_DESIGN_DOC]: {
        enabled: true,
        targetSavings: 0.3, // 30% of original
      },
      [CompressionStrategy.SUMMARIZE_CODE_FILES]: {
        enabled: true,
        targetSavings: 0.4, // 40% of original
      },
      [CompressionStrategy.REMOVE_RETRIEVAL_CONTEXT]: {
        enabled: true,
        targetSavings: 0.2, // 20% of original
      },
      [CompressionStrategy.COMPRESS_TASK_CONTEXT]: {
        enabled: true,
        targetSavings: 0.2, // 20% of original
      },
      [CompressionStrategy.SPLIT_SUBTASKS]: {
        enabled: true,
        targetSavings: 0.5, // 50% of original (most aggressive)
      },
    };

    this.compressionHistory = [];
  }

  /**
   * Estimate tokens in text
   * Uses character-based estimation
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    if (!text) {
      return 0;
    }

    // Common estimation: ~4 characters per token for English
    // ~2 characters per token for Chinese
    const englishChars = text.replace(/[\u4e00-\u9fff]/g, '').length;
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;

    return Math.ceil(englishChars / 4 + chineseChars / 2);
  }

  /**
   * Check if content fits within budget
   * @param {string} content - Content to check
   * @returns {boolean} Whether it fits
   */
  fitsInBudget(content) {
    const tokens = this.estimateTokens(content);
    return tokens <= this.effectiveLimit;
  }

  /**
   * Get remaining budget
   * @param {number} currentTokens - Current token count
   * @returns {number} Remaining budget
   */
  getRemainingBudget(currentTokens) {
    return Math.max(0, this.effectiveLimit - currentTokens);
  }

  /**
   * Calculate how much to reduce
   * @param {number} currentTokens - Current token count
   * @returns {number} Tokens to reduce
   */
  calculateReductionNeeded(currentTokens) {
    return Math.max(0, currentTokens - this.effectiveLimit);
  }

  /**
   * Run the 5-step compression pipeline
   * @param {Object} context - Full context object
   * @param {Object} task - Current task
   * @param {number} currentTokens - Current token count
   * @returns {Promise<Object>} Compressed context
   */
  async runCompressionPipeline(context, task, currentTokens) {
    logger.debug(`Running compression pipeline. Current tokens: ${currentTokens}`);

    const strategies = [];
    const compressed = structuredClone(context);
    const targetReduction = this.calculateReductionNeeded(currentTokens);

    if (targetReduction <= 0) {
      return { context: compressed, strategies: [], originalTokens: currentTokens };
    }

    const originalTokens = currentTokens;

    // Step 1: Compress design document
    if (this.strategies[CompressionStrategy.COMPRESS_DESIGN_DOC].enabled) {
      if (compressed.designDoc && currentTokens > this.effectiveLimit) {
        const result = await this._compressDesignDoc(compressed.designDoc);
        compressed.designDoc = result.compressed;
        currentTokens -= result.saved;
        strategies.push(CompressionStrategy.COMPRESS_DESIGN_DOC);
        logger.debug(`Step 1: Compressed design doc, saved ${result.saved} tokens`);
      }
    }

    // Check if we need more compression
    if (currentTokens <= this.effectiveLimit) {
      return this._finalize(compressed, strategies, originalTokens, currentTokens);
    }

    // Step 2: Summarize code files
    if (this.strategies[CompressionStrategy.SUMMARIZE_CODE_FILES].enabled) {
      if (compressed.codeFiles && compressed.codeFiles.length > 0) {
        const result = await this._summarizeCodeFiles(compressed.codeFiles);
        compressed.codeFiles = result.summarized;
        currentTokens -= result.saved;
        strategies.push(CompressionStrategy.SUMMARIZE_CODE_FILES);
        logger.debug(`Step 2: Summarized code files, saved ${result.saved} tokens`);
      }
    }

    // Check if we need more compression
    if (currentTokens <= this.effectiveLimit) {
      return this._finalize(compressed, strategies, originalTokens, currentTokens);
    }

    // Step 3: Remove retrieval context
    if (this.strategies[CompressionStrategy.REMOVE_RETRIEVAL_CONTEXT].enabled) {
      if (compressed.retrievalContext) {
        const result = await this._removeRetrievalContext(compressed.retrievalContext);
        compressed.retrievalContext = result.removed ? null : compressed.retrievalContext;
        currentTokens -= result.saved;
        strategies.push(CompressionStrategy.REMOVE_RETRIEVAL_CONTEXT);
        logger.debug(`Step 3: Removed retrieval context, saved ${result.saved} tokens`);
      }
    }

    // Check if we need more compression
    if (currentTokens <= this.effectiveLimit) {
      return this._finalize(compressed, strategies, originalTokens, currentTokens);
    }

    // Step 4: Compress task context
    if (this.strategies[CompressionStrategy.COMPRESS_TASK_CONTEXT].enabled) {
      if (compressed.taskContext) {
        const result = await this._compressTaskContext(compressed.taskContext);
        compressed.taskContext = result.compressed;
        currentTokens -= result.saved;
        strategies.push(CompressionStrategy.COMPRESS_TASK_CONTEXT);
        logger.debug(`Step 4: Compressed task context, saved ${result.saved} tokens`);
      }
    }

    // Check if we need more compression
    if (currentTokens <= this.effectiveLimit) {
      return this._finalize(compressed, strategies, originalTokens, currentTokens);
    }

    // Step 5: Split into subtasks (most aggressive)
    if (this.strategies[CompressionStrategy.SPLIT_SUBTASKS].enabled) {
      compressed.splitRequired = true;
      compressed.originalTask = task;
      compressed.subtaskHints = this._generateSubtaskHints(task);
      strategies.push(CompressionStrategy.SPLIT_SUBTASKS);
      logger.debug('Step 5: Marked for subtask splitting');
    }

    return this._finalize(compressed, strategies, originalTokens, currentTokens);
  }

  /**
   * Finalize compression result
   */
  _finalize(compressed, strategies, originalTokens, currentTokens) {
    const result = {
      context: compressed,
      strategies,
      originalTokens,
      compressedTokens: currentTokens,
      savingsRatio: originalTokens > 0 ? (originalTokens - currentTokens) / originalTokens : 0,
    };

    this.compressionHistory.push(result);
    logger.debug(`Compression complete. Strategies: ${strategies.join(', ')}`);

    return result;
  }

  /**
   * Compress design document
   */
  async _compressDesignDoc(designDoc) {
    if (typeof designDoc !== 'string') {
      designDoc = JSON.stringify(designDoc);
    }

    const originalLength = designDoc.length;

    // Remove excessive whitespace
    let compressed = designDoc
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // If still too long, truncate and add summary
    const maxLength = Math.floor(originalLength * 0.3);
    if (compressed.length > maxLength) {
      compressed = `${compressed.slice(0, maxLength)}\n\n[... Design document truncated for context limits ...]`;
    }

    const saved = originalLength - compressed.length;
    return { compressed, saved: Math.max(0, saved) };
  }

  /**
   * Summarize code files
   */
  async _summarizeCodeFiles(codeFiles) {
    if (!codeFiles || !Array.isArray(codeFiles)) {
      return { summarized: [], saved: 0 };
    }

    const originalLength = JSON.stringify(codeFiles).length;
    const summarized = codeFiles.map(file => ({
      path: file.path,
      summary: file.summary || this._generateFileSummary(file.content || ''),
      lineCount: file.lineCount || file.content?.split('\n').length || 0,
      keyFunctions: file.keyFunctions || this._extractKeyFunctions(file.content || ''),
    }));

    const saved = originalLength - JSON.stringify(summarized).length;
    return { summarized, saved: Math.max(0, saved) };
  }

  /**
   * Generate file summary
   */
  _generateFileSummary(content) {
    if (!content) {
      return 'Empty file';
    }

    const lines = content.split('\n');
    const imports = lines.filter(l => l.trim().startsWith('import')).slice(0, 5);
    const exports = lines.filter(l => l.includes('export'));

    return `File with ${lines.length} lines, ${imports.length} imports, ${exports.length} exports`;
  }

  /**
   * Extract key functions
   */
  _extractKeyFunctions(content) {
    if (!content) {
      return [];
    }

    const functionRegex = /(?:function|const|let|var)\s+(\w+)\s*[=()]/g;
    const matches = [];
    let match;

    while ((match = functionRegex.exec(content)) !== null && matches.length < 10) {
      matches.push(match[1]);
    }

    return matches;
  }

  /**
   * Remove retrieval context
   */
  async _removeRetrievalContext(retrievalContext) {
    if (!retrievalContext) {
      return { removed: false, saved: 0 };
    }

    const saved =
      typeof retrievalContext === 'string'
        ? retrievalContext.length
        : JSON.stringify(retrievalContext).length;

    return { removed: true, saved };
  }

  /**
   * Compress task context
   */
  async _compressTaskContext(taskContext) {
    if (typeof taskContext !== 'object') {
      return taskContext;
    }

    // Keep essential fields, compress or remove optional ones
    const compressed = {
      id: taskContext.id,
      title: taskContext.title,
      type: taskContext.type,
      priority: taskContext.priority,
      // Compress description
      description: this._truncateText(taskContext.description, 500),
      // Keep first few acceptance criteria
      acceptanceCriteria: (taskContext.acceptanceCriteria || []).slice(0, 3),
      // Summarize dependencies
      dependsOn: taskContext.dependsOn || [],
    };

    const saved = JSON.stringify(taskContext).length - JSON.stringify(compressed).length;
    return { compressed, saved: Math.max(0, saved) };
  }

  /**
   * Truncate text with ellipsis
   */
  _truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength)}...`;
  }

  /**
   * Generate subtask hints for splitting
   */
  _generateSubtaskHints(_task) {
    // Analyze task and suggest how to split
    return {
      reason: 'Task exceeds context limits',
      suggestions: [
        'Split implementation into smaller modules',
        'Process files in batches',
        'Focus on core functionality first',
        'Add comprehensive comments for continuation',
      ],
    };
  }

  /**
   * Get compression statistics
   */
  getStats() {
    return {
      totalCompressions: this.compressionHistory.length,
      averageSavings:
        this.compressionHistory.length > 0
          ? this.compressionHistory.reduce((sum, r) => sum + r.savingsRatio, 0) /
            this.compressionHistory.length
          : 0,
      contextLimit: this.contextLimit,
      effectiveLimit: this.effectiveLimit,
      history: this.compressionHistory.slice(-10), // Last 10 compressions
    };
  }

  /**
   * Reset compression history
   */
  reset() {
    this.compressionHistory = [];
  }
}

/**
 * Quick budget check
 */
export function checkBudget(content, limit = 128000) {
  const manager = new TokenBudgetManager({ contextLimit: limit });
  const tokens = manager.estimateTokens(content);
  return {
    tokens,
    fits: tokens <= manager.effectiveLimit,
    limit: manager.effectiveLimit,
    percentage: `${((tokens / manager.effectiveLimit) * 100).toFixed(1)}%`,
  };
}
