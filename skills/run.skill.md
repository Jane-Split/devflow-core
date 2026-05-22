# /devflow-run Skill

## 描述
运行完整的 AI 驱动开发工作流，从研究到回归测试。

## 触发方式
- `/devflow-run`
- `/devflow run`
- `/run`

## 使用场景
1. 根据需求文档完整开发功能
2. 从指定阶段继续开发
3. 自动化整个开发流程

## 执行步骤

### Step 1: 读取需求
```
请输入需求描述或需求文档路径:
[用户输入]
```

### Step 2: 八阶段工作流

#### Phase 1: Research (研究)
```
🔍 Phase 1/8: Research
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 分析项目结构
✓ 检测技术栈
✓ 提取代码规范
✓ 生成项目画像
```

#### Phase 2: Analyze (分析)
```
📋 Phase 2/8: Analyze
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 解析需求文档
✓ 提取功能需求
✓ 识别非功能需求
✓ 生成需求分析报告
```

#### Phase 3: Design (设计)
```
🎨 Phase 3/8: Design
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 设计系统架构
✓ 定义模块接口
✓ 规划数据模型
✓ 生成设计文档
```

#### Phase 4: Split (拆分)
```
✂️ Phase 4/8: Split
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 拆分开发任务
✓ 分析任务依赖
✓ 评估任务复杂度
✓ 生成任务卡片

任务列表:
  1. [P0] 创建用户认证 API
  2. [P0] 实现登录页面
  3. [P1] 添加表单验证
  4. [P1] 实现记住密码功能
```

#### Phase 5: Dev (开发)
```
💻 Phase 5/8: Dev
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
并行执行任务 (3个并发):

Task 1/4: 创建用户认证 API
  ✓ 设计接口
  ✓ 实现控制器
  ✓ 添加验证
  ✓ 编写测试

Task 2/4: 实现登录页面
  ✓ 创建组件
  ✓ 添加样式
  ✓ 实现交互
  ✓ 响应式适配

...
```

#### Phase 6: Test (测试)
```
🧪 Phase 6/8: Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
运行测试套件:

单元测试:
  ✓ auth.controller.test.ts (12/12 passed)
  ✓ login.component.test.tsx (8/8 passed)
  ✓ validation.test.ts (15/15 passed)

集成测试:
  ✓ auth-flow.test.ts (5/5 passed)

E2E 测试:
  ✓ login.spec.ts (3/3 passed)

覆盖率: 87% (目标: 80%)
```

#### Phase 7: Fix (修复)
```
🔧 Phase 7/8: Fix
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
分析测试结果:
  ✓ 所有测试通过，无需修复

或:

发现 2 个问题:
  1. ❌ 登录失败时未显示错误信息
     → 已修复
  2. ❌ 密码验证规则不正确
     → 已修复

重新运行测试:
  ✓ 所有测试通过
```

#### Phase 8: Regression (回归)
```
🔄 Phase 8/8: Regression
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
回归测试:
  ✓ 单元测试: 40/40 passed
  ✓ 集成测试: 8/8 passed
  ✓ E2E 测试: 5/5 passed

无回归问题
```

### Step 3: 生成报告
```
📊 工作流完成报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

执行统计:
  总时长: 15m 32s
  任务数: 4
  代码文件: 12
  测试文件: 8

质量指标:
  测试覆盖率: 87%
  代码规范: ✅ 通过
  类型检查: ✅ 通过

生成文件:
  📄 src/api/auth.ts
  📄 src/components/Login.tsx
  📄 src/hooks/useAuth.ts
  📄 tests/auth.test.ts
  ...

下一步:
  - 运行 /devflow-test 再次测试
  - 运行 /devflow-status 查看状态
```

## 参数

| 参数 | 说明 | 默认值 |
|:---|:---|:---|
| `--requirement` | 需求文档路径 | - |
| `--phase` | 起始阶段 | research |
| `--end-phase` | 结束阶段 | regression |
| `--auto-approve` | 自动确认 | false |
| `--parallel` | 并行任务数 | 3 |

## 示例

### 基本使用（交互式）
```
/devflow-run
请输入需求: 实现用户登录功能，包含邮箱验证和密码找回
```

### 从需求文档开始
```
/devflow-run --requirement ./docs/login-feature.md
```

### 从设计阶段开始
```
/devflow-run --phase design --requirement ./docs/login-feature.md
```

### 只运行到测试阶段
```
/devflow-run --phase research --end-phase test
```

### 自动模式（无需确认）
```
/devflow-run --auto-approve --requirement ./docs/feature.md
```

### 调整并行度
```
/devflow-run --parallel 5 --requirement ./docs/feature.md
```

## 交互提示

在工作流执行过程中，会提示用户确认：

```
🤔 需要您确认:

设计文档已生成，是否继续执行开发阶段?
[Y] 是 - 继续执行
[N] 否 - 暂停工作流
[R] 查看 - 查看设计文档
[E] 编辑 - 修改设计文档

您的选择: [Y/n/r/e]:
```

## 相关 Skill

- `/devflow-init` - 初始化项目
- `/devflow-analyze` - 分析项目
- `/devflow-test` - 运行测试
- `/devflow-status` - 查看状态
