/**
 * Init Command
 * Initializes DevFlow in a project
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Logger } from '../../utils/logger.js';
import { DevFlowError } from '../../utils/errors.js';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = new Logger('InitCommand');

/**
 * Execute init command
 * @param {Object} options - Command options
 */
export async function executeInit(options = {}) {
  const spinner = ora('Initializing DevFlow...').start();

  try {
    const projectRoot = resolve(options.projectRoot || process.cwd());
    logger.debug(`Initializing in: ${projectRoot}`);

    // Check if already initialized
    const aiMemoryPath = join(projectRoot, '.ai-memory');
    const exists = await fs.pathExists(aiMemoryPath);

    if (exists && !options.force) {
      spinner.stop();
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'DevFlow is already initialized. Overwrite?',
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.yellow('Initialization cancelled.'));
        return;
      }
      spinner.start('Re-initializing DevFlow...');
    }

    // Create directory structure
    await createDirectoryStructure(projectRoot, options.template);

    // Create config file
    await createConfigFile(projectRoot, options);

    // Create AGENTS.md template
    await createAgentsTemplate(projectRoot, options);

    spinner.succeed('DevFlow initialized successfully!');

    console.log(chalk.green('\n✓ Created .ai-memory/ directory structure'));
    console.log(chalk.green('✓ Created devflow.config.js'));
    console.log(chalk.green('✓ Created AGENTS.md template'));

    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.gray('  1. Edit AGENTS.md to add your project rules'));
    console.log(chalk.gray('  2. Run "devflow analyze" to analyze your project'));
    console.log(chalk.gray('  3. Run "devflow research" to generate project profile'));
    console.log(chalk.gray('  4. Run "devflow run" to start development workflow'));

  } catch (error) {
    spinner.fail('Initialization failed');
    logger.error('Init failed:', error);
    throw error;
  }
}

/**
 * Create directory structure
 * @param {string} projectRoot - Project root path
 * @param {string} template - Template name
 */
async function createDirectoryStructure(projectRoot, template = 'default') {
  const dirs = [
    '.ai-memory',
    '.ai-memory/project-profile',
    '.ai-memory/requirements',
    '.ai-memory/design',
    '.ai-memory/tasks',
    '.ai-memory/execution',
    '.ai-memory/learning',
    '.ai-memory/vector-index',
    'docs/specs',
    'docs/plans',
  ];

  for (const dir of dirs) {
    await fs.ensureDir(join(projectRoot, dir));
  }

  // Create .gitignore in .ai-memory
  const gitignoreContent = `# DevFlow AI Memory - Auto-generated files
# Do not edit manually

# Vector index (can be regenerated)
vector-index/

# Execution logs
execution/*.log

# Temporary files
tmp/
*.tmp
`;
  await fs.writeFile(join(projectRoot, '.ai-memory', '.gitignore'), gitignoreContent);
}

/**
 * Create config file
 * @param {string} projectRoot - Project root path
 * @param {Object} options - Options
 */
async function createConfigFile(projectRoot, options) {
  const configContent = `/**
 * DevFlow Configuration
 * @see https://github.com/devflow-ai/core#configuration
 */

export default {
  // Project identification
  project: {
    name: '${options.projectName || 'my-project'}',
    type: 'auto', // auto | frontend | backend | fullstack | microservice
    description: '',
  },

  // AI Tool Configuration
  aiTool: {
    // Auto-detected if not specified
    // type: 'cursor', // cursor | trae | windsurf | cline | copilot
    contextLimit: 128000, // Token budget for context
  },

  // Memory System
  memory: {
    embeddingModel: 'auto', // auto | keyword | local | openai
    openaiApiKey: process.env.OPENAI_API_KEY,
    similarityThreshold: 0.7,
    maxResults: 10,
  },

  // Workflow Configuration
  workflow: {
    phases: ['research', 'analyze', 'design', 'split', 'dev', 'test', 'fix', 'regression'],
    autoApprove: false, // Require confirmation before each phase
    parallelTasks: 3, // Max parallel subagent tasks
  },

  // Testing Configuration
  testing: {
    unitTestFramework: 'auto', // auto | jest | vitest | pytest | junit
    e2eFramework: 'playwright', // playwright | cypress | selenium
    coverageThreshold: 80,
    browser: 'chromium', // chromium | firefox | webkit
  },

  // Output Configuration
  output: {
    docsDir: './docs',
    specsDir: './docs/specs',
    plansDir: './docs/plans',
  },
};
`;

  await fs.writeFile(join(projectRoot, 'devflow.config.js'), configContent);
}

/**
 * Create AGENTS.md template
 * @param {string} projectRoot - Project root path
 * @param {Object} options - Options
 */
async function createAgentsTemplate(projectRoot, options) {
  const agentsContent = `# Project Rules for AI Agents

> This file contains project-specific rules and conventions.
> Edit this file to customize AI behavior for your project.

## Project Overview

- **Name**: ${options.projectName || 'My Project'}
- **Type**: [frontend/backend/fullstack/microservice]
- **Description**: 

## Technology Stack

### Frontend
- Framework: [React/Vue/Angular/etc]
- UI Library: [Ant Design/Material-UI/etc]
- State Management: [Redux/Zustand/Pinia/etc]
- Styling: [Tailwind/CSS Modules/Styled Components]

### Backend
- Language: [TypeScript/Java/Python/Go]
- Framework: [Express/NestJS/FastAPI/Spring]
- ORM: [Prisma/TypeORM/Sequelize]
- Database: [PostgreSQL/MySQL/MongoDB]

## Code Conventions

### Naming
- Components: PascalCase (e.g., \`UserProfile\`)
- Functions: camelCase (e.g., \`getUserData\`)
- Constants: UPPER_SNAKE_CASE (e.g., \`MAX_RETRY_COUNT\`)
- Files: kebab-case (e.g., \`user-profile.tsx\`)

### File Organization
- Components: \`src/components/{Category}/{ComponentName}\`
- Pages: \`src/pages/{PageName}\`
- Utils: \`src/utils/{util-name}.ts\`
- Hooks: \`src/hooks/{useHookName}.ts\`

### Code Style
- Use TypeScript strict mode
- Prefer functional components
- Use async/await over callbacks
- Add JSDoc for public APIs

## Testing Requirements

- Unit test coverage: > 80%
- E2E tests for critical user flows
- Test naming: \`{functionName}.should.{expectedBehavior}\`

## Architecture Decisions

- [Document key architectural decisions here]

## Known Issues / Pitfalls

- [Document known issues to avoid]
`;

  await fs.writeFile(join(projectRoot, 'AGENTS.md'), agentsContent);
}

// Create Commander command
export const initCommand = new Command('init')
  .description('Initialize DevFlow in the current project')
  .option('-p, --project-root <path>', 'Project root directory', process.cwd())
  .option('-n, --project-name <name>', 'Project name')
  .option('-t, --template <template>', 'Template to use', 'default')
  .option('-f, --force', 'Force overwrite existing configuration', false)
  .action(executeInit);
