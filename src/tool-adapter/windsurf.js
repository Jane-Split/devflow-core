/**
 * Windsurf Tool Adapter
 * Adapter for Windsurf IDE (Codeium)
 */

import { BaseToolAdapter, ToolCapability } from './base.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('WindsurfAdapter');

/**
 * Windsurf Tool Adapter
 * Windsurf supports Cascade flow and subagent
 */
export class WindsurfAdapter extends BaseToolAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'windsurf';
    this.displayName = 'Windsurf';
    this.contextLimit = 200000;
    this.capabilities = [
      ToolCapability.SUBAGENT,
      ToolCapability.MULTI_FILE,
      ToolCapability.CONTEXT_WINDOW,
      ToolCapability.TERMINAL,
    ];
  }

  /**
   * Check if Windsurf is available
   * @returns {boolean} True if available
   */
  isAvailable() {
    return true;
  }

  /**
   * Build prompt for Windsurf
   * @param {Object} task - Task object
   * @param {Object} context - Task context
   * @returns {string} Generated prompt
   */
  buildPrompt(task, context = {}) {
    const lines = [];

    // Windsurf prefers clear, actionable prompts
    lines.push(this.formatTaskCard(task));
    lines.push('');

    if (context && Object.keys(context).length > 0) {
      lines.push(this.formatContext(context));
      lines.push('');
    }

    // Add instructions
    lines.push('## Implementation Steps');
    lines.push('');
    lines.push('1. Analyze the task requirements and context');
    lines.push('2. Implement the solution following project patterns');
    lines.push('3. Verify all acceptance criteria are met');
    lines.push('4. Test the implementation');
    lines.push('');

    if (task.output?.files) {
      lines.push('## Files to Create/Modify');
      lines.push('');
      for (const file of task.output.files) {
        lines.push(`- \`${file}\``);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build subagent command for Windsurf
   * @param {Object} task - Task object
   * @param {Object} options - Options
   * @returns {string} Subagent command
   */
  buildSubagentCommand(task, options = {}) {
    const {
      agentType = 'general_purpose_task',
      description = task.title || task.name,
    } = options;

    // Windsurf uses @cascade for flow-based execution
    return `@cascade run "${description}"`;
  }

  /**
   * Build cascade flow prompt
   * @param {Object} workflow - Workflow definition
   * @returns {string} Cascade prompt
   */
  buildCascadePrompt(workflow) {
    const lines = [
      '# Cascade Flow',
      '',
      'Execute the following workflow:',
      '',
    ];

    for (const step of workflow.steps || []) {
      lines.push(`## Step: ${step.name}`);
      lines.push(step.description || '');
      lines.push('');
    }

    return lines.join('\n');
  }
}

export default WindsurfAdapter;
