/**
 * Orchestrator
 * Main orchestration engine for task execution
 */

import { TaskGraph, createTaskGraph } from './task-graph.js';
import { getAdapter } from '../tool-adapter/index.js';
import { TokenBudgetManager } from './token-budget.js';
import { ToolDetector } from '../core/tool-detector.js';
import { MemoryManager } from '../memory/manager.js';
import { OrchestrationError, ErrorCodes } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('Orchestrator');

/**
 * Workflow phases
 */
export const WorkflowPhase = {
  RESEARCH: 'research',
  ANALYZE: 'analyze',
  DESIGN: 'design',
  SPLIT: 'split',
  DEV: 'dev',
  TEST: 'test',
  FIX: 'fix',
  REGRESSION: 'regression',
};

/**
 * Orchestrator
 */
export class Orchestrator {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.projectRoot = config.projectRoot || process.cwd();
    this.toolDetector = new ToolDetector(this.projectRoot);
    this.memoryManager = null;
    this.taskGraph = null;
    this.tokenBudgetManager = null;
    this.executionResults = new Map();
    this.currentPhase = null;
  }

  /**
   * Initialize orchestrator
   */
  async initialize() {
    logger.debug('Initializing orchestrator...');

    // Detect AI tool
    const toolResult = this.toolDetector.detect();
    logger.info(`Detected AI tool: ${toolResult.tool} (${toolResult.confidence})`);

    // Initialize tool adapter
    this.toolAdapter = getAdapter(toolResult.tool, this.config);

    // Initialize token budget manager
    this.tokenBudgetManager = new TokenBudgetManager({
      contextLimit: toolResult.capabilities.contextLimit || 128000,
    });

    // Initialize memory manager
    this.memoryManager = new MemoryManager({
      projectRoot: this.projectRoot,
      config: this.config,
    });
    await this.memoryManager.initialize();

    logger.debug('Orchestrator initialized');
  }

  /**
   * Execute a workflow phase
   * @param {string} phase - Phase to execute
   * @param {Object} data - Phase data
   */
  async executePhase(phase, data = {}) {
    this.currentPhase = phase;
    logger.info(`Executing phase: ${phase}`);

    try {
      let result;

      switch (phase) {
        case WorkflowPhase.RESEARCH:
          result = await this._executeResearchPhase(data);
          break;
        case WorkflowPhase.ANALYZE:
          result = await this._executeAnalyzePhase(data);
          break;
        case WorkflowPhase.DESIGN:
          result = await this._executeDesignPhase(data);
          break;
        case WorkflowPhase.SPLIT:
          result = await this._executeSplitPhase(data);
          break;
        case WorkflowPhase.DEV:
          result = await this._executeDevPhase(data);
          break;
        case WorkflowPhase.TEST:
          result = await this._executeTestPhase(data);
          break;
        case WorkflowPhase.FIX:
          result = await this._executeFixPhase(data);
          break;
        case WorkflowPhase.REGRESSION:
          result = await this._executeRegressionPhase(data);
          break;
        default:
          throw new OrchestrationError(
            `Unknown phase: ${phase}`,
            ErrorCodes.UNKNOWN_ERROR,
            { phase }
          );
      }

      logger.info(`Phase ${phase} completed`);
      return result;

    } catch (error) {
      logger.error(`Phase ${phase} failed:`, error);
      throw error;
    }
  }

  /**
   * Execute tasks from task graph
   * @param {Array} tasks - Array of task cards
   * @param {Object} options - Execution options
   */
  async executeTasks(tasks, options = {}) {
    const {
      parallelTasks = 3,
      onTaskStart = null,
      onTaskComplete = null,
      onTaskError = null,
    } = options;

    // Create task graph
    this.taskGraph = createTaskGraph(tasks);

    // Validate
    const validation = this.taskGraph.validate();
    if (!validation.valid) {
      throw new OrchestrationError(
        'Invalid task graph',
        ErrorCodes.TASK_GRAPH_CYCLE,
        { errors: validation.errors }
      );
    }

    // Topological sort
    const executionOrder = this.taskGraph.topologicalSort();
    logger.debug(`Execution order: ${executionOrder.join(' -> ')}`);

    const completedTasks = new Set();
    const results = [];

    // Execute in parallel batches
    while (completedTasks.size < tasks.length) {
      // Get next batch of ready tasks
      const readyTasks = this.taskGraph.getNextBatch(completedTasks, parallelTasks);

      if (readyTasks.length === 0) {
        // Check for deadlock
        if (completedTasks.size < tasks.length) {
          throw new OrchestrationError(
            'Task execution deadlocked - no ready tasks but not all completed',
            ErrorCodes.TASK_EXECUTION_FAILED
          );
        }
        break;
      }

      // Execute ready tasks in parallel
      const batchResults = await Promise.allSettled(
        readyTasks.map(async (taskId) => {
          const node = this.taskGraph.getTask(taskId);
          node.status = 'running';
          node.startTime = Date.now();

          if (onTaskStart) {
            await onTaskStart(node.task);
          }

          try {
            const result = await this._executeTask(node.task);
            
            node.status = 'completed';
            node.endTime = Date.now();
            node.result = result;
            completedTasks.add(taskId);

            if (onTaskComplete) {
              await onTaskComplete(node.task, result);
            }

            return { taskId, success: true, result };

          } catch (error) {
            node.status = 'failed';
            node.endTime = Date.now();
            node.error = error.message;
            completedTasks.add(taskId);

            if (onTaskError) {
              await onTaskError(node.task, error);
            }

            return { taskId, success: false, error: error.message };
          }
        })
      );

      results.push(...batchResults);
    }

    // Get final stats
    const stats = this.taskGraph.getStats();

    return {
      results,
      stats,
      graph: this.taskGraph.export(),
    };
  }

  /**
   * Execute a single task
   */
  async _executeTask(task) {
    // Build context
    const context = await this._buildTaskContext(task);

    // Check budget
    const prompt = this.toolAdapter.buildPrompt(task, context);
    const tokens = this.tokenBudgetManager.estimateTokens(prompt);

    if (!this.tokenBudgetManager.fitsInBudget(prompt)) {
      logger.warn(`Task ${task.id} exceeds context limit, running compression`);
      
      const compressionResult = await this.tokenBudgetManager.runCompressionPipeline(
        context,
        task,
        tokens
      );

      if (compressionResult.context.splitRequired) {
        logger.warn(`Task ${task.id} needs to be split into subtasks`);
        // For now, throw error - subtask splitting should be handled by caller
        throw new OrchestrationError(
          `Task ${task.id} exceeds context limits and needs splitting`,
          ErrorCodes.CONTEXT_OVERFLOW
        );
      }

      // Use compressed context
      context.compressed = true;
      context.compressionStrategies = compressionResult.strategies;
    }

    // Build final prompt
    const finalPrompt = this.toolAdapter.buildPrompt(task, context);

    // Record execution
    await this.memoryManager.recordExecutionLog(task.id, {
      task,
      promptLength: finalPrompt.length,
      tokens,
      timestamp: new Date().toISOString(),
    });

    // In a real implementation, this would invoke the AI tool
    // For now, return placeholder
    return {
      taskId: task.id,
      executed: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build context for task execution
   */
  async _buildTaskContext(task) {
    // Get project profile from memory
    const projectProfile = await this.memoryManager.getProjectProfile();

    // Get design document
    const designDoc = await this.memoryManager.getDesign('latest');

    // Get related patterns and pitfalls
    const patterns = await this.memoryManager.findSimilarPatterns(task.title);
    const pitfalls = await this.memoryManager.findRelevantPitfalls(task.description);

    return {
      projectProfile: projectProfile?.content || null,
      designDoc: designDoc?.content || null,
      patterns: patterns.map(p => p.entry?.content).filter(Boolean),
      pitfalls: pitfalls.map(p => p.entry?.content).filter(Boolean),
      previousTasks: this._getPreviousTaskResults(task),
    };
  }

  /**
   * Get results from previous dependent tasks
   */
  _getPreviousTaskResults(task) {
    const results = [];
    
    for (const depId of task.dependsOn || []) {
      const result = this.executionResults.get(depId);
      if (result) {
        results.push({ id: depId, output: result });
      }
    }

    return results;
  }

  // Phase execution methods - delegate to WorkflowRunner for full implementation
  async _executeResearchPhase(data) {
    const { executeResearch } = await import('../cli/commands/analyze.js');
    try {
      await executeResearch({ projectRoot: this.projectRoot });
      return { phase: WorkflowPhase.RESEARCH, status: 'completed', result: 'Project analyzed' };
    } catch (error) {
      return { phase: WorkflowPhase.RESEARCH, status: 'failed', error: error.message };
    }
  }

  async _executeAnalyzePhase(data) {
    try {
      const profile = await this.memoryManager.getProjectProfile();
      if (!profile) {
        return { phase: WorkflowPhase.ANALYZE, status: 'failed', error: 'No project profile found' };
      }
      return { phase: WorkflowPhase.ANALYZE, status: 'completed', result: profile.content };
    } catch (error) {
      return { phase: WorkflowPhase.ANALYZE, status: 'failed', error: error.message };
    }
  }

  async _executeDesignPhase(data) {
    try {
      // Store design document
      if (data?.designDoc) {
        const designId = `design-${Date.now()}`;
        await this.memoryManager.storeDesign(designId, data.designDoc);
        return { phase: WorkflowPhase.DESIGN, status: 'completed', designId };
      }
      return { phase: WorkflowPhase.DESIGN, status: 'completed', result: 'Design phase completed' };
    } catch (error) {
      return { phase: WorkflowPhase.DESIGN, status: 'failed', error: error.message };
    }
  }

  async _executeSplitPhase(data) {
    try {
      // Create task cards from design
      const tasks = data?.tasks || [];
      for (const task of tasks) {
        await this.memoryManager.storeTaskCard(task.id, task);
      }
      return { phase: WorkflowPhase.SPLIT, status: 'completed', taskCount: tasks.length };
    } catch (error) {
      return { phase: WorkflowPhase.SPLIT, status: 'failed', error: error.message };
    }
  }

  async _executeDevPhase(data) {
    try {
      // Execute tasks using task graph
      const tasks = data?.tasks || [];
      if (tasks.length > 0) {
        const results = await this.executeTasks(tasks, data?.options || {});
        return { phase: WorkflowPhase.DEV, status: 'completed', results };
      }
      return { phase: WorkflowPhase.DEV, status: 'completed', result: 'No tasks to execute' };
    } catch (error) {
      return { phase: WorkflowPhase.DEV, status: 'failed', error: error.message };
    }
  }

  async _executeTestPhase(data) {
    try {
      const { TestRunner } = await import('../testing/test-runner.js');
      const testRunner = new TestRunner({ projectRoot: this.projectRoot });
      const results = await testRunner.runAllTests();
      return { phase: WorkflowPhase.TEST, status: results.success ? 'completed' : 'failed', results };
    } catch (error) {
      return { phase: WorkflowPhase.TEST, status: 'failed', error: error.message };
    }
  }

  async _executeFixPhase(data) {
    try {
      // Handle test failures
      const failedTests = data?.failedTests || [];
      if (failedTests.length > 0) {
        // Create fix tasks for failed tests
        const fixTasks = failedTests.map((test, index) => ({
          id: `fix-${index}`,
          title: `Fix: ${test.test}`,
          type: 'bugfix',
          description: `Fix failing test: ${test.error}`,
        }));
        return { phase: WorkflowPhase.FIX, status: 'completed', fixTasks };
      }
      return { phase: WorkflowPhase.FIX, status: 'completed', result: 'No fixes needed' };
    } catch (error) {
      return { phase: WorkflowPhase.FIX, status: 'failed', error: error.message };
    }
  }

  async _executeRegressionPhase(data) {
    try {
      // Re-run all tests for regression
      const { TestRunner } = await import('../testing/test-runner.js');
      const testRunner = new TestRunner({ projectRoot: this.projectRoot });
      const results = await testRunner.runAllTests();
      return { 
        phase: WorkflowPhase.REGRESSION, 
        status: results.success ? 'completed' : 'failed', 
        results,
        summary: {
          total: results.summary?.total || 0,
          passed: results.summary?.passed || 0,
          failed: results.summary?.failed || 0,
        }
      };
    } catch (error) {
      return { phase: WorkflowPhase.REGRESSION, status: 'failed', error: error.message };
    }
  }
}

/**
 * Create orchestrator instance
 */
export function createOrchestrator(config = {}) {
  return new Orchestrator(config);
}
