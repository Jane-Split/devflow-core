# DevFlow Core

AI 驱动的开发工作流编排工具 - 自动化研究、设计、开发、测试和部署流程。

## 核心特性

- **完整开发生命周期**: 覆盖项目研究 → 需求分析 → 详细设计 → 任务拆分 → 多智能体并行开发 → 自检 → 测试 → Bug修复 → 回归测试
- **自动项目分析**: 无需手动文档，自动提取代码规范、组件和模式
- **多项目类型支持**: 纯前端、后端、全栈和微服务项目
- **长期记忆**: 混合记忆系统，结合文件存储和向量搜索
- **学习能力**: 从执行历史中记录成功的模式和踩过的坑
- **多工具兼容**: 支持 Cursor、Trae、Windsurf、Cline、Roo Code、Copilot

## 安装

### 全局安装

```bash
npm install -g @devflow-ai/core
```

### 项目级安装

```bash
npm install -D @devflow-ai/core
```

## 快速开始

### 1. 在项目中初始化 DevFlow

```bash
devflow init
```

这将创建：
- `.ai-memory/` - 记忆存储目录
- `devflow.config.js` - 配置文件
- `AGENTS.md` - 项目规则模板

### 2. 分析项目结构

```bash
devflow analyze
```

### 3. 研究并生成项目画像

```bash
devflow research
```

### 4. 运行完整的开发工作流

```bash
devflow run --requirement ./requirements.md
```

## 配置

编辑 `devflow.config.js`:

```javascript
export default {
  project: {
    name: 'my-project',
    type: 'auto', // auto | frontend | backend | fullstack | microservice
  },
  aiTool: {
    type: 'auto', // auto | cursor | trae | windsurf | cline | copilot
    contextLimit: 128000,
  },
  memory: {
    embeddingModel: 'auto', // auto | keyword | local | openai
    similarityThreshold: 0.7,
  },
  workflow: {
    phases: ['research', 'analyze', 'design', 'split', 'dev', 'test', 'fix', 'regression'],
    autoApprove: false,
    parallelTasks: 3,
  },
  testing: {
    unitTestFramework: 'auto',
    e2eFramework: 'playwright',
    coverageThreshold: 80,
  },
};
```

## CLI 命令

| 命令 | 描述 |
|:---|:---|
| `devflow init` | 在项目中初始化 DevFlow |
| `devflow analyze` | 分析项目结构 |
| `devflow research` | 研究并刷新项目画像 |
| `devflow research --refresh` | 强制刷新项目研究 |
| `devflow memory <action>` | 记忆管理 (读/写/搜索/导出) |
| `devflow run` | 运行完整的开发工作流 |
| `devflow run --phase <phase>` | 从指定阶段开始 |
| `devflow test` | 运行测试 |
| `devflow test --e2e` | 使用浏览器自动化运行 E2E 测试 |
| `devflow test --coverage` | 生成覆盖率报告 |
| `devflow status` | 查看项目状态 |

## Skill 系统（/command 命令）

DevFlow 支持在 Trae、Cursor 等 AI 工具中通过 `/command` 命令快速唤醒工作流。

### 支持的命令

| 命令 | 描述 | 示例 |
|:---|:---|:---|
| `/devflow-init` | 初始化项目 | `/devflow-init --name my-app --type frontend` |
| `/devflow-analyze` | 分析项目结构 | `/devflow-analyze --deep` |
| `/devflow-run` | 执行开发工作流 | `/devflow-run --requirement ./feature.md` |
| `/devflow-test` | 运行测试 | `/devflow-test --type e2e` |

### 在 Trae 中使用

1. 安装 DevFlow: `npm install -D @devflow-ai/core`
2. 复制配置: `cp node_modules/@devflow-ai/core/.trae/skills.json ~/.trae/skills/devflow.json`
3. 重启 Trae
4. 在 AI 对话中输入: `/devflow-init`

### 在 Cursor 中使用

1. 安装 DevFlow: `npm install -D @devflow-ai/core`
2. 复制配置: `cp node_modules/@devflow-ai/core/.cursor/skills.json ~/.cursor/skills/devflow.json`
3. 重启 Cursor
4. 在 Composer 中输入: `/devflow-run --phase design`

## 架构

### 核心模块

- **ConfigManager**: 三级配置 (默认值 < 全局配置 < 项目配置)
- **ToolDetector**: 自动检测 AI 编码工具 (Cursor/Trae/Windsurf/Cline)
- **MemoryManager**: 统一记忆接口，结合文件和向量存储
- **EmbeddingProvider**: 三级嵌入 (关键词 → 本地 ONNX → OpenAI)
- **ProjectAnalyzer**: 自动分析项目类型、框架、代码规范

### 记忆系统

- **FileMemoryProvider**: 基于 Markdown 的存储，带 YAML frontmatter
- **VectorIndex**: 内存向量存储，带余弦相似度搜索
- **分类**: project-profile、requirements、design、tasks、execution、learning

## 许可证

MIT
