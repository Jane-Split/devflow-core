/**
 * Cursor Tool Adapter
 * Adapter for Cursor IDE
 */

import { BaseToolAdapter, ToolCapability } from './base.js';

/**
 * Cursor Tool Adapter
 * Cursor supports native subagent via @agent mentions
 */
export class CursorAdapter extends BaseToolAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'cursor';
    this.displayName = 'Cursor';
    this.contextLimit = 200000; // Cursor has large context
    this.capabilities = [
      ToolCapability.SUBAGENT,
      ToolCapability.MULTI_FILE,
      ToolCapability.CONTEXT_WINDOW,
      ToolCapability.TERMINAL,
    ];
  }

  /**
   * Check if Cursor is available
   * @returns {boolean} True if available
   */
  isAvailable() {
    // Check for Cursor-specific files/configs
    return true; // Assume available if detected
  }

  /**
   * Build prompt for Cursor
   * @param {Object} task - Task object
   * @param {Object} context - Task context
   * @returns {string} Generated prompt
   */
  buildPrompt(task, context = {}) {
    const lines = [];

    // Cursor prefers concise, structured prompts
    lines.push(this.formatTaskCard(task));
    lines.push('');

    if (context && Object.keys(context).length > 0) {
      lines.push(this.formatContext(context));
      lines.push('');
    }

    // Add instructions
    lines.push('## Instructions');
    lines.push('');
    lines.push('1. Implement the task according to the description and acceptance criteria.');
    lines.push('2. Follow the project conventions and patterns shown in the context.');
    lines.push('3. Ensure all acceptance criteria are met.');
    lines.push('4. Write clean, maintainable code with appropriate comments.');
    lines.push('');

    if (task.output?.files) {
      lines.push('## Expected Output');
      lines.push('');
      lines.push('Please implement the following files:');
      for (const file of task.output.files) {
        lines.push(`- \`${file}\``);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build subagent command for Cursor
   * Cursor uses @agent mentions for subagent tasks
   * @param {Object} task - Task object
   * @param {Object} options - Options
   * @returns {string} Subagent command
   */
  buildSubagentCommand(task, _options = {}) {
    const {
      agentType: _agentType = 'general_purpose_task',
      description = task.title || task.name,
    } = _options;

    // Cursor subagent format
    return `@agent ${_agentType} "${description}"`;
  }

  /**
   * Format prompt for parallel execution
   * @param {Array} tasks - Tasks to execute in parallel
   * @returns {string} Parallel execution prompt
   */
  buildParallelPrompt(tasks) {
    const lines = [
      '# Parallel Task Execution',
      '',
      'Please execute the following tasks in parallel using subagents:',
      '',
    ];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      lines.push(`## Task ${i + 1}: ${task.title || task.name}`);
      lines.push('');
      lines.push(`**Subagent Command**: ${this.buildSubagentCommand(task)}`);
      lines.push('');
      lines.push('**Description**:');
      lines.push(task.description || 'No description');
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push(
      'Execute each task using the subagent commands above. Report back when all tasks are complete.'
    );

    return lines.join('\n');
  }
}

export default CursorAdapter;
