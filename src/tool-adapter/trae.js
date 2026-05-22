/**
 * Trae Tool Adapter
 * Adapter for Trae IDE (ByteDance)
 */

import { BaseToolAdapter, ToolCapability } from './base.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('TraeAdapter');

/**
 * Trae Tool Adapter
 * Trae supports native subagent similar to Cursor
 */
export class TraeAdapter extends BaseToolAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'trae';
    this.displayName = 'Trae';
    this.contextLimit = 200000;
    this.capabilities = [
      ToolCapability.SUBAGENT,
      ToolCapability.MULTI_FILE,
      ToolCapability.CONTEXT_WINDOW,
      ToolCapability.TERMINAL,
    ];
  }

  /**
   * Check if Trae is available
   * @returns {boolean} True if available
   */
  isAvailable() {
    return true;
  }

  /**
   * Build prompt for Trae
   * @param {Object} task - Task object
   * @param {Object} context - Task context
   * @returns {string} Generated prompt
   */
  buildPrompt(task, context = {}) {
    const lines = [];

    // Trae prefers structured prompts with clear sections
    lines.push('# 任务说明');
    lines.push('');
    lines.push(this.formatTaskCard(task));
    lines.push('');

    if (context && Object.keys(context).length > 0) {
      lines.push('# 上下文信息');
      lines.push('');
      lines.push(this.formatContext(context));
      lines.push('');
    }

    // Add instructions
    lines.push('# 实现要求');
    lines.push('');
    lines.push('1. 按照任务描述和验收标准实现功能');
    lines.push('2. 遵循项目现有的代码规范和模式');
    lines.push('3. 确保所有验收标准都已满足');
    lines.push('4. 编写清晰、可维护的代码');
    lines.push('');

    if (task.output?.files) {
      lines.push('# 输出文件');
      lines.push('');
      for (const file of task.output.files) {
        lines.push(`- \`${file}\``);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build subagent command for Trae
   * @param {Object} task - Task object
   * @param {Object} options - Options
   * @returns {string} Subagent command
   */
  buildSubagentCommand(task, options = {}) {
    const {
      agentType = 'general_purpose_task',
      description = task.title || task.name,
    } = options;

    // Trae subagent format (similar to Cursor)
    return `#subagent ${agentType} "${description}"`;
  }

  /**
   * Build parallel prompt
   * @param {Array} tasks - Tasks
   * @returns {string} Parallel prompt
   */
  buildParallelPrompt(tasks) {
    const lines = [
      '# 并行任务执行',
      '',
      '请使用子代理并行执行以下任务:',
      '',
    ];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      lines.push(`## 任务 ${i + 1}: ${task.title || task.name}`);
      lines.push(`**命令**: ${this.buildSubagentCommand(task)}`);
      lines.push(`**描述**: ${task.description || '无描述'}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}

export default TraeAdapter;
