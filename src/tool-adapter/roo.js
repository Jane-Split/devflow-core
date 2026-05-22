/**
 * Roo Code Tool Adapter
 * Adapter for Roo Code (VS Code extension, Cline fork)
 */

import { ClineAdapter } from './cline.js';
import { ToolCapability } from './base.js';

/**
 * Roo Code Tool Adapter
 * Roo Code is a fork of Cline with additional features
 */
export class RooAdapter extends ClineAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'roo';
    this.displayName = 'Roo Code';
    this.contextLimit = 128000;
    this.capabilities = [
      ToolCapability.MULTI_FILE,
      ToolCapability.TERMINAL,
      ToolCapability.BROWSER,
      ToolCapability.MCP, // Roo has MCP support
    ];
  }

  /**
   * Check if Roo Code is available
   * @returns {boolean} True if available
   */
  isAvailable() {
    return true;
  }

  /**
   * Build prompt for Roo Code
   * Roo supports modes for different task types
   * @param {Object} task - Task object
   * @param {Object} context - Task context
   * @returns {string} Generated prompt
   */
  buildPrompt(task, context = {}) {
    const lines = [];

    // Add mode selection hint
    const mode = this._suggestMode(task);
    lines.push(`> Suggested Mode: **${mode}**`);
    lines.push('');

    lines.push(this.formatTaskCard(task));
    lines.push('');

    if (context && Object.keys(context).length > 0) {
      lines.push(this.formatContext(context));
      lines.push('');
    }

    // Roo-specific instructions
    lines.push('## Implementation Guide');
    lines.push('');
    lines.push('1. Switch to the suggested mode if appropriate');
    lines.push('2. Follow the implementation steps below');
    lines.push('3. Use available MCP tools for enhanced capabilities');
    lines.push('');

    const steps = this._generateSteps(task);
    for (let i = 0; i < steps.length; i++) {
      lines.push(`${i + 1}. ${steps[i]}`);
    }
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Build subagent command for Roo
   * @param {Object} task - Task object
   * @param {Object} options - Options
   * @returns {string} Subagent instructions
   */
  buildSubagentCommand(task, _options = {}) {
    const mode = this._suggestMode(task);

    const lines = [
      `# Roo Task: ${task.title || task.name}`,
      '',
      `**Mode**: ${mode}`,
      `**Task ID**: ${task.id}`,
      '',
      '```yaml',
      `task:`,
      `  id: ${task.id}`,
      `  mode: ${mode}`,
      `  description: |`,
      `    ${task.description || 'No description'}`,
    ];

    if (task.output?.files) {
      lines.push(`  output_files:`);
      for (const file of task.output.files) {
        lines.push(`    - ${file}`);
      }
    }

    lines.push('```');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Suggest Roo mode based on task type
   * @param {Object} task - Task object
   * @returns {string} Suggested mode
   */
  _suggestMode(task) {
    const modeMap = {
      'api-endpoint': 'architect',
      'ui-component': 'code',
      service: 'code',
      bugfix: 'debug',
      test: 'code',
      refactor: 'code',
      design: 'architect',
      analysis: 'ask',
    };

    return modeMap[task.type] || 'code';
  }
}

export default RooAdapter;
