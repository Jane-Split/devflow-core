/**
 * Task Card
 * Structured task definition for the development workflow
 */

/**
 * Task priority levels
 */
export const TaskPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * Task types
 */
export const TaskType = {
  RESEARCH: 'research',
  ANALYSIS: 'analysis',
  DESIGN: 'design',
  IMPLEMENTATION: 'implementation',
  REFACTORING: 'refactoring',
  TESTING: 'testing',
  DOCUMENTATION: 'documentation',
  DEPLOYMENT: 'deployment',
  BUG_FIX: 'bug_fix',
  REVIEW: 'review',
};

/**
 * Task card template
 */
export const TASK_CARD_TEMPLATE = {
  // Required fields
  id: '', // Unique identifier (e.g., "TASK-001")
  title: '', // Short title
  type: TaskType.IMPLEMENTATION, // Task type

  // Description
  description: '', // Detailed description
  acceptanceCriteria: [], // Array of acceptance criteria

  // Dependencies
  dependsOn: [], // Array of task IDs this depends on

  // Assignment
  assignee: null, // Assigned developer/agent
  priority: TaskPriority.MEDIUM,

  // Estimate
  estimatedHours: null,
  actualHours: null,

  // Status tracking
  status: 'pending', // pending | in_progress | completed | blocked
  blockedBy: [], // Tasks blocking this one

  // Metadata
  tags: [], // Array of tags for categorization
  labels: [], // Labels for filtering

  // Context
  context: {
    projectType: null, // frontend | backend | fullstack | microservice
    files: [], // Files to modify/create
    modules: [], // Modules involved
    testCoverage: null, // Required test coverage percentage
  },

  // Results
  output: {
    files: [], // Files created/modified
    tests: [], // Tests created
    docs: [], // Documentation created
  },

  // Timestamps
  createdAt: null,
  updatedAt: null,
  startedAt: null,
  completedAt: null,
};

/**
 * Create a task card
 * @param {Object} data - Task data
 * @returns {Object} Task card
 */
export function createTaskCard(data) {
  return {
    ...structuredClone(TASK_CARD_TEMPLATE),
    ...data,
    id: data.id || generateTaskId(),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a unique task ID
 */
let taskCounter = 0;
export function generateTaskId() {
  taskCounter++;
  return `TASK-${String(taskCounter).padStart(4, '0')}`;
}

/**
 * Validate task card
 * @param {Object} taskCard - Task card to validate
 * @returns {Object} Validation result
 */
export function validateTaskCard(taskCard) {
  const errors = [];

  // Required fields
  if (!taskCard.id) {
    errors.push({ field: 'id', message: 'Task ID is required' });
  }

  if (!taskCard.title || taskCard.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Task title is required' });
  }

  if (!taskCard.type) {
    errors.push({ field: 'type', message: 'Task type is required' });
  }

  // Valid type
  if (taskCard.type && !Object.values(TaskType).includes(taskCard.type)) {
    errors.push({
      field: 'type',
      message: `Invalid task type: ${taskCard.type}`,
    });
  }

  // Valid priority
  if (taskCard.priority && !Object.values(TaskPriority).includes(taskCard.priority)) {
    errors.push({
      field: 'priority',
      message: `Invalid priority: ${taskCard.priority}`,
    });
  }

  // Valid dependencies
  if (taskCard.dependsOn && !Array.isArray(taskCard.dependsOn)) {
    errors.push({ field: 'dependsOn', message: 'dependsOn must be an array' });
  }

  // Self-dependency check
  if (taskCard.dependsOn?.includes(taskCard.id)) {
    errors.push({ field: 'dependsOn', message: 'Task cannot depend on itself' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse task cards from markdown
 * @param {string} markdown - Markdown content with task cards
 * @returns {Array} Array of task cards
 */
export function parseTaskCardsFromMarkdown(markdown) {
  const taskCards = [];
  const taskRegex = /```task\s*\n([\s\S]*?)```/g;

  let match;
  while ((match = taskRegex.exec(markdown)) !== null) {
    try {
      const taskData = JSON.parse(match[1]);
      taskCards.push(createTaskCard(taskData));
    } catch (error) {
      // Try to parse from structured format
      const task = parseStructuredTask(match[1]);
      if (task) {
        taskCards.push(createTaskCard(task));
      }
    }
  }

  return taskCards;
}

/**
 * Parse structured task format
 */
function parseStructuredTask(content) {
  const task = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim().toLowerCase().replace(/\s+/g, '');
      const value = line.slice(colonIndex + 1).trim();

      switch (key) {
        case 'id':
        case 'title':
        case 'description':
        case 'type':
        case 'priority':
        case 'status':
        case 'assignee':
          task[key] = value;
          break;
        case 'depends':
        case 'dependson':
          task.dependsOn = value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          break;
        case 'tags':
        case 'labels':
          task[key === 'labels' ? 'labels' : 'tags'] = value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          break;
      }
    }
  }

  return task.id ? task : null;
}

/**
 * Convert task card to markdown
 * @param {Object} taskCard - Task card
 * @returns {string} Markdown representation
 */
export function taskCardToMarkdown(taskCard) {
  return `\`\`\`task
{
  "id": "${taskCard.id}",
  "title": "${taskCard.title}",
  "type": "${taskCard.type}",
  "description": "${escapeJsonString(taskCard.description || '')}",
  "dependsOn": ${JSON.stringify(taskCard.dependsOn || [])},
  "priority": "${taskCard.priority || 'medium'}",
  "status": "${taskCard.status || 'pending'}",
  "tags": ${JSON.stringify(taskCard.tags || [])}
}
\`\`\``;
}

/**
 * Escape string for JSON
 */
function escapeJsonString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Split task into subtasks
 * @param {Object} taskCard - Parent task
 * @param {number} numSubtasks - Number of subtasks
 * @returns {Array} Array of subtask cards
 */
export function splitTask(taskCard, numSubtasks) {
  const subtasks = [];

  for (let i = 0; i < numSubtasks; i++) {
    subtasks.push(
      createTaskCard({
        ...taskCard,
        id: `${taskCard.id}-SUB${i + 1}`,
        title: `${taskCard.title} (Part ${i + 1})`,
        parentId: taskCard.id,
        dependsOn: i > 0 ? [`${taskCard.id}-SUB${i}`] : taskCard.dependsOn,
      })
    );
  }

  return subtasks;
}
