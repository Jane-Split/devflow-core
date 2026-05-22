/**
 * Skill Registry - Skill 注册中心
 * 
 * 管理所有 DevFlow Skills，支持动态注册和解析
 * 兼容 Trae、Cursor、Windsurf 等 AI 工具的 /command 系统
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', '..', 'skills');

/**
 * Skill 定义接口
 * @typedef {Object} SkillDefinition
 * @property {string} id - Skill 唯一标识
 * @property {string} name - Skill 显示名称
 * @property {string} command - 触发命令（如 /devflow-init）
 * @property {string} description - Skill 描述
 * @property {string[]} patterns - 匹配模式（正则表达式）
 * @property {SkillParameter[]} parameters - 参数定义
 * @property {string} handler - 处理函数路径
 */

/**
 * Skill 参数定义
 * @typedef {Object} SkillParameter
 * @property {string} name - 参数名
 * @property {string} type - 参数类型（string, number, boolean, enum）
 * @property {string} description - 参数描述
 * @property {boolean} required - 是否必填
 * @property {*} default - 默认值
 * @property {string[]} [enum] - 枚举值（当 type 为 enum 时）
 */

class SkillRegistry {
  constructor() {
    /** @type {Map<string, SkillDefinition>} */
    this.skills = new Map();
    /** @type {Map<string, string>} */
    this.commandMap = new Map(); // command -> skillId
    this.initialized = false;
  }

  /**
   * 初始化注册中心，加载所有 Skill
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const skillFiles = await this._discoverSkillFiles();
      
      for (const file of skillFiles) {
        const skill = await this._parseSkillFile(file);
        if (skill) {
          this.register(skill);
        }
      }

      this.initialized = true;
      console.log(`✅ Skill Registry 初始化完成，加载了 ${this.skills.size} 个 Skills`);
    } catch (error) {
      console.error('❌ Skill Registry 初始化失败:', error.message);
      throw error;
    }
  }

  /**
   * 发现所有 Skill 文件
   * @returns {Promise<string[]>}
   */
  async _discoverSkillFiles() {
    try {
      const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
      const skillFiles = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.skill.md')) {
          skillFiles.push(join(SKILLS_DIR, entry.name));
        }
      }

      return skillFiles;
    } catch (error) {
      console.warn('⚠️ 未找到 Skills 目录:', SKILLS_DIR);
      return [];
    }
  }

  /**
   * 解析 Skill 文件
   * @param {string} filePath
   * @returns {Promise<SkillDefinition|null>}
   */
  async _parseSkillFile(filePath) {
    try {
      const content = await readFile(filePath, 'utf-8');
      return this._parseSkillMarkdown(content, filePath);
    } catch (error) {
      console.error(`❌ 解析 Skill 文件失败 ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * 解析 Skill Markdown 内容
   * @param {string} content
   * @param {string} filePath
   * @returns {SkillDefinition|null}
   */
  _parseSkillMarkdown(content, filePath) {
    const skill = {
      id: '',
      name: '',
      command: '',
      description: '',
      patterns: [],
      parameters: [],
      handler: '',
      examples: [],
      sourceFile: filePath
    };

    // 解析 YAML Frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const yaml = frontmatterMatch[1];
      
      // 解析基本字段
      const idMatch = yaml.match(/id:\s*(.+)/);
      const nameMatch = yaml.match(/name:\s*(.+)/);
      const commandMatch = yaml.match(/command:\s*(.+)/);
      const descMatch = yaml.match(/description:\s*(.+)/);
      const handlerMatch = yaml.match(/handler:\s*(.+)/);

      if (idMatch) skill.id = idMatch[1].trim();
      if (nameMatch) skill.name = nameMatch[1].trim();
      if (commandMatch) skill.command = commandMatch[1].trim();
      if (descMatch) skill.description = descMatch[1].trim();
      if (handlerMatch) skill.handler = handlerMatch[1].trim();

      // 解析 patterns
      const patternsMatch = yaml.match(/patterns:\s*\n((?:\s+-\s*.+\n?)+)/);
      if (patternsMatch) {
        skill.patterns = patternsMatch[1]
          .split('\n')
          .map(line => line.match(/-\s*(.+)/)?.[1])
          .filter(Boolean);
      }
    }

    // 解析参数表格
    const paramSection = content.match(/## 参数\s*\n\n([\s\S]*?)(?=\n##|$)/);
    if (paramSection) {
      const tableContent = paramSection[1];
      const rows = tableContent.split('\n').filter(line => line.startsWith('|') && !line.includes('---'));
      
      for (const row of rows.slice(1)) { // 跳过表头
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 4) {
          const [name, type, required, description] = cells;
          const param = {
            name: name.replace(/`/g, ''),
            type: type.toLowerCase(),
            required: required === '是',
            description,
            default: this._parseDefaultValue(cells[4])
          };
          
          // 解析枚举值
          if (param.type === 'enum' && cells[5]) {
            param.enum = cells[5].split(',').map(s => s.trim());
          }
          
          skill.parameters.push(param);
        }
      }
    }

    // 解析示例
    const exampleSection = content.match(/## 示例\s*\n\n([\s\S]*?)(?=\n##|$)/);
    if (exampleSection) {
      const examples = exampleSection[1].match(/### .+?\n```[\s\S]*?```/g);
      if (examples) {
        skill.examples = examples.map(ex => {
          const titleMatch = ex.match(/### (.+)/);
          const codeMatch = ex.match(/```\n?([\s\S]*?)```/);
          return {
            title: titleMatch?.[1] || '',
            code: codeMatch?.[1]?.trim() || ''
          };
        });
      }
    }

    // 验证必需字段
    if (!skill.id || !skill.command) {
      console.warn(`⚠️ Skill 文件缺少必需字段: ${filePath}`);
      return null;
    }

    return skill;
  }

  /**
   * 解析默认值
   * @param {string} value
   * @returns {*}
   */
  _parseDefaultValue(value) {
    if (!value) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(Number(value))) return Number(value);
    return value;
  }

  /**
   * 注册 Skill
   * @param {SkillDefinition} skill
   */
  register(skill) {
    this.skills.set(skill.id, skill);
    this.commandMap.set(skill.command, skill.id);
    
    // 同时注册别名（去掉斜杠）
    const alias = skill.command.replace(/^\//, '');
    if (alias !== skill.command) {
      this.commandMap.set(alias, skill.id);
    }
  }

  /**
   * 获取 Skill
   * @param {string} skillId
   * @returns {SkillDefinition|undefined}
   */
  get(skillId) {
    return this.skills.get(skillId);
  }

  /**
   * 通过命令获取 Skill
   * @param {string} command
   * @returns {SkillDefinition|undefined}
   */
  getByCommand(command) {
    const skillId = this.commandMap.get(command);
    return skillId ? this.skills.get(skillId) : undefined;
  }

  /**
   * 获取所有 Skills
   * @returns {SkillDefinition[]}
   */
  getAll() {
    return Array.from(this.skills.values());
  }

  /**
   * 匹配用户输入的命令
   * @param {string} input
   * @returns {SkillMatchResult|null}
   */
  match(input) {
    // 1. 精确匹配命令
    const trimmed = input.trim();
    
    // 提取命令和参数
    const commandMatch = trimmed.match(/^(\/[\w-]+)(?:\s+(.*))?$/);
    if (commandMatch) {
      const [, command, argsStr] = commandMatch;
      const skill = this.getByCommand(command);
      
      if (skill) {
        const args = this._parseArguments(argsStr || '', skill);
        return {
          skill,
          command,
          arguments: args,
          confidence: 1.0
        };
      }
    }

    // 2. 模式匹配
    for (const skill of this.skills.values()) {
      for (const pattern of skill.patterns) {
        try {
          const regex = new RegExp(pattern, 'i');
          const match = trimmed.match(regex);
          if (match) {
            const args = this._extractArgsFromMatch(match, skill);
            return {
              skill,
              command: skill.command,
              arguments: args,
              confidence: 0.8,
              matchedPattern: pattern
            };
          }
        } catch (e) {
          // 忽略无效正则
        }
      }
    }

    return null;
  }

  /**
   * 解析参数
   * @param {string} argsStr
   * @param {SkillDefinition} skill
   * @returns {Object}
   */
  _parseArguments(argsStr, skill) {
    const args = {};
    
    // 解析 --key value 或 --key=value 格式
    const paramRegex = /--([\w-]+)(?:\s+|=)([^\s-][^\s]*|"[^"]*"|'[^']*')/g;
    let match;
    
    while ((match = paramRegex.exec(argsStr)) !== null) {
      const [, key, value] = match;
      args[key] = this._convertType(value.replace(/^["']|["']$/g, ''), skill.parameters.find(p => p.name === key)?.type);
    }

    // 解析位置参数
    const positional = argsStr.replace(paramRegex, '').trim().split(/\s+/).filter(Boolean);
    const positionalParams = skill.parameters.filter(p => !p.name.startsWith('--'));
    
    positional.forEach((value, index) => {
      if (positionalParams[index]) {
        args[positionalParams[index].name] = this._convertType(value, positionalParams[index].type);
      }
    });

    // 应用默认值
    for (const param of skill.parameters) {
      if (!(param.name in args) && param.default !== undefined) {
        args[param.name] = param.default;
      }
    }

    return args;
  }

  /**
   * 从正则匹配中提取参数
   * @param {RegExpMatchArray} match
   * @param {SkillDefinition} skill
   * @returns {Object}
   */
  _extractArgsFromMatch(match, skill) {
    const args = {};
    
    // 使用命名捕获组
    if (match.groups) {
      Object.entries(match.groups).forEach(([key, value]) => {
        if (value !== undefined) {
          args[key] = this._convertType(value, skill.parameters.find(p => p.name === key)?.type);
        }
      });
    }

    // 应用默认值
    for (const param of skill.parameters) {
      if (!(param.name in args) && param.default !== undefined) {
        args[param.name] = param.default;
      }
    }

    return args;
  }

  /**
   * 类型转换
   * @param {string} value
   * @param {string} type
   * @returns {*}
   */
  _convertType(value, type) {
    if (!type || type === 'string') return value;
    if (type === 'number') return Number(value);
    if (type === 'boolean') return value === 'true' || value === true;
    return value;
  }

  /**
   * 验证参数
   * @param {SkillDefinition} skill
   * @param {Object} args
   * @returns {ValidationResult}
   */
  validate(skill, args) {
    const errors = [];
    const warnings = [];

    for (const param of skill.parameters) {
      const value = args[param.name];

      // 检查必填
      if (param.required && (value === undefined || value === null || value === '')) {
        errors.push(`缺少必需参数: ${param.name} (${param.description})`);
        continue;
      }

      if (value === undefined) continue;

      // 类型检查
      if (param.type === 'number' && isNaN(Number(value))) {
        errors.push(`参数 ${param.name} 必须是数字`);
      }

      if (param.type === 'boolean' && !['true', 'false', true, false].includes(value)) {
        errors.push(`参数 ${param.name} 必须是布尔值 (true/false)`);
      }

      // 枚举检查
      if (param.type === 'enum' && param.enum && !param.enum.includes(value)) {
        errors.push(`参数 ${param.name} 必须是以下之一: ${param.enum.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 生成命令帮助文本
   * @param {string} skillId
   * @returns {string}
   */
  getHelp(skillId) {
    const skill = this.get(skillId);
    if (!skill) return `未找到 Skill: ${skillId}`;

    let help = `## ${skill.name}\n\n`;
    help += `${skill.description}\n\n`;
    help += `**用法:** \`${skill.command}`;
    
    for (const param of skill.parameters) {
      if (param.required) {
        help += ` --${param.name} <${param.type}>`;
      } else {
        help += ` [--${param.name} <${param.type}>]`;
      }
    }
    help += `\`\n\n`;

    if (skill.parameters.length > 0) {
      help += `**参数:**\n\n`;
      for (const param of skill.parameters) {
        const required = param.required ? ' (必需)' : '';
        const defaultVal = param.default !== undefined ? ` 默认值: ${param.default}` : '';
        help += `- \`${param.name}\`: ${param.description}${required}${defaultVal}\n`;
      }
      help += '\n';
    }

    if (skill.examples.length > 0) {
      help += `**示例:**\n\n`;
      for (const example of skill.examples) {
        help += `${example.title}:\n\`\`\`\n${example.code}\n\`\`\`\n\n`;
      }
    }

    return help;
  }

  /**
   * 生成所有 Skills 的索引
   * @returns {string}
   */
  generateIndex() {
    let index = '# DevFlow Skills 索引\n\n';
    index += '可用的 /command 命令列表:\n\n';

    for (const skill of this.skills.values()) {
      index += `## ${skill.command}\n\n`;
      index += `- **名称:** ${skill.name}\n`;
      index += `- **描述:** ${skill.description}\n`;
      index += `- **文件:** ${skill.sourceFile}\n\n`;
    }

    return index;
  }
}

/**
 * Skill 匹配结果
 * @typedef {Object} SkillMatchResult
 * @property {SkillDefinition} skill
 * @property {string} command
 * @property {Object} arguments
 * @property {number} confidence
 * @property {string} [matchedPattern]
 */

/**
 * 验证结果
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {string[]} warnings
 */

// 导出单例
export const skillRegistry = new SkillRegistry();
export default SkillRegistry;
