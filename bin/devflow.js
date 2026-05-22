#!/usr/bin/env node

/**
 * DevFlow CLI Entry Point
 * Main entry for the devflow command
 */

import { program } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get package info
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
);

// Import all commands
import { initCommand } from '../src/cli/commands/init.js';
import { versionCommand } from '../src/cli/commands/version.js';
import { analyzeCommand, researchCommand } from '../src/cli/commands/analyze.js';
import { runCommand, testCommand, memoryCommand } from '../src/cli/commands/run.js';
import { registerStatusCommand } from '../src/cli/commands/status.js';

// Configure CLI
program
  .name('devflow')
  .description('AI-powered development workflow orchestration tool\n\n' +
    'Covers: project research → requirement analysis → detailed design →\n' +
    'task splitting → multi-agent parallel development → self-check →\n' +
    'testing (unit/integration/E2E) → bug fix → regression testing')
  .version(packageJson.version, '-v, --version', 'Display version number')
  .helpOption('-h, --help', 'Display help for command')
  .configureOutput({
    outputError: (str, write) => write(chalk.red(str)),
  });

// Add global options
program
  .option('-d, --debug', 'Enable debug mode', false)
  .option('--dry-run', 'Run without making changes', false)
  .option('-c, --config <path>', 'Path to config file')
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    if (options.debug) {
      process.env.DEVFLOW_DEBUG = 'true';
      console.log(chalk.gray('[Debug mode enabled]'));
    }
    if (options.dryRun) {
      process.env.DEVFLOW_DRY_RUN = 'true';
      console.log(chalk.yellow('[Dry run mode - no changes will be made]'));
    }
  });

// Register all commands
program.addCommand(initCommand);
program.addCommand(versionCommand);
program.addCommand(analyzeCommand);
program.addCommand(researchCommand);
program.addCommand(runCommand);
program.addCommand(testCommand);
program.addCommand(memoryCommand);
registerStatusCommand(program);

// Error handling for unknown commands
program.on('command:*', (operands) => {
  console.error(chalk.red(`Unknown command: ${operands[0]}`));
  console.log(chalk.gray('Run "devflow --help" for available commands'));
  process.exit(1);
});

// Parse arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
