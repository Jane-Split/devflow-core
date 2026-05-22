/**
 * Status Command
 * Shows current project status and workflow progress
 */

import { Logger } from '../../utils/logger.js';
import { ConfigManager } from '../../core/config.js';
import { MemoryManager } from '../../memory/manager.js';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';

const logger = new Logger('status');

/**
 * Register status command
 * @param {Command} program - Commander program
 */
export function registerStatusCommand(program) {
  program
    .command('status')
    .description('Show project status and workflow progress')
    .option('-v, --verbose', 'Show detailed information', false)
    .option('-j, --json', 'Output as JSON', false)
    .option('--phase <phase>', 'Show status for specific phase')
    .action(async options => {
      const spinner = ora('Loading project status...').start();

      try {
        const status = await getProjectStatus(options);

        spinner.stop();

        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
        } else {
          displayStatus(status, options);
        }
      } catch (error) {
        spinner.fail('Failed to load status');
        logger.error(`Status command failed: ${error.message}`);
        process.exit(1);
      }
    });
}

/**
 * Get project status
 * @param {Object} options - Options
 * @returns {Promise<Object>} Project status
 */
async function getProjectStatus(_options) {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  const memoryManager = new MemoryManager({
    projectRoot: process.cwd(),
    config,
  });

  await memoryManager.initialize();

  // Get project profile
  const profile = await memoryManager.getProjectProfile();

  // Get task statistics
  const tasks = await memoryManager.listTaskCards();
  const taskStats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
  };

  // Get design documents
  const designs = await memoryManager.listDesigns();

  // Get memory statistics
  const memoryStats = await memoryManager.getStats();

  // Get current workflow state
  const workflowState = await memoryManager.getWorkflowState();

  // Calculate progress
  const progress =
    taskStats.total > 0 ? ((taskStats.completed / taskStats.total) * 100).toFixed(1) : 0;

  return {
    project: {
      name: profile?.content?.name || config.project?.name || 'Unknown',
      type: profile?.content?.type || config.project?.type || 'Unknown',
      root: process.cwd(),
    },
    profile: profile
      ? {
          analyzed: true,
          lastUpdated: profile.updatedAt || profile.createdAt,
        }
      : {
          analyzed: false,
        },
    tasks: taskStats,
    designs: {
      total: designs.length,
      documents: designs.map(d => ({
        id: d.id,
        title: d.content?.title || 'Untitled',
        status: d.content?.status || 'draft',
      })),
    },
    memory: memoryStats,
    workflow: workflowState || {
      currentPhase: null,
      startedAt: null,
      lastActivity: null,
    },
    progress: {
      percentage: progress,
      status: getOverallStatus(taskStats, workflowState),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Display status in human-readable format
 * @param {Object} status - Status object
 * @param {Object} options - Display options
 */
function displayStatus(status, options) {
  console.log();
  console.log(chalk.bold.blue(`📊 Project Status: ${status.project.name}`));
  console.log(chalk.gray(`Type: ${status.project.type}`));
  console.log(chalk.gray(`Root: ${status.project.root}`));
  console.log();

  // Project Analysis Status
  console.log(chalk.bold('🔍 Project Analysis'));
  if (status.profile.analyzed) {
    console.log(chalk.green('  ✓ Project analyzed'));
    console.log(chalk.gray(`  Last updated: ${status.profile.lastUpdated}`));
  } else {
    console.log(chalk.yellow('  ⚠ Project not analyzed'));
    console.log(chalk.gray('  Run `devflow research` to analyze the project'));
  }
  console.log();

  // Task Progress
  console.log(chalk.bold('📋 Task Progress'));
  console.log();

  const taskTable = new Table({
    head: [chalk.cyan('Status'), chalk.cyan('Count'), chalk.cyan('Percentage')],
    colWidths: [15, 10, 15],
  });

  const { tasks } = status;
  const total = tasks.total || 1;

  taskTable.push(
    ['Pending', tasks.pending, `${((tasks.pending / total) * 100).toFixed(0)}%`],
    ['In Progress', tasks.inProgress, `${((tasks.inProgress / total) * 100).toFixed(0)}%`],
    ['Completed', tasks.completed, `${((tasks.completed / total) * 100).toFixed(0)}%`],
    ['Blocked', tasks.blocked, `${((tasks.blocked / total) * 100).toFixed(0)}%`]
  );

  console.log(taskTable.toString());
  console.log();

  // Progress bar
  const progressBar = createProgressBar(parseFloat(status.progress.percentage));
  console.log(`Overall Progress: ${progressBar} ${status.progress.percentage}%`);
  console.log();

  // Design Documents
  if (status.designs.total > 0) {
    console.log(chalk.bold('📄 Design Documents'));
    console.log();

    const designTable = new Table({
      head: [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('Status')],
      colWidths: [20, 40, 15],
    });

    for (const doc of status.designs.documents) {
      designTable.push([doc.id, doc.title, doc.status]);
    }

    console.log(designTable.toString());
    console.log();
  }

  // Workflow State
  console.log(chalk.bold('⚙️  Workflow State'));
  if (status.workflow.currentPhase) {
    console.log(chalk.green(`  Current Phase: ${status.workflow.currentPhase}`));
    if (status.workflow.startedAt) {
      console.log(chalk.gray(`  Started: ${status.workflow.startedAt}`));
    }
    if (status.workflow.lastActivity) {
      console.log(chalk.gray(`  Last Activity: ${status.workflow.lastActivity}`));
    }
  } else {
    console.log(chalk.gray('  No active workflow'));
    console.log(chalk.gray('  Run `devflow run` to start a workflow'));
  }
  console.log();

  // Memory Statistics
  if (options.verbose) {
    console.log(chalk.bold('💾 Memory Statistics'));
    console.log(chalk.gray(`  Total Entries: ${status.memory.totalEntries || 0}`));
    console.log(chalk.gray(`  Categories: ${status.memory.categories?.join(', ') || 'none'}`));
    console.log(chalk.gray(`  Index Size: ${status.memory.indexSize || 0}`));
    console.log();
  }

  // Overall Status
  const statusColor =
    status.progress.status === 'complete'
      ? chalk.green
      : status.progress.status === 'in_progress'
        ? chalk.yellow
        : status.progress.status === 'blocked'
          ? chalk.red
          : chalk.gray;

  console.log(statusColor.bold(`Status: ${status.progress.status.toUpperCase()}`));
  console.log();
}

/**
 * Get overall status
 * @param {Object} taskStats - Task statistics
 * @param {Object} workflow - Workflow state
 * @returns {string} Overall status
 */
function getOverallStatus(taskStats, workflow) {
  if (taskStats.blocked > 0) {
    return 'blocked';
  }
  if (taskStats.completed === taskStats.total && taskStats.total > 0) {
    return 'complete';
  }
  if (taskStats.inProgress > 0 || workflow?.currentPhase) {
    return 'in_progress';
  }
  if (taskStats.pending > 0) {
    return 'pending';
  }
  return 'not_started';
}

/**
 * Create progress bar string
 * @param {number} percentage - Progress percentage
 * @returns {string} Progress bar
 */
function createProgressBar(percentage) {
  const width = 20;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  if (percentage >= 100) {
    return chalk.green(bar);
  }
  if (percentage >= 50) {
    return chalk.yellow(bar);
  }
  return chalk.gray(bar);
}

export default registerStatusCommand;
