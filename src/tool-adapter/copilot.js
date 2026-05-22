/**
 * Copilot Tool Adapter
 * Adapter for GitHub Copilot
 */

import { BaseToolAdapter, ToolCapability } from './base.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('CopilotAdapter');

/**
 * GitHub Copilot Tool Adapter
 * Copilot has limited context, prefers concise prompts
 */
export class CopilotAdapter extends BaseToolAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'copilot';
    this.displayName = 'GitHub Copilot';
    this.contextLimit = 8000; // Copilot has smaller context
    this.capabilities = [
      ToolCapability.MULTI_FILE,
    ];
  }

  /**
   * Check if Copilot is available
   * @returns {boolean} True if available
   */
  isAvailable() {
    return true;
  }

  /**
   * Build prompt for Copilot
   * Copilot needs very concise prompts due to context limits
   * @param {Object} task - Task object
   * @param {Object} context - Task context
   * @returns {string} Generated prompt
   */
  buildPrompt(task, context = {}) {
    const lines = [];

    // Copilot prompt must be very concise
    lines.push(`// Task: ${task.title || task.name}`);
    lines.push(`// Type: ${task.type || 'implementation'}`);
    lines.push('');

    // Brief description
    if (task.description) {
      // Truncate description for Copilot's limited context
      const briefDesc = task.description.slice(0, 500);
      lines.push(`// Description: ${briefDesc}`);
      lines.push('');
    }

    // Key requirements only
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      lines.push('// Requirements:');
      for (const criteria of task.acceptanceCriteria.slice(0, 3)) {
        lines.push(`// - ${criteria}`);
      }
      lines.push('');
    }

    // Output files
    if (task.output?.files && task.output.files.length > 0) {
      lines.push(`// Output: ${task.output.files.join(', ')}`);
      lines.push('');
    }

    // Add signature hint if available
    if (task.interfaceSpec) {
      lines.push('// Interface:');
      lines.push(this._formatInterface(task.interfaceSpec));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build subagent command for Copilot
   * Copilot doesn't support subagent
   * @param {Object} task - Task object
   * @param {Object} options - Options
   * @returns {null} Always null
   */
  buildSubagentCommand(task, options = {}) {
    // Copilot doesn't support subagent
    return null;
  }

  /**
   * Format interface specification
   * @param {Object} spec - Interface specification
   * @returns {string} Formatted interface
   */
  _formatInterface(spec) {
    const lines = [];

    if (spec.methods) {
      for (const method of spec.methods) {
        lines.push(`// ${method.name}(${method.params?.join(', ') || ''}): ${method.returnType || 'void'}`);
      }
    }

    if (spec.endpoints) {
      for (const endpoint of spec.endpoints) {
        lines.push(`// ${endpoint.method} ${endpoint.path}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Build inline comment prompt for Copilot
   * @param {Object} task - Task object
   * @returns {string} Inline prompt
   */
  buildInlinePrompt(task) {
    // For Copilot, we return a comment that can be placed in code
    return `// TODO: Implement ${task.title || task.name}\n// ${task.description?.slice(0, 100) || ''}`;
  }
}

export default CopilotAdapter;
