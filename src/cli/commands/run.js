/**
 * Run Command
 * Runs the full development workflow
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import { WorkflowRunner } from '../../orchestrator/workflow-runner.js';
import { TestRunner } from '../../testing/test-runner.js';
import { handleCliError } from '../../utils/errors.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('RunCommand');

/**
 * Execute run command
 * @param {Object} options - Command options
 */
export async function executeRun(options = {}) {
  try {
    const projectRoot = resolve(options.projectRoot || process.cwd());

    logger.debug(`Running workflow in: ${projectRoot}`);

    // Initialize workflow runner
    const runner = new WorkflowRunner({
      projectRoot,
      config: {},
    });

    await runner.initialize();

    // Run full workflow
    const results = await runner.runFullWorkflow({
      requirementPath: options.requirement ? resolve(options.requirement) : null,
      startPhase: options.phase || 'research',
      endPhase: 'regression',
      autoApprove: options.autoApprove || false,
      verbose: options.verbose || false,
    });

    if (results.cancelled) {
      return;
    }

    // Exit with appropriate code
    if (results.success) {
      console.log(chalk.green('\n✓ Workflow completed successfully!'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n✗ Workflow completed with errors'));
      process.exit(1);
    }
  } catch (error) {
    handleCliError(error, process.env.DEVFLOW_DEBUG === 'true');
  }
}

/**
 * Execute test command
 * @param {Object} options - Command options
 */
export async function executeTest(options = {}) {
  try {
    const projectRoot = resolve(options.projectRoot || process.cwd());

    logger.debug(`Running tests in: ${projectRoot}`);

    const runner = new TestRunner({
      projectRoot,
    });

    let results;

    if (options.e2e) {
      console.log(chalk.blue('Running E2E tests...'));
      results = await runner.runE2ETests({
        browser: options.browser || 'chromium',
        headed: options.headed || false,
      });
    } else if (options.integration) {
      console.log(chalk.blue('Running integration tests...'));
      results = await runner.runIntegrationTests({
        coverage: options.coverage || false,
      });
    } else {
      console.log(chalk.blue('Running unit tests...'));
      results = await runner.runUnitTests({
        coverage: options.coverage || false,
        watch: options.watch || false,
      });
    }

    // Display results
    if (results.summary) {
      console.log(chalk.blue('\n📊 Test Results\n'));
      console.log(chalk.gray('Total:'), results.summary.totalTests);
      console.log(chalk.green('Passed:'), results.summary.passed);
      console.log(chalk.red('Failed:'), results.summary.failed);
      console.log(chalk.gray('Pass Rate:'), results.summary.passRate);

      if (results.coverage) {
        console.log(chalk.blue('\n📈 Coverage:'));
        for (const [type, data] of Object.entries(results.coverage)) {
          const color = data.covered ? chalk.green : chalk.red;
          console.log(`  ${type}: ${color(`${data.percent}%`)}`);
        }
      }
    }

    // Exit with appropriate code
    if (results.success) {
      console.log(chalk.green('\n✓ All tests passed!'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n✗ Some tests failed'));
      process.exit(1);
    }
  } catch (error) {
    handleCliError(error, process.env.DEVFLOW_DEBUG === 'true');
  }
}

/**
 * Execute memory command
 * @param {Object} options - Command options
 */
export async function executeMemory(action, options = {}) {
  try {
    const projectRoot = resolve(options.projectRoot || process.cwd());

    logger.debug(`Memory ${action} in: ${projectRoot}`);

    const { MemoryManager } = await import('../../memory/manager.js');
    const memoryManager = new MemoryManager({
      projectRoot,
      config: {},
    });
    await memoryManager.initialize();

    switch (action) {
      case 'read': {
        const entry = await memoryManager.retrieve(options.category, options.id);
        if (entry) {
          console.log(JSON.stringify(entry, null, 2));
        } else {
          console.log(chalk.yellow('Entry not found'));
        }
        break;
      }

      case 'write': {
        const content = JSON.parse(options.content || '{}');
        await memoryManager.store(options.category, options.id, content);
        console.log(chalk.green('Entry written'));
        break;
      }

      case 'search': {
        const results = await memoryManager.search(options.query, {
          category: options.category,
          limit: options.limit || 10,
        });
        console.log(chalk.blue(`\nFound ${results.length} results:\n`));
        for (const result of results) {
          console.log(
            chalk.gray(`[${result.score.toFixed(2)}]`),
            result.entry?.metadata?.id || 'Unknown'
          );
        }
        break;
      }

      case 'export': {
        const data = await memoryManager.export();
        const fs = await import('fs-extra');
        const exportPath = resolve(options.output || 'devflow-memory-export.json');
        await fs.writeJson(exportPath, data, { spaces: 2 });
        console.log(chalk.green(`Exported to ${exportPath}`));
        break;
      }

      case 'stats': {
        const stats = await memoryManager.getStats();
        console.log(chalk.blue('\n📊 Memory Stats\n'));
        console.log(chalk.gray('Vector Index:'), `${stats.vectorIndex.size} entries`);
        console.log(chalk.gray('Categories:'));
        for (const [category, count] of Object.entries(stats.categories)) {
          console.log(`  ${category}: ${count}`);
        }
        break;
      }

      default:
        console.log(chalk.red(`Unknown action: ${action}`));
        console.log(chalk.gray('Available actions: read, write, search, export, stats'));
    }
  } catch (error) {
    handleCliError(error, process.env.DEVFLOW_DEBUG === 'true');
  }
}

// Create Commander commands
export const runCommand = new Command('run')
  .description('Run full development workflow')
  .option('-p, --project-root <path>', 'Project root directory', process.cwd())
  .option('-r, --requirement <path>', 'Path to requirement document')
  .option('--phase <phase>', 'Start from specific phase', 'research')
  .option('--auto-approve', 'Skip confirmation prompts', false)
  .option('-v, --verbose', 'Verbose output', false)
  .action(executeRun);

export const testCommand = new Command('test')
  .description('Run tests')
  .option('-p, --project-root <path>', 'Project root directory', process.cwd())
  .option('--e2e', 'Run E2E tests with browser automation')
  .option('--integration', 'Run integration tests')
  .option('--coverage', 'Generate coverage report')
  .option('--watch', 'Watch mode')
  .option('--headed', 'Run browser in headed mode')
  .option('--browser <browser>', 'Browser to use', 'chromium')
  .action(executeTest);

export const memoryCommand = new Command('memory')
  .description('Memory management commands')
  .argument('<action>', 'Action: read, write, search, export, stats')
  .option('-p, --project-root <path>', 'Project root directory', process.cwd())
  .option('-c, --category <category>', 'Memory category')
  .option('-i, --id <id>', 'Entry ID')
  .option('-q, --query <query>', 'Search query')
  .option('-l, --limit <limit>', 'Result limit', '10')
  .option('-o, --output <path>', 'Output path')
  .option('--content <content>', 'Content to write (JSON)')
  .action(executeMemory);
