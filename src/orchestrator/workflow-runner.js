/**
 * Workflow Runner
 * Executes the complete 8-phase development workflow
 */

import chalk from 'chalk';
import ora from 'ora';
import { Orchestrator, WorkflowPhase } from './orchestrator.js';
import { LearningEngine } from './learning-engine.js';
import { MemoryManager } from '../memory/manager.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('WorkflowRunner');

/**
 * Workflow Runner
 */
export class WorkflowRunner {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.projectRoot = config.projectRoot || process.cwd();
    this.orchestrator = null;
    this.learningEngine = null;
    this.memoryManager = null;
    this.phaseResults = {};
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Initialize workflow runner
   */
  async initialize() {
    logger.debug('Initializing workflow runner...');

    // Initialize orchestrator
    this.orchestrator = new Orchestrator({
      projectRoot: this.projectRoot,
      config: this.config,
    });
    await this.orchestrator.initialize();

    // Initialize learning engine
    this.learningEngine = new LearningEngine({
      projectRoot: this.projectRoot,
      config: this.config,
    });
    await this.learningEngine.initialize();

    // Initialize memory manager
    this.memoryManager = new MemoryManager({
      projectRoot: this.projectRoot,
      config: this.config,
    });
    await this.memoryManager.initialize();

    logger.debug('Workflow runner initialized');
  }

  /**
   * Run full workflow
   * @param {Object} options - Run options
   * @returns {Promise<Object>} Workflow results
   */
  async runFullWorkflow(options = {}) {
    const {
      requirementPath,
      startPhase = WorkflowPhase.RESEARCH,
      endPhase = WorkflowPhase.REGRESSION,
      autoApprove = false,
      verbose = false,
    } = options;

    this.startTime = Date.now();
    const phases = this._getPhasesInOrder(startPhase, endPhase);

    logger.info(`Starting workflow: ${phases.join(' → ')}`);

    // Load requirement document
    let requirements = null;
    if (requirementPath) {
      requirements = await this._loadRequirement(requirementPath);
    }

    // Display workflow plan
    this._displayWorkflowPlan(phases, requirements);

    // Confirm if not auto-approved
    if (!autoApprove) {
      const confirmed = await this._confirmStart();
      if (!confirmed) {
        console.log(chalk.yellow('Workflow cancelled.'));
        return { cancelled: true };
      }
    }

    // Execute each phase
    for (const phase of phases) {
      const phaseSpinner = ora(`Executing phase: ${phase}`).start();

      try {
        const result = await this._executePhase(phase, {
          requirements,
          previousResults: this.phaseResults,
          verbose,
        });

        this.phaseResults[phase] = result;
        phaseSpinner.succeed(chalk.green(`${phase} completed`));

        // Learn from phase execution
        await this.learningEngine.learnFromExecution({
          phase,
          result,
          projectType: this.phaseResults[WorkflowPhase.ANALYZE]?.type,
        });

        // Check for phase failure
        if (result.status === 'failed') {
          phaseSpinner.fail(chalk.red(`${phase} failed`));
          console.log(chalk.red(`Error: ${result.error}`));
          break;
        }
      } catch (error) {
        phaseSpinner.fail(chalk.red(`${phase} failed`));
        this.phaseResults[phase] = {
          status: 'failed',
          error: error.message,
        };

        // Record failure
        await this.learningEngine.learnFromExecution({
          phase,
          result: { success: false },
          errors: [error],
        });

        break;
      }
    }

    this.endTime = Date.now();

    // Generate summary
    const summary = this._generateSummary();

    // Display results
    this._displaySummary(summary);

    return summary;
  }

  /**
   * Execute a single phase
   */
  async _executePhase(phase, context = {}) {
    switch (phase) {
      case WorkflowPhase.RESEARCH:
        return this._executeResearch(context);
      case WorkflowPhase.ANALYZE:
        return this._executeAnalyze(context);
      case WorkflowPhase.DESIGN:
        return this._executeDesign(context);
      case WorkflowPhase.SPLIT:
        return this._executeSplit(context);
      case WorkflowPhase.DEV:
        return this._executeDev(context);
      case WorkflowPhase.TEST:
        return this._executeTest(context);
      case WorkflowPhase.FIX:
        return this._executeFix(context);
      case WorkflowPhase.REGRESSION:
        return this._executeRegression(context);
      default:
        throw new Error(`Unknown phase: ${phase}`);
    }
  }

  /**
   * Phase: Research
   */
  async _executeResearch(context) {
    logger.info('Phase: Research - Gathering project information');

    // Check if research already exists
    const existingProfile = await this.memoryManager.getProjectProfile();

    if (existingProfile && !context.forceRefresh) {
      logger.info('Using existing project profile');
      return {
        status: 'completed',
        output: existingProfile,
        skipped: true,
      };
    }

    // Trigger research command (using analyzer)
    const profile = await this._runResearch();

    return {
      status: 'completed',
      output: profile,
    };
  }

  /**
   * Phase: Analyze
   */
  async _executeAnalyze(_context) {
    logger.info('Phase: Analyze - Analyzing project structure');

    const profile = await this.memoryManager.getProjectProfile();

    if (!profile) {
      throw new Error('Project profile not found. Run research first.');
    }

    return {
      status: 'completed',
      type: profile.type,
      output: profile,
    };
  }

  /**
   * Phase: Design
   */
  async _executeDesign(_context) {
    logger.info('Phase: Design - Creating design documents');

    // Get design from requirements or generate
    const design = _context.requirements?.design || {
      architecture: 'modular',
      components: [],
    };

    // Store design
    await this.memoryManager.storeDesign('latest', design);

    return {
      status: 'completed',
      output: design,
    };
  }

  /**
   * Phase: Split
   */
  async _executeSplit(context) {
    logger.info('Phase: Split - Creating task breakdown');

    // Get design and split into tasks
    const design = await this.memoryManager.getDesign('latest');
    const tasks = this._createTaskCards(design, context.requirements);

    // Store tasks
    for (const task of tasks) {
      await this.memoryManager.storeTaskCard(task.id, task);
    }

    return {
      status: 'completed',
      taskCount: tasks.length,
      tasks,
    };
  }

  /**
   * Phase: Dev
   */
  async _executeDev(_context) {
    logger.info('Phase: Development - Executing tasks');

    const tasks = await this._loadPendingTasks();

    if (tasks.length === 0) {
      return {
        status: 'completed',
        message: 'No tasks to execute',
      };
    }

    // Execute tasks using orchestrator
    const result = await this.orchestrator.executeTasks(tasks, {
      parallelTasks: this.config.workflow?.parallelTasks || 3,
    });

    return {
      status: result.stats.failed > 0 ? 'failed' : 'completed',
      output: result,
    };
  }

  /**
   * Phase: Test
   */
  async _executeTest(_context) {
    logger.info('Phase: Test - Running tests');

    const { TestRunner } = await import('../testing/test-runner.js');
    const runner = new TestRunner({
      projectRoot: this.projectRoot,
    });

    const results = await runner.runAllTests({
      coverage: true,
    });

    return {
      status: results.summary.success ? 'completed' : 'failed',
      output: results,
    };
  }

  /**
   * Phase: Fix
   */
  async _executeFix(_context) {
    logger.info('Phase: Fix - Addressing test failures');

    // Get failed tests from previous phase
    const testResults = this.phaseResults[WorkflowPhase.TEST];

    if (!testResults?.output?.summary?.failed) {
      return {
        status: 'completed',
        message: 'No failures to fix',
      };
    }

    // Record pitfall
    await this.learningEngine.recordPitfall({
      name: 'Test failures in workflow',
      description: `${testResults.output.summary.failed} tests failed`,
      category: 'testing',
      symptom: 'Test failures',
      solution: 'Manual fix required',
    });

    return {
      status: 'pending',
      message: 'Manual fix required',
      failedTests: testResults.output.summary.failed,
    };
  }

  /**
   * Phase: Regression
   */
  async _executeRegression(_context) {
    logger.info('Phase: Regression - Final validation');

    // Re-run tests
    const { TestRunner } = await import('../testing/test-runner.js');
    const runner = new TestRunner({
      projectRoot: this.projectRoot,
    });

    const results = await runner.runAllTests({
      coverage: true,
    });

    return {
      status: results.summary.success ? 'completed' : 'failed',
      output: results,
    };
  }

  /**
   * Load requirement document
   */
  async _loadRequirement(path) {
    const fs = await import('fs-extra');

    try {
      const content = await fs.readFile(path, 'utf8');
      return JSON.parse(content);
    } catch {
      // Try as markdown
      return { raw: 'content', path };
    }
  }

  /**
   * Run research
   */
  async _runResearch() {
    const { executeResearch } = await import('../cli/commands/analyze.js');

    return executeResearch({
      projectRoot: this.projectRoot,
      refresh: true,
    });
  }

  /**
   * Create task cards from design
   */
  _createTaskCards(design, _requirements) {
    const tasks = [];
    let taskId = 1;

    // Create tasks based on design components
    for (const component of design?.components || []) {
      tasks.push({
        id: `TASK-${String(taskId++).padStart(4, '0')}`,
        title: `Implement ${component.name}`,
        type: 'implementation',
        description: component.description,
        priority: 'high',
        status: 'pending',
        context: {
          files: component.files,
        },
      });

      // Add test task
      tasks.push({
        id: `TASK-${String(taskId++).padStart(4, '0')}`,
        title: `Test ${component.name}`,
        type: 'testing',
        description: `Write tests for ${component.name}`,
        priority: 'medium',
        status: 'pending',
        dependsOn: [`TASK-${String(taskId - 2).padStart(4, '0')}`],
      });
    }

    return tasks;
  }

  /**
   * Load pending tasks
   */
  async _loadPendingTasks() {
    const entries = await this.memoryManager.list('task-cards');
    const tasks = [];

    for (const entry of entries) {
      const task = await this.memoryManager.getTaskCard(entry.id);
      if (task?.content?.status === 'pending') {
        tasks.push(task.content);
      }
    }

    return tasks;
  }

  /**
   * Get phases in order
   */
  _getPhasesInOrder(start, end) {
    const allPhases = [
      WorkflowPhase.RESEARCH,
      WorkflowPhase.ANALYZE,
      WorkflowPhase.DESIGN,
      WorkflowPhase.SPLIT,
      WorkflowPhase.DEV,
      WorkflowPhase.TEST,
      WorkflowPhase.FIX,
      WorkflowPhase.REGRESSION,
    ];

    const startIndex = allPhases.indexOf(start);
    const endIndex = allPhases.indexOf(end);

    if (startIndex === -1 || endIndex === -1) {
      throw new Error('Invalid phase specified');
    }

    return allPhases.slice(startIndex, endIndex + 1);
  }

  /**
   * Display workflow plan
   */
  _displayWorkflowPlan(phases, requirements) {
    console.log(chalk.blue('\n📋 Workflow Plan\n'));
    console.log(chalk.gray('Phases:'));

    phases.forEach((phase, index) => {
      const icons = {
        [WorkflowPhase.RESEARCH]: '🔍',
        [WorkflowPhase.ANALYZE]: '📊',
        [WorkflowPhase.DESIGN]: '📝',
        [WorkflowPhase.SPLIT]: '📋',
        [WorkflowPhase.DEV]: '💻',
        [WorkflowPhase.TEST]: '🧪',
        [WorkflowPhase.FIX]: '🔧',
        [WorkflowPhase.REGRESSION]: '✅',
      };
      console.log(chalk.gray(`  ${index + 1}. ${icons[phase]} ${phase}`));
    });

    if (requirements) {
      console.log(
        chalk.gray('\nRequirement:'),
        chalk.white(requirements.title || 'Custom requirement')
      );
    }

    console.log();
  }

  /**
   * Confirm workflow start
   */
  async _confirmStart() {
    const inquirer = await import('inquirer');
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Start workflow?',
        default: true,
      },
    ]);
    return confirmed;
  }

  /**
   * Generate summary
   */
  _generateSummary() {
    const duration = this.endTime - this.startTime;
    const phases = Object.keys(this.phaseResults);

    const completed = phases.filter(p => this.phaseResults[p]?.status === 'completed').length;

    const failed = phases.filter(p => this.phaseResults[p]?.status === 'failed').length;

    return {
      phases: this.phaseResults,
      stats: {
        totalPhases: phases.length,
        completed,
        failed,
        duration,
        durationFormatted: this._formatDuration(duration),
      },
      success: failed === 0,
    };
  }

  /**
   * Format duration
   */
  _formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Display summary
   */
  _displaySummary(summary) {
    console.log(chalk.blue('\n📊 Workflow Summary\n'));

    console.log(
      chalk.gray('Status:'),
      summary.success ? chalk.green('✓ SUCCESS') : chalk.red('✗ FAILED')
    );

    console.log(chalk.gray('Duration:'), chalk.white(summary.stats.durationFormatted));
    console.log(
      chalk.gray('Phases:'),
      chalk.white(`${summary.stats.completed}/${summary.stats.totalPhases} completed`)
    );

    console.log(chalk.gray('\nPhase Results:'));
    for (const [phase, result] of Object.entries(summary.phases)) {
      const status =
        result?.status === 'completed'
          ? chalk.green('✓')
          : result?.status === 'failed'
            ? chalk.red('✗')
            : chalk.yellow('○');

      console.log(`  ${status} ${phase}`);
    }

    console.log();
  }
}

/**
 * Create workflow runner
 */
export function createWorkflowRunner(config = {}) {
  return new WorkflowRunner(config);
}
