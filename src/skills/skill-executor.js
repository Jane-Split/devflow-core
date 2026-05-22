/**
 * Skill Executor - Skill 执行器
 *
 * 执行解析后的 Skill 命令，调用对应的 CLI 功能
 * 支持同步和异步执行，提供执行上下文管理
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { skillRegistry } from './skill-registry.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { ConfigManager } from '../core/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, '..', '..', 'bin', 'devflow.js');

/**
 * 执行上下文
 * @typedef {Object} ExecutionContext
 * @property {string} projectRoot - 项目根目录
 * @property {string} sessionId - 会话 ID
 * @property {MemoryManager} memory - 内存管理器实例
 * @property {ConfigManager} config - 配置管理器实例
 * @property {Object} variables - 执行变量
 * @property {string[]} history - 执行历史
 */

/**
 * 执行结果
 * @typedef {Object} ExecutionResult
 * @property {boolean} success - 是否成功
 * @property {string} output - 输出内容
 * @property {string} error - 错误信息
 * @property {number} exitCode - 退出码
 * @property {number} duration - 执行时长（毫秒）
 * @property {Object} metadata - 元数据
 */

class SkillExecutor {
  constructor() {
    this.contexts = new Map(); // sessionId -> ExecutionContext
    this.activeExecutions = new Map(); // sessionId -> Promise
  }

  /**
   * 创建执行上下文
   * @param {string} projectRoot
   * @param {Object} options
   * @returns {Promise<ExecutionContext>}
   */
  async createContext(projectRoot, options = {}) {
    const sessionId = this._generateSessionId();

    // 初始化配置
    const config = new ConfigManager(projectRoot);
    await config.load();

    // 初始化内存管理器
    const memory = new MemoryManager({
      projectRoot,
      embeddingLevel: config.get('memory.embeddingLevel', 1),
    });
    await memory.initialize();

    const context = {
      projectRoot,
      sessionId,
      memory,
      config,
      variables: options.variables || {},
      history: [],
      createdAt: new Date(),
    };

    this.contexts.set(sessionId, context);

    // 记录会话开始
    await memory.store('session', {
      id: sessionId,
      type: 'skill_execution',
      projectRoot,
      startedAt: context.createdAt,
      status: 'active',
    });

    return context;
  }

  /**
   * 执行 Skill
   * @param {string} skillId
   * @param {Object} args
   * @param {ExecutionContext} context
   * @returns {Promise<ExecutionResult>}
   */
  async execute(skillId, args, context) {
    const skill = skillRegistry.get(skillId);
    if (!skill) {
      return {
        success: false,
        output: '',
        error: `未找到 Skill: ${skillId}`,
        exitCode: 1,
        duration: 0,
        metadata: { skillId },
      };
    }

    // 验证参数
    const validation = skillRegistry.validate(skill, args);
    if (!validation.valid) {
      return {
        success: false,
        output: '',
        error: `参数验证失败:\n${validation.errors.join('\n')}`,
        exitCode: 1,
        duration: 0,
        metadata: { skillId, validation },
      };
    }

    const startTime = Date.now();

    try {
      // 记录执行开始
      context.history.push({
        skill: skillId,
        command: skill.command,
        args,
        startedAt: new Date(),
      });

      // 根据 skill 类型选择执行方式
      let result;

      if (skill.handler && skill.handler.startsWith('cli:')) {
        // CLI 命令执行
        result = await this._executeCLI(skill, args, context);
      } else if (skill.handler && skill.handler.startsWith('api:')) {
        // API 调用执行
        result = await this._executeAPI(skill, args, context);
      } else if (skill.handler && skill.handler.startsWith('internal:')) {
        // 内部函数执行
        result = await this._executeInternal(skill, args, context);
      } else {
        // 默认使用 CLI 执行
        result = await this._executeCLI(skill, args, context);
      }

      // 记录执行结果到内存
      await context.memory.store('execution', {
        sessionId: context.sessionId,
        skill: skillId,
        command: skill.command,
        args,
        result: {
          success: result.success,
          exitCode: result.exitCode,
          duration: result.duration,
        },
        completedAt: new Date(),
      });

      // 更新历史记录
      const historyEntry = context.history[context.history.length - 1];
      historyEntry.completedAt = new Date();
      historyEntry.success = result.success;

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        output: '',
        error: error.message,
        exitCode: 1,
        duration,
        metadata: { skillId, error: error.stack },
      };
    }
  }

  /**
   * 执行 CLI 命令
   * @param {SkillDefinition} skill
   * @param {Object} args
   * @param {ExecutionContext} context
   * @returns {Promise<ExecutionResult>}
   */
  async _executeCLI(skill, args, context) {
    const startTime = Date.now();

    // 构建 CLI 命令
    const cliArgs = this._buildCLIArgs(skill, args);

    return new Promise(resolve => {
      const child = spawn('node', [CLI_PATH, ...cliArgs], {
        cwd: context.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          DEVFLOW_SESSION_ID: context.sessionId,
          DEVFLOW_SKILL_MODE: 'true',
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', exitCode => {
        const duration = Date.now() - startTime;

        resolve({
          success: exitCode === 0,
          output: stdout,
          error: stderr,
          exitCode: exitCode || 0,
          duration,
          metadata: {
            skill: skill.id,
            command: skill.command,
            cliArgs,
          },
        });
      });

      child.on('error', error => {
        const duration = Date.now() - startTime;

        resolve({
          success: false,
          output: stdout,
          error: error.message,
          exitCode: 1,
          duration,
          metadata: { skill: skill.id, error: error.stack },
        });
      });
    });
  }

  /**
   * 执行 API 调用
   * @param {SkillDefinition} skill
   * @param {Object} args
   * @param {ExecutionContext} context
   * @returns {Promise<ExecutionResult>}
   */
  async _executeAPI(skill, _args, _context) {
    // API 执行模式，用于未来扩展
    const startTime = Date.now();

    return {
      success: true,
      output: 'API 执行模式暂未实现',
      error: '',
      exitCode: 0,
      duration: Date.now() - startTime,
      metadata: { skill: skill.id, mode: 'api' },
    };
  }

  /**
   * 执行内部函数
   * @param {SkillDefinition} skill
   * @param {Object} args
   * @param {ExecutionContext} context
   * @returns {Promise<ExecutionResult>}
   */
  async _executeInternal(skill, args, context) {
    const startTime = Date.now();

    try {
      // 动态导入处理模块
      const handlerPath = skill.handler.replace('internal:', '');
      const handlerModule = await import(join(__dirname, handlerPath));
      const handler = handlerModule.default || handlerModule.execute;

      if (typeof handler !== 'function') {
        throw new Error(`Skill ${skill.id} 的处理函数无效`);
      }

      const result = await handler(args, context);
      const duration = Date.now() - startTime;

      return {
        success: true,
        output: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        error: '',
        exitCode: 0,
        duration,
        metadata: { skill: skill.id, mode: 'internal' },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        output: '',
        error: error.message,
        exitCode: 1,
        duration,
        metadata: { skill: skill.id, error: error.stack },
      };
    }
  }

  /**
   * 构建 CLI 参数
   * @param {SkillDefinition} skill
   * @param {Object} args
   * @returns {string[]}
   */
  _buildCLIArgs(skill, args) {
    const cliArgs = [];

    // 根据 skill 命令映射到对应的 CLI 命令
    const commandMap = {
      '/devflow-init': 'init',
      '/devflow-analyze': 'analyze',
      '/devflow-run': 'run',
      '/devflow-test': 'test',
    };

    const cliCommand = commandMap[skill.command];
    if (!cliCommand) {
      throw new Error(`未知的 Skill 命令: ${skill.command}`);
    }

    cliArgs.push(cliCommand);

    // 添加参数
    for (const [key, value] of Object.entries(args)) {
      if (value === true) {
        cliArgs.push(`--${key}`);
      } else if (value !== false && value !== undefined && value !== null) {
        cliArgs.push(`--${key}`, String(value));
      }
    }

    return cliArgs;
  }

  /**
   * 从用户输入直接执行
   * @param {string} input - 用户输入（如 "/devflow-init --name my-project"）
   * @param {string} projectRoot
   * @returns {Promise<ExecutionResult>}
   */
  async executeFromInput(input, projectRoot) {
    // 初始化注册表
    await skillRegistry.initialize();

    // 匹配命令
    const match = skillRegistry.match(input);
    if (!match) {
      return {
        success: false,
        output: '',
        error: `无法识别的命令: ${input}\n\n可用的命令:\n${this._getAvailableCommands()}`,
        exitCode: 1,
        duration: 0,
        metadata: { input },
      };
    }

    // 创建执行上下文
    const context = await this.createContext(projectRoot);

    // 执行
    return this.execute(match.skill.id, match.arguments, context);
  }

  /**
   * 获取可用命令列表
   * @returns {string}
   */
  _getAvailableCommands() {
    const skills = skillRegistry.getAll();
    return skills.map(s => `  ${s.command} - ${s.description}`).join('\n');
  }

  /**
   * 生成会话 ID
   * @returns {string}
   */
  _generateSessionId() {
    return `skill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取执行上下文
   * @param {string} sessionId
   * @returns {ExecutionContext|undefined}
   */
  getContext(sessionId) {
    return this.contexts.get(sessionId);
  }

  /**
   * 清理执行上下文
   * @param {string} sessionId
   */
  async cleanupContext(sessionId) {
    const context = this.contexts.get(sessionId);
    if (context) {
      // 更新会话状态
      await context.memory.store('session', {
        id: sessionId,
        status: 'completed',
        completedAt: new Date(),
        history: context.history,
      });

      this.contexts.delete(sessionId);
    }
  }

  /**
   * 获取执行统计
   * @param {string} sessionId
   * @returns {Object}
   */
  getStats(sessionId) {
    const context = this.contexts.get(sessionId);
    if (!context) {
      return null;
    }

    const executions = context.history;
    const successful = executions.filter(e => e.success).length;
    const failed = executions.filter(e => e.success === false).length;
    const totalDuration = executions.reduce((sum, e) => {
      if (e.completedAt && e.startedAt) {
        return sum + (e.completedAt - e.startedAt);
      }
      return sum;
    }, 0);

    return {
      sessionId,
      total: executions.length,
      successful,
      failed,
      totalDuration,
      createdAt: context.createdAt,
      uptime: Date.now() - context.createdAt.getTime(),
    };
  }
}

// 导出单例
export const skillExecutor = new SkillExecutor();
export default SkillExecutor;
