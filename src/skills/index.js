/**
 * Skills 模块入口
 * 
 * 导出 Skill 系统的所有公共 API
 * 用于 Trae、Cursor 等 AI 工具的 /command 集成
 */

export { SkillRegistry, skillRegistry } from './skill-registry.js';
export { SkillExecutor, skillExecutor } from './skill-executor.js';

/**
 * 快速执行 Skill 的辅助函数
 * 
 * @example
 * // 在 AI 工具中使用
 * import { runSkill } from '@devflow-ai/core/skills';
 * 
 * // 执行初始化
 * const result = await runSkill('/devflow-init', { name: 'my-project' }, '/path/to/project');
 * 
 * @param {string} command - Skill 命令（如 /devflow-init）
 * @param {Object} args - 命令参数
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<ExecutionResult>}
 */
export async function runSkill(command, args = {}, projectRoot = process.cwd()) {
  const { skillExecutor } = await import('./skill-executor.js');
  const { skillRegistry } = await import('./skill-registry.js');
  
  // 初始化注册表
  await skillRegistry.initialize();
  
  // 获取 skill
  const skill = skillRegistry.getByCommand(command);
  if (!skill) {
    throw new Error(`未知的 Skill 命令: ${command}`);
  }
  
  // 创建上下文并执行
  const context = await skillExecutor.createContext(projectRoot);
  return skillExecutor.execute(skill.id, args, context);
}

/**
 * 列出所有可用的 Skills
 * 
 * @example
 * import { listSkills } from '@devflow-ai/core/skills';
 * const skills = await listSkills();
 * 
 * @returns {Promise<Array<{command: string, name: string, description: string}>>}
 */
export async function listSkills() {
  const { skillRegistry } = await import('./skill-registry.js');
  await skillRegistry.initialize();
  
  return skillRegistry.getAll().map(skill => ({
    id: skill.id,
    command: skill.command,
    name: skill.name,
    description: skill.description,
    parameters: skill.parameters
  }));
}

/**
 * 获取 Skill 帮助信息
 * 
 * @example
 * import { getSkillHelp } from '@devflow-ai/core/skills';
 * const help = await getSkillHelp('init');
 * 
 * @param {string} skillId - Skill ID 或命令
 * @returns {Promise<string>}
 */
export async function getSkillHelp(skillId) {
  const { skillRegistry } = await import('./skill-registry.js');
  await skillRegistry.initialize();
  
  // 尝试通过命令获取
  let skill = skillRegistry.getByCommand(skillId);
  if (!skill) {
    // 尝试通过 ID 获取
    skill = skillRegistry.get(skillId);
  }
  
  if (!skill) {
    throw new Error(`未找到 Skill: ${skillId}`);
  }
  
  return skillRegistry.getHelp(skill.id);
}

/**
 * 检查输入是否匹配某个 Skill
 * 
 * @example
 * import { matchSkill } from '@devflow-ai/core/skills';
 * const match = await matchSkill('/devflow-init my-project');
 * if (match) {
 *   console.log(`匹配到: ${match.skill.name}`);
 * }
 * 
 * @param {string} input - 用户输入
 * @returns {Promise<SkillMatchResult|null>}
 */
export async function matchSkill(input) {
  const { skillRegistry } = await import('./skill-registry.js');
  await skillRegistry.initialize();
  
  return skillRegistry.match(input);
}
