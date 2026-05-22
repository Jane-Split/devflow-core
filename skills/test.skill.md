# /devflow-test Skill

## 描述
运行测试套件，包括单元测试、集成测试和 E2E 测试。

## 触发方式
- `/devflow-test`
- `/devflow test`
- `/test`

## 使用场景
1. 开发完成后验证功能
2. 持续集成/持续部署
3. 生成覆盖率报告

## 执行步骤

### Step 1: 检测测试框架
```javascript
const testFrameworks = {
  jest: {
    config: 'jest.config.js',
    command: 'jest',
  },
  vitest: {
    config: 'vitest.config.ts',
    command: 'vitest',
  },
  mocha: {
    config: '.mocharc.js',
    command: 'mocha',
  },
};

const detected = detectTestFramework();
```

### Step 2: 运行单元测试
```
🧪 运行单元测试
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

测试框架: Jest
测试文件: 12
测试用例: 156

进度:
  [████████████████████] 100%

结果:
  ✅ Passed: 156
  ❌ Failed: 0
  ⏭️  Skipped: 2

耗时: 8.5s
```

### Step 3: 运行集成测试
```
🔗 运行集成测试
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

测试文件: 5
测试用例: 24

结果:
  ✅ Passed: 24
  ❌ Failed: 0

耗时: 15.2s
```

### Step 4: 运行 E2E 测试（可选）
```
🎭 运行 E2E 测试
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

浏览器: Chromium
测试文件: 3
测试用例: 8

场景:
  ✅ 用户登录流程
  ✅ 注册新用户
  ✅ 密码找回
  ✅ 个人资料编辑

结果:
  ✅ Passed: 8
  ❌ Failed: 0

耗时: 32.1s
```

### Step 5: 生成覆盖率报告
```
📊 覆盖率报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

文件覆盖率:
  Statements: 87.5% ████████████████████░
  Branches:   82.3% ████████████████░░░░░
  Functions:  91.2% ███████████████████░░
  Lines:      88.9% ███████████████████░░

未覆盖文件:
  ⚠️ src/utils/logger.ts (45%)
  ⚠️ src/middleware/error.ts (62%)

已保存: coverage/lcov-report/index.html
```

### Step 6: 输出总结
```
📋 测试总结
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

总测试数: 188
通过: 188
失败: 0
跳过: 2

通过率: 100%
覆盖率: 87.5%

状态: ✅ 全部通过
```

## 参数

| 参数 | 说明 | 默认值 |
|:---|:---|:---|
| `--unit` | 运行单元测试 | true |
| `--integration` | 运行集成测试 | true |
| `--e2e` | 运行 E2E 测试 | false |
| `--coverage` | 生成覆盖率报告 | false |
| `--headed` | E2E 可视化模式 | false |
| `--browser` | E2E 浏览器 | chromium |
| `--watch` | 监听模式 | false |

## 示例

### 运行所有测试
```
/devflow-test
```

### 只运行单元测试
```
/devflow-test --integration false --e2e false
```

### 运行 E2E 测试（可视化）
```
/devflow-test --e2e --headed
```

### 生成覆盖率报告
```
/devflow-test --coverage
```

### 监听模式
```
/devflow-test --watch
```

### 指定浏览器
```
/devflow-test --e2e --browser firefox
```

## 失败处理

当测试失败时：

```
❌ 测试失败

失败用例:
  1. auth.test.ts > 登录 > 应该验证密码
     Error: expect(received).toBe(expected)
     Expected: true
     Received: false

     at src/__tests__/auth.test.ts:45:23

  2. login.component.test.tsx > 渲染 > 应该显示错误信息
     Error: Unable to find element with text: /错误/

修复选项:
  [F] 自动修复 - 尝试自动修复问题
  [M] 手动修复 - 显示详细错误信息
  [S] 跳过 - 跳过失败的测试
  [R] 重试 - 重新运行测试

您的选择: [f/m/s/r]:
```

## 相关 Skill

- `/devflow-run` - 运行完整工作流
- `/devflow-fix` - 修复测试失败
- `/devflow-status` - 查看测试状态
