/**
 * Cline Tool Adapter
 * Adapter for Cline (VS Code extension)
 */

import { BaseToolAdapter, ToolCapability } from './base.js';

/**
 * Cline Tool Adapter
 * Cline has limited subagent support, uses detailed prompts
 */
export class ClineAdapter extends BaseToolAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'cline';
    this.displayName = 'Cline';
    this.contextLimit = 128000;
    this.capabilities = [
      ToolCapability.MULTI_FILE,
      ToolCapability.TERMINAL,
      ToolCapability.BROWSER,
    ];
  }

  /**
   * Check if Cline is available
   * @returns {boolean} True if available
   */
  isAvailable() {
    return true;
  }

  /**
   * Build prompt for Cline
   * Cline requires detailed, step-by-step instructions
   * @param {Object} task - Task object
   * @param {Object} context - Task context
   * @returns {string} Generated prompt
   */
  buildPrompt(task, context = {}) {
    const lines = [];

    lines.push('# Task Assignment');
    lines.push('');
    lines.push(this.formatTaskCard(task));
    lines.push('');

    if (context && Object.keys(context).length > 0) {
      lines.push('# Context');
      lines.push('');
      lines.push(this.formatContext(context));
      lines.push('');
    }

    // Cline needs explicit step-by-step instructions
    lines.push('# Implementation Steps');
    lines.push('');
    lines.push('Please follow these steps to complete the task:');
    lines.push('');

    const steps = this._generateSteps(task);
    for (let i = 0; i < steps.length; i++) {
      lines.push(`${i + 1}. ${steps[i]}`);
    }
    lines.push('');

    // Add verification steps
    lines.push('# Verification');
    lines.push('');
    lines.push('After implementation, please:');
    lines.push('1. Run any existing tests to ensure no regressions');
    lines.push('2. Verify all acceptance criteria are met');
    lines.push('3. Check for any linting or type errors');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Build subagent command for Cline
   * Cline doesn't have native subagent, returns pseudo-code instructions
   * @param {Object} task - Task object
   * @param {Object} options - Options
   * @returns {string} Pseudo-code instructions
   */
  buildSubagentCommand(task, _options = {}) {
    // Cline doesn't support native subagent
    // Return detailed pseudo-code instead
    const lines = [
      `# Subtask: ${task.title || task.name}`,
      '',
      '```pseudo',
      `TASK ${task.id}:`,
      `  INPUT: ${task.context?.files?.join(', ') || 'none'}`,
      `  OUTPUT: ${task.output?.files?.join(', ') || 'tbd'}`,
      `  STEPS:`,
    ];

    const steps = this._generateSteps(task);
    for (const step of steps) {
      lines.push(`    - ${step}`);
    }

    lines.push('```');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate implementation steps for a task
   * @param {Object} task - Task object
   * @returns {Array} Implementation steps
   */
  _generateSteps(task) {
    const steps = [];

    // Default steps based on task type
    switch (task.type) {
      case 'api-endpoint':
        steps.push('Create the route handler file');
        steps.push('Define request/response types');
        steps.push('Implement the endpoint logic');
        steps.push('Add input validation');
        steps.push('Write unit tests');
        break;

      case 'ui-component':
        steps.push('Create the component file');
        steps.push('Define component props/types');
        steps.push('Implement the component logic');
        steps.push('Add styles');
        steps.push('Write component tests');
        break;

      case 'service':
        steps.push('Create the service file');
        steps.push('Define the service interface');
        steps.push('Implement service methods');
        steps.push('Add error handling');
        steps.push('Write service tests');
        break;

      case 'bugfix':
        steps.push('Identify the root cause of the bug');
        steps.push('Implement the fix');
        steps.push('Add regression tests');
        steps.push('Verify the fix works');
        break;

      default:
        steps.push('Analyze the requirements');
        steps.push('Design the solution');
        steps.push('Implement the solution');
        steps.push('Test the implementation');
        steps.push('Review and refine');
    }

    // Add custom steps from task
    if (task.steps) {
      return task.steps;
    }

    return steps;
  }
}

export default ClineAdapter;
