/**
 * Task Graph
 * DAG (Directed Acyclic Graph) implementation for task dependencies
 * Supports cycle detection, topological sort, and parallel execution planning
 */

import { OrchestrationError, ErrorCodes } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('TaskGraph');

/**
 * Task status
 */
export const TaskStatus = {
  PENDING: 'pending',
  READY: 'ready',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

/**
 * Task Graph Node
 */
class TaskNode {
  constructor(task) {
    this.task = task;
    this.id = task.id;
    this.status = TaskStatus.PENDING;
    this.dependencies = new Set(); // Tasks this depends on
    this.dependents = new Set(); // Tasks that depend on this
    this.result = null;
    this.error = null;
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Add a dependency
   */
  addDependency(dependencyId) {
    this.dependencies.add(dependencyId);
  }

  /**
   * Add a dependent
   */
  addDependent(dependentId) {
    this.dependents.add(dependentId);
  }

  /**
   * Check if all dependencies are satisfied
   */
  areDependenciesSatisfied(completedTasks) {
    for (const depId of this.dependencies) {
      if (!completedTasks.has(depId)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get duration in milliseconds
   */
  getDuration() {
    if (!this.startTime || !this.endTime) return null;
    return this.endTime - this.startTime;
  }
}

/**
 * Task Graph
 * Manages task dependencies and execution order
 */
export class TaskGraph {
  constructor() {
    this.nodes = new Map(); // id -> TaskNode
    this.executionOrder = []; // Topologically sorted list
    this.hasCycle = false;
    this.cycleNodes = [];
  }

  /**
   * Add a task to the graph
   * @param {Object} task - Task object with id, title, description, etc.
   */
  addTask(task) {
    if (!task.id) {
      throw new OrchestrationError(
        'Task must have an id',
        ErrorCodes.TASK_NOT_FOUND,
        { task }
      );
    }

    if (this.nodes.has(task.id)) {
      logger.warn(`Task ${task.id} already exists, skipping`);
      return;
    }

    const node = new TaskNode(task);
    this.nodes.set(task.id, node);

    // Add dependencies from task.dependsOn
    if (task.dependsOn && Array.isArray(task.dependsOn)) {
      for (const depId of task.dependsOn) {
        this.addDependency(task.id, depId);
      }
    }

    logger.debug(`Added task: ${task.id}`);
  }

  /**
   * Add a dependency between tasks
   * @param {string} taskId - Task that has the dependency
   * @param {string} dependsOnTaskId - Task it depends on
   */
  addDependency(taskId, dependsOnTaskId) {
    const taskNode = this.nodes.get(taskId);
    const dependencyNode = this.nodes.get(dependsOnTaskId);

    if (!taskNode) {
      throw new OrchestrationError(
        `Task not found: ${taskId}`,
        ErrorCodes.TASK_NOT_FOUND,
        { taskId }
      );
    }

    if (!dependencyNode) {
      throw new OrchestrationError(
        `Dependency task not found: ${dependsOnTaskId}`,
        ErrorCodes.TASK_NOT_FOUND,
        { dependsOnTaskId }
      );
    }

    taskNode.addDependency(dependsOnTaskId);
    dependencyNode.addDependent(taskId);

    logger.debug(`Added dependency: ${taskId} depends on ${dependsOnTaskId}`);
  }

  /**
   * Remove a task from the graph
   */
  removeTask(taskId) {
    const node = this.nodes.get(taskId);
    if (!node) return false;

    // Remove this task from its dependencies' dependents
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependents.delete(taskId);
      }
    }

    // Remove this task from its dependents' dependencies
    for (const depId of node.dependents) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependencies.delete(taskId);
      }
    }

    this.nodes.delete(taskId);
    return true;
  }

  /**
   * Detect cycles in the graph
   * Uses DFS-based cycle detection
   * @returns {Object} { hasCycle, cycleNodes }
   */
  detectCycle() {
    const visited = new Set();
    const recursionStack = new Set();
    const cyclePath = [];

    const dfs = (nodeId) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      cyclePath.push(nodeId);

      const node = this.nodes.get(nodeId);
      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          if (dfs(depId)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          // Found cycle
          cyclePath.push(depId);
          this.cycleNodes = cyclePath.slice(cyclePath.indexOf(depId));
          return true;
        }
      }

      recursionStack.delete(nodeId);
      cyclePath.pop();
      return false;
    };

    for (const [nodeId] of this.nodes) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) {
          this.hasCycle = true;
          return { hasCycle: true, cycleNodes: this.cycleNodes };
        }
      }
    }

    this.hasCycle = false;
    this.cycleNodes = [];
    return { hasCycle: false, cycleNodes: [] };
  }

  /**
   * Topological sort using Kahn's algorithm
   * @returns {Array} Sorted task IDs
   */
  topologicalSort() {
    if (this.hasCycle) {
      throw new OrchestrationError(
        'Cannot perform topological sort on graph with cycles',
        ErrorCodes.TASK_GRAPH_CYCLE,
        { cycleNodes: this.cycleNodes }
      );
    }

    const inDegree = new Map();
    const queue = [];
    const result = [];

    // Initialize in-degrees
    for (const [nodeId, node] of this.nodes) {
      inDegree.set(nodeId, node.dependencies.size);
    }

    // Find nodes with no dependencies
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    // Process nodes
    while (queue.length > 0) {
      const nodeId = queue.shift();
      result.push(nodeId);

      const node = this.nodes.get(nodeId);
      for (const dependentId of node.dependents) {
        const newDegree = inDegree.get(dependentId) - 1;
        inDegree.set(dependentId, newDegree);

        if (newDegree === 0) {
          queue.push(dependentId);
        }
      }
    }

    // Check if all nodes were processed
    if (result.length !== this.nodes.size) {
      // This shouldn't happen if cycle detection passed
      throw new OrchestrationError(
        'Topological sort failed - possible cycle',
        ErrorCodes.TASK_GRAPH_CYCLE
      );
    }

    this.executionOrder = result;
    return result;
  }

  /**
   * Get next batch of tasks ready to execute
   * @param {Set} completedTasks - Set of completed task IDs
   * @param {number} maxParallel - Maximum parallel tasks
   * @returns {Array} Task IDs ready to execute
   */
  getNextBatch(completedTasks, maxParallel = 3) {
    const readyTasks = [];

    for (const [nodeId, node] of this.nodes) {
      // Skip if already running or completed
      if (node.status === TaskStatus.RUNNING ||
          node.status === TaskStatus.COMPLETED ||
          node.status === TaskStatus.FAILED) {
        continue;
      }

      // Check if dependencies are satisfied
      if (node.areDependenciesSatisfied(completedTasks)) {
        node.status = TaskStatus.READY;
        readyTasks.push(nodeId);
      }
    }

    // Limit parallel execution
    return readyTasks.slice(0, maxParallel);
  }

  /**
   * Get a task by ID
   */
  getTask(taskId) {
    return this.nodes.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks() {
    return Array.from(this.nodes.values()).map(n => n.task);
  }

  /**
   * Get execution statistics
   */
  getStats() {
    const stats = {
      total: this.nodes.size,
      pending: 0,
      ready: 0,
      running: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      totalDuration: 0,
      avgDuration: 0,
    };

    let totalDuration = 0;
    let durationCount = 0;

    for (const node of this.nodes.values()) {
      stats[node.status]++;
      
      const duration = node.getDuration();
      if (duration !== null) {
        totalDuration += duration;
        durationCount++;
      }
    }

    stats.totalDuration = totalDuration;
    stats.avgDuration = durationCount > 0 ? totalDuration / durationCount : 0;

    return stats;
  }

  /**
   * Validate the graph
   */
  validate() {
    const errors = [];

    // Check for cycles
    const cycleCheck = this.detectCycle();
    if (cycleCheck.hasCycle) {
      errors.push({
        type: 'cycle',
        message: 'Graph contains a cycle',
        cycleNodes: cycleCheck.cycleNodes,
      });
    }

    // Check for missing dependencies
    for (const [nodeId, node] of this.nodes) {
      for (const depId of node.dependencies) {
        if (!this.nodes.has(depId)) {
          errors.push({
            type: 'missing_dependency',
            message: `Task ${nodeId} depends on non-existent task ${depId}`,
            taskId: nodeId,
            missingTaskId: depId,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export graph to serializable format
   */
  export() {
    const tasks = [];
    for (const node of this.nodes.values()) {
      tasks.push({
        ...node.task,
        status: node.status,
        result: node.result,
        error: node.error,
        duration: node.getDuration(),
      });
    }

    return {
      tasks,
      executionOrder: this.executionOrder,
      hasCycle: this.hasCycle,
      stats: this.getStats(),
    };
  }
}

/**
 * Create TaskGraph from array of task definitions
 */
export function createTaskGraph(tasks) {
  const graph = new TaskGraph();

  // First pass: add all tasks
  for (const task of tasks) {
    graph.addTask(task);
  }

  // Validate
  const validation = graph.validate();
  if (!validation.valid) {
    throw new OrchestrationError(
      'Invalid task graph',
      ErrorCodes.TASK_GRAPH_CYCLE,
      { errors: validation.errors }
    );
  }

  return graph;
}
