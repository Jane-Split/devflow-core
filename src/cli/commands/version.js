/**
 * Version Command
 * Displays version information
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function executeVersion() {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf8')
  );

  console.log(chalk.blue('DevFlow'));
  console.log(chalk.gray(`Version: ${packageJson.version}`));
  console.log(chalk.gray(`Node: ${process.version}`));
  console.log(chalk.gray(`Platform: ${process.platform}`));
  console.log(chalk.gray(`Arch: ${process.arch}`));
  console.log();
  console.log(chalk.gray(packageJson.description));
  console.log(chalk.gray(`Homepage: ${packageJson.homepage}`));
}

export const versionCommand = new Command('version')
  .description('Display version information')
  .alias('v')
  .action(executeVersion);
