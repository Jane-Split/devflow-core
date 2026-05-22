/**
 * Base Tool Adapter
 * Abstract base class for AI tool adapters
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('BaseToolAdapter');

/**
 * Tool capabilities
 */
export const ToolCapability = {
  SUBAGENT: 'subagent',           // Supports native subagent
  MULTI_FILE: 'multiFile',        // Can edit multiple files
  CONTEXT_WINDOW: 'contextWindow', // Has large context window
  BROWSER: 'browser',             // Has browser automation
  TERMINAL: 'terminal',           // Has terminal access
  MCP: 'mcp',                     // Supports MCP protocol
};

/**
 * Base Tool Adapter
 */
export class BaseToolAdapter {
  /**
   * @param {Object} config - Adapter configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.name = 'base';
    this.displayName = 'Base Tool';
    this.contextLimit = 128000;
    this.capabilities = [];
  }

  /**
   * Check if tool is available
   * @returns {boolean} True if available
   */
  isAvailable() {
    return false;
  }

  /**
   * Build prompt for a task
   * @param {Object} task - Task object
   * @param {Object} context - Task context
   * @returns {string} Generated prompt
   */
  buildPrompt(task, context = {}) {
    throw new Error('buildPrompt must be implemented by subclass');
  }

  /**
   * Build subagent command for parallel execution
   * @param {Object} task - Task object
   * @param {Object} options - Options
   * @returns {string|null} Subagent command or null if not supported
   */
  buildSubagentCommand(task, options = {}) {
    if (!this.hasCapability(ToolCapability.SUBAGENT)) {
      return null;
    }
    throw new Error('buildSubagentCommand must be implemented by subclass');
  }

  /**
   * Check if tool has a capability
   * @param {string} capability - Capability to check
   * @returns {boolean} True if has capability
   */
  hasCapability(capability) {
    return this.capabilities.includes(capability);
  }

  /**
   * Get tool info
   * @returns {Object} Tool information
   */
  getInfo() {
    return {
      name: this.name,
      displayName: this.displayName,
      contextLimit: this.contextLimit,
      capabilities: this.capabilities,
    };
  }

  /**
   * Format task card for prompt
   * @param {Object} task - Task object
   * @returns {string} Formatted task card
   */
  formatTaskCard(task) {
    const lines = [
      `## Task: ${task.title || task.name}`,
      '',
      `**ID**: ${task.id}`,
      `**Type**: ${task.type || 'implementation'}`,
      `**Priority**: ${task.priority || 'medium'}`,
      '',
      '### Description',
      task.description || 'No description provided',
      '',
    ];

    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      lines.push('### Acceptance Criteria');
      for (const criteria of task.acceptanceCriteria) {
        lines.push(`- [ ] ${criteria}`);
      }
      lines.push('');
    }

    if (task.context?.files && task.context.files.length > 0) {
      lines.push('### Relevant Files');
      for (const file of task.context.files) {
        lines.push(`- \`${file}\``);
      }
      lines.push('');
    }

    if (task.output?.files && task.output.files.length > 0) {
      lines.push('### Output Files');
      for (const file of task.output.files) {
        lines.push(`- \`${file}\``);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format context for prompt
   * @param {Object} context - Context object
   * @returns {string} Formatted context
   */
  formatContext(context) {
    const lines = ['## Context', ''];

    if (context.projectProfile) {
      lines.push('### Project Profile');
      lines.push('```json');
      lines.push(JSON.stringify(context.projectProfile, null, 2));
      lines.push('```');
      lines.push('');
    }

    if (context.designDoc) {
      lines.push('### Design Document');
      lines.push('```markdown');
      lines.push(typeof context.designDoc === 'string'
        ? context.designDoc
        : JSON.stringify(context.designDoc, null, 2));
      lines.push('```');
      lines.push('');
    }

    if (context.codeFiles && context.codeFiles.length > 0) {
      lines.push('### Relevant Code');
      for (const file of context.codeFiles) {
        lines.push(`#### ${file.path}`);
        if (file.content) {
          lines.push('```');
          lines.push(file.content);
          lines.push('```');
        } else if (file.summary) {
          lines.push(`> ${file.summary}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Estimate tokens for content
   * @param {string} content - Content to estimate
   * @returns {number} Estimated tokens
   */
  estimateTokens(content) {
    if (!content) return 0;
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    // ~4 chars per token for English, ~2 for Chinese
    const englishChars = str.replace(/[\u4e00-\u9fff]/g, '').length;
    const chineseChars = (str.match(/[\u4e00-\u9fff]/g) || []).length;
    return Math.ceil(englishChars / 4 + chineseChars / 2);
  }
}

export default BaseToolAdapter;
