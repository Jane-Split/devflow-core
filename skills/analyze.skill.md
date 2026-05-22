# /devflow-analyze Skill

## 描述
分析项目结构、技术栈和代码规范，生成项目画像。

## 触发方式
- `/devflow-analyze`
- `/devflow analyze`
- `/analyze`

## 使用场景
1. 初始化后了解项目结构
2. 技术栈变更后重新分析
3. 提取代码规范用于后续开发

## 执行步骤

### Step 1: 检测项目类型
```javascript
// 分析项目文件结构
const detectors = {
  frontend: ['package.json', 'src/', 'public/'],
  backend: ['package.json', 'server.js', 'app.js', 'src/'],
  fullstack: ['package.json', 'client/', 'server/', 'src/'],
  microservice: ['docker-compose.yml', 'services/', 'k8s/'],
};

// 检测框架
const frameworks = {
  react: ['react', 'react-dom'],
  vue: ['vue', 'vue-router'],
  angular: ['@angular/core'],
  next: ['next'],
  express: ['express'],
  nest: ['@nestjs/core'],
};
```

### Step 2: 分析技术栈

#### 前端技术栈
```javascript
const frontendStack = {
  framework: detectFramework(packageJson),
  uiLibrary: detectUILibrary(packageJson),
  styling: detectStyling(packageJson),
  stateManagement: detectStateManagement(packageJson),
  routing: detectRouting(packageJson),
  buildTool: detectBuildTool(packageJson),
};
```

#### 后端技术栈
```javascript
const backendStack = {
  framework: detectBackendFramework(packageJson),
  orm: detectORM(packageJson),
  database: detectDatabase(packageJson),
  apiStyle: detectAPIStyle(files),
};
```

### Step 3: 提取代码规范

#### 命名规范
```javascript
const namingConventions = {
  files: detectFileNaming(files),      // kebab-case, camelCase, PascalCase
  variables: detectVariableNaming(files),
  functions: detectFunctionNaming(files),
  classes: detectClassNaming(files),
};
```

#### 代码风格
```javascript
const codeStyle = {
  indentation: detectIndentation(files),    // space-2, space-4, tab
  quotes: detectQuotes(files),              // single, double
  semicolons: detectSemicolons(files),      // true, false
  trailingComma: detectTrailingComma(files),
};
```

### Step 4: 生成项目画像

```json
{
  "project": {
    "name": "my-project",
    "type": "fullstack",
    "typeConfidence": 0.95
  },
  "frontend": {
    "framework": "React",
    "uiLibrary": "Ant Design",
    "styling": "CSS Modules",
    "stateManagement": "Zustand"
  },
  "backend": {
    "framework": "Express",
    "orm": "Prisma",
    "database": "PostgreSQL"
  },
  "conventions": {
    "naming": {
      "files": "kebab-case",
      "components": "PascalCase",
      "functions": "camelCase"
    },
    "style": {
      "indentation": "space-2",
      "quotes": "single",
      "semicolons": true
    }
  }
}
```

### Step 5: 输出结果
```
📊 项目分析完成

项目类型: Fullstack (置信度: 95%)

前端技术栈:
  ⚛️  Framework: React 18.2.0
  🎨  UI Library: Ant Design 5.x
  💅  Styling: CSS Modules
  🔄  State: Zustand

后端技术栈:
  🚀  Framework: Express 4.18.0
  📦  ORM: Prisma 5.x
  🗄️  Database: PostgreSQL

代码规范:
  📁 文件命名: kebab-case
  📦 组件命名: PascalCase
  🔧 函数命名: camelCase
  📏 缩进: 2 spaces
  💬 引号: single

已保存到: .ai-memory/profiles/project-profile.md
```

## 参数

| 参数 | 说明 | 默认值 |
|:---|:---|:---|
| `--scope` | 分析范围 (frontend/backend/all) | all |
| `--refresh` | 强制刷新 | false |
| `--output` | 输出文件路径 | - |

## 示例

### 基本分析
```
/devflow-analyze
```

### 只分析前端
```
/devflow-analyze --scope frontend
```

### 强制刷新
```
/devflow-analyze --refresh
```

### 输出到文件
```
/devflow-analyze --output ./analysis.md
```

## 相关 Skill

- `/devflow-init` - 初始化项目
- `/devflow-run` - 运行工作流
- `/devflow-research` - 深度研究项目
