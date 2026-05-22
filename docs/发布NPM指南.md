# DevFlow NPM 发布与安装指南

## 目录

1. [准备工作](#1-准备工作)
2. [发布到 NPM](#2-发布到-npm)
3. [发布后验证](#3-发布后验证)
4. [安装与使用](#4-安装与使用)
5. [版本管理](#5-版本管理)
6. [常见问题](#6-常见问题)

---

## 1. 准备工作

### 1.1 创建 NPM 账号

1. 访问 [NPM 官网](https://www.npmjs.com/)
2. 点击 "Sign Up" 创建账号
3. 完成邮箱验证

### 1.2 登录本地 NPM

```bash
# 打开终端，在项目目录下执行
npm login

# 按照提示输入：
# - Username: 你的 NPM 用户名
# - Password: 你的密码
# - Email: 你的邮箱

# 登录成功后会显示：
# Logged in as <username> on https://registry.npmjs.org/
```

### 1.3 检查 package.json

确保 `package.json` 配置正确：

```json
{
  "name": "@devflow-ai/core",
  "version": "1.0.0",
  "description": "AI-powered development workflow orchestration tool",
  "main": "src/index.js",
  "bin": {
    "devflow": "bin/devflow.js"
  },
  "type": "module",
  "keywords": [
    "ai",
    "workflow",
    "automation",
    "development",
    "devops"
  ],
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/devflow-core.git"
  },
  "bugs": {
    "url": "https://github.com/your-org/devflow-core/issues"
  },
  "homepage": "https://github.com/your-org/devflow-core#readme"
}
```

### 1.4 安装依赖

```bash
# 安装项目依赖
npm install

# 安装开发依赖（如果需要）
npm install --save-dev @types/node
```

### 1.5 测试项目

```bash
# 运行测试
npm test

# 如果测试通过，继续下一步
```

---

## 2. 发布到 NPM

### 2.1 方式一：正式发布（推荐用于稳定版本）

#### 步骤 1：更新版本号

```bash
# 查看当前版本
npm version

# 或手动更新 package.json 中的 version 字段
# 例如从 1.0.0 更新到 1.0.1
```

**版本号规则（语义化版本）：**
- **补丁版本** (1.0.0 → 1.0.1): 修复 Bug，不影响 API
- **次版本** (1.0.1 → 1.1.0): 新增功能，向后兼容
- **主版本** (1.1.0 → 2.0.0): 重大变更，不向后兼容

**使用 npm 升级版本：**

```bash
# 升级补丁版本
npm version patch
# 例如: 1.0.0 → 1.0.1

# 升级次版本
npm version minor
# 例如: 1.0.1 → 1.1.0

# 升级主版本
npm version major
# 例如: 1.1.0 → 2.0.0
```

#### 步骤 2：构建项目（如需要）

```bash
# 如果有构建脚本，执行构建
npm run build

# 或其他构建命令
npm run build:esm
npm run build:cjs
```

#### 步骤 3：发布到 NPM

```bash
# 正式发布到 NPM
npm publish

# 如果发布 scoped 包（@devflow-ai/core），需要添加 --access public
npm publish --access public
```

**成功输出示例：**

```
npm notice
npm notice 📦  @devflow-ai/core@1.0.0
npm notice === Tarball Details ===
npm notice name:          @devflow-ai/core
npm notice version:       1.0.0
npm notice description:    AI-powered development workflow orchestration tool
npm notice ...
npm notice
+ @devflow-ai/core@1.0.0
```

### 2.2 方式二：发布测试版（Beta）

用于测试新功能，不影响正式版本：

```bash
# 发布为测试版
npm publish --tag beta

# 或者指定预发布版本号
npm version prerelease --preid beta
npm publish

# 安装测试版
npm install @devflow-ai/core@beta
```

### 2.3 方式三：发布 Alpha 版

```bash
# 发布为 Alpha 版
npm publish --tag alpha

# 指定预发布版本
npm version prerelease --preid alpha
npm publish

# 安装 Alpha 版
npm install @devflow-ai/core@alpha
```

### 2.4 发布私有包（仅供团队内部）

```bash
# 在 package.json 中设置
# "publishConfig": {
#   "registry": "https://npm.pkg.github.com/"
# }

# 发布到 GitHub Packages
npm publish
```

---

## 3. 发布后验证

### 3.1 在 NPM 网站验证

1. 访问 `https://www.npmjs.com/package/@devflow-ai/core`
2. 确认版本号和发布时间

### 3.2 通过命令行验证

```bash
# 查看包信息
npm view @devflow-ai/core

# 输出示例：
{
  name: '@devflow-ai/core',
  description: 'AI-powered development workflow orchestration tool',
  'dist-tags': { latest: '1.0.0', beta: '1.1.0-beta.0' },
  versions: [ '1.0.0', '1.0.1', '1.1.0' ],
  maintainers: [ { name: 'yourname', email: 'your@email.com' } ],
  ...
}
```

### 3.3 验证下载

```bash
# 在一个新的目录中测试
mkdir test-devflow
cd test-devflow

# 尝试安装
npm install @devflow-ai/core

# 验证安装成功
devflow --version
```

---

## 4. 安装与使用

### 4.1 全局安装（推荐）

全局安装后，可以在任何项目中使用 `devflow` 命令。

#### macOS / Linux

```bash
# 安装
sudo npm install -g @devflow-ai/core

# 验证安装
devflow --version
```

#### Windows

```powershell
# 管理员权限打开 PowerShell

# 安装
npm install -g @devflow-ai/core

# 验证安装
devflow --version
```

#### Linux (使用 sudo)

```bash
# 创建全局目录（如果不存在）
mkdir -p ~/.npm-global

# 配置 npm 使用此目录
npm config set prefix '~/.npm-global'

# 添加到 PATH
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# 安装
npm install -g @devflow-ai/core

# 验证
devflow --version
```

### 4.2 项目级安装

项目级安装将 DevFlow 添加为开发依赖。

```bash
# 进入项目目录
cd my-project

# 安装为开发依赖
npm install -D @devflow-ai/core

# 或使用 yarn
yarn add -D @devflow-ai/core
```

**使用 npx 运行：**

```bash
# 使用 npx 运行（无需全局安装）
npx devflow init

# 使用本地安装的版本
./node_modules/.bin/devflow init
```

### 4.3 验证安装

```bash
# 查看版本
devflow --version

# 查看帮助
devflow --help

# 测试初始化
devflow init
```

### 4.4 更新 DevFlow

```bash
# 检查更新
npm outdated @devflow-ai/core

# 更新到最新版本
npm update -g @devflow-ai/core

# 或安装指定版本
npm install -g @devflow-ai/core@latest
npm install -g @devflow-ai/core@1.1.0
```

### 4.5 卸载 DevFlow

```bash
# 卸载全局版本
npm uninstall -g @devflow-ai/core

# 卸载项目版本
npm uninstall @devflow-ai/core
```

---

## 5. 版本管理

### 5.1 发布新版本

```bash
# 1. 修改代码

# 2. 更新版本号
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0

# 3. 发布
npm publish
```

### 5.2 撤销发布

**注意**：NPM 不允许撤销已发布的正式版本，只能：

1. 发布补丁版本修复
2. 取消发布（仅限发布后 72 小时内，且未有人下载）

```bash
# 取消发布（需谨慎）
npm unpublish @devflow-ai/core@1.0.0

# 72小时内可以，之后只能弃用
npm deprecate @devflow-ai/core@1.0.0 "This version has critical bugs, please use 1.0.1"
```

### 5.3 标签管理

```bash
# 查看所有标签
npm tag list @devflow-ai/core

# 添加标签
npm dist-tag add @devflow-ai/core@1.0.1 latest
npm dist-tag add @devflow-ai/core@2.0.0-beta.1 beta

# 移除标签
npm dist-tag rm @devflow-ai/core beta
```

---

## 6. 常见问题

### Q1: 登录失败 - "Unable to authenticate"

```
Error: Unable to authenticate, your authentication token is invalid.
```

**解决方案：**

```bash
# 重新登录
npm logout
npm login

# 或使用 Token 登录
npm login --auth-type=legacy
```

### Q2: 发布失败 - "You do not have permission to publish"

```
npm ERR! 403 Forbidden - You do not have permission to publish the package "@devflow-ai/core"
```

**可能原因：**

1. 包名已被占用
2. 没有发布该命名空间的权限

**解决方案：**

```bash
# 检查包是否已存在
npm view @devflow-ai/core

# 如果包名被占用，修改 package.json 中的 name
# 例如改为 @your-org/devflow-core
```

### Q3: 发布失败 - "This package has not been updated recently"

```
npm ERR! 403 Forbidden - You cannot publish over the existing published versions
```

**原因：** 尝试发布已存在的版本号

**解决方案：**

```bash
# 先更新版本号
npm version patch
npm publish
```

### Q4: Scoped 包需要 public 访问

```
npm ERR! 402 Payment Required - You must grant public access for scoped packages
```

**解决方案：**

```bash
# 发布时添加 --access public
npm publish --access public
```

### Q5: 使用淘宝镜像

如果在中国大陆，可能需要配置镜像：

```bash
# 设置淘宝镜像
npm config set registry https://registry.npmmirror.com

# 安装包
npm install @devflow-ai/core

# 发布到 NPM（需要切换回官方源）
npm config set registry https://registry.npmjs.org
npm publish
```

### Q6: Node 版本不兼容

```
npm ERR! notsup Unsupported platform for node@20.0.0
```

**检查 Node 版本：**

```bash
node --version

# 要求 >= 18.0.0
```

**解决方案：**

```bash
# 使用 nvm 切换 Node 版本
nvm install 20
nvm use 20

# 或使用 fnm
fnm install 20
fnm use 20
```

---

## 附录：完整发布流程清单

```bash
# 1. 准备工作
npm login

# 2. 检查配置
cat package.json | grep -E '"name"|"version"|"description"|"main"|"bin"'

# 3. 确保测试通过
npm test

# 4. 更新版本号
npm version patch  # 或 minor 或 major

# 5. 发布
npm publish --access public

# 6. 验证发布
npm view @devflow-ai/core

# 7. 创建 Git Tag（可选）
git tag v1.0.0
git push origin v1.0.0

# 8. 在另一个目录测试安装
cd /tmp
npm install @devflow-ai/core
devflow --version
```

---

**文档版本**: 1.0.0
**最后更新**: 2026-05-22
