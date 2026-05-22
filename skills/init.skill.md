# /devflow-init Skill

## 描述
在项目中初始化 DevFlow，创建必要的配置文件和目录结构。

## 触发方式
- `/devflow-init`
- `/devflow init`
- `/init`

## 使用场景
1. 新项目中首次使用 DevFlow
2. 重新初始化 DevFlow 配置
3. 生成 AGENTS.md 项目规则文件

## 执行步骤

### Step 1: 检查当前目录
```javascript
// 检查是否在项目根目录
const fs = require('fs');
const path = require('path');

const hasPackageJson = fs.existsSync('package.json');
const hasGit = fs.existsSync('.git');

if (!hasPackageJson && !hasGit) {
  console.log('⚠️ 当前目录似乎不是项目根目录');
  console.log('建议在项目根目录（包含 package.json 或 .git 的目录）运行此命令');
}
```

### Step 2: 创建目录结构
```bash
mkdir -p .ai-memory/{profiles,requirements,designs,tasks,executions,learning}
```

### Step 3: 生成配置文件

#### devflow.config.js
```javascript
export default {
  project: {
    name: '{{PROJECT_NAME}}',
    type: 'auto',
  },
  aiTool: {
    type: 'auto',
    contextLimit: 128000,
  },
  memory: {
    directory: '.ai-memory',
    enableVectorIndex: true,
    embeddingModel: 'auto',
  },
  workflow: {
    phases: ['research', 'analyze', 'design', 'split', 'dev', 'test', 'fix', 'regression'],
    autoApprove: false,
  },
  testing: {
    unitTestFramework: 'auto',
    e2eTestFramework: 'playwright',
    coverageThreshold: 80,
  },
};
```

#### AGENTS.md
```markdown
# AGENTS.md

> 本项目使用 DevFlow 进行 AI 驱动开发

## 项目信息

- **项目名称**: {{PROJECT_NAME}}
- **项目类型**: {{PROJECT_TYPE}}
- **主要语言**: {{PRIMARY_LANGUAGE}}

## 开发规范

### 代码风格
- 缩进: 2 个空格
- 引号: 单引号
- 分号: 必需

### 提交规范
- 使用语义化提交信息
- 每个提交关联对应任务

## DevFlow 命令

- `/devflow-init` - 初始化项目
- `/devflow-analyze` - 分析项目
- `/devflow-run` - 运行工作流
- `/devflow-test` - 运行测试

---

*此文件由 DevFlow 自动生成*
```

### Step 4: 输出结果
```
✅ DevFlow 初始化完成！

已创建:
  📁 .ai-memory/           - 记忆存储目录
  📄 devflow.config.js     - 配置文件
  📄 AGENTS.md            - AI 代理规则

下一步:
  1. 运行 /devflow-analyze 分析项目
  2. 或运行 /devflow-run 开始完整工作流
```

## 参数

| 参数 | 说明 | 默认值 |
|:---|:---|:---|
| `--force` | 强制覆盖现有配置 | false |
| `--template` | 使用指定模板 | default |

## 示例

### 基本使用
```
/devflow-init
```

### 强制重新初始化
```
/devflow-init --force
```

### 使用特定模板
```
/devflow-init --template react
```

## 相关 Skill

- `/devflow-analyze` - 分析项目结构
- `/devflow-run` - 运行完整工作流
