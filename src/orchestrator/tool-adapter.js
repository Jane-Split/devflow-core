/**
 * Tool Adapter Layer
 * Abstracts differences between AI coding tools
 * Handles context limits, prompting strategies, and subagent invocation
 */

import { ErrorCodes, ToolAdapterError } from '../utils/errors.js';
import { SupportedTools, TOOL_CAPABILITIES } from '../core/tool-detector.js';

/**
 * Prompt style types
 */
export const PromptStyle = {
  DETAILED: 'detailed', // Full context, verbose instructions
  CONCISE: 'concise', // Minimal context, brief instructions
  PSEUDOCODE: 'pseudocode', // High-level pseudocode instructions
};

/**
 * Base Tool Adapter
 */
export class BaseToolAdapter {
  /**
   * @param {Object} config - Adapter configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.toolType = config.toolType || SupportedTools.UNKNOWN;
    this.capabilities = TOOL_CAPABILITIES[this.toolType];
  }

  /**
   * Build prompt for task card
   * @param {Object} taskCard - Task card
   * @param {Object} context - Additional context
   * @returns {string} Generated prompt
   */
  buildPrompt(_taskCard, _context = {}) {
    throw new ToolAdapterError(
      'buildPrompt() must be implemented by subclass',
      ErrorCodes.NOT_IMPLEMENTED
    );
  }

  /**
   * Estimate token count for prompt
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if context fits within limit
   * @param {string} prompt - Prompt to check
   * @returns {boolean} Whether it fits
   */
  fitsInContext(prompt) {
    const tokens = this.estimateTokens(prompt);
    return tokens <= this.capabilities.contextLimit;
  }

  /**
   * Build subagent command
   * @param {Object} taskCard - Task card
   * @param {Object} options - Options
   * @returns {Object} Command configuration
   */
  buildSubagentCommand(_taskCard, _options = {}) {
    throw new ToolAdapterError(
      'buildSubagentCommand() must be implemented by subclass',
      ErrorCodes.NOT_IMPLEMENTED
    );
  }
}

/**
 * Cursor Adapter
 * Cursor supports full context and can handle detailed prompts
 */
export class CursorAdapter extends BaseToolAdapter {
  constructor(config = {}) {
    super({ ...config, toolType: SupportedTools.CURSOR });
  }

  buildPrompt(taskCard, context = {}) {
    const { projectProfile = {}, conventions = {}, designDoc = null, previousTasks = [] } = context;

    return `# Task: ${taskCard.title}

## Task ID
${taskCard.id}

## Description
${taskCard.description}

## Type
${taskCard.type}

## Priority
${taskCard.priority}

## Context

### Project Profile
${JSON.stringify(projectProfile, null, 2)}

### Code Conventions
- Component naming: ${conventions.componentNaming || 'PascalCase'}
- Function naming: ${conventions.functionNaming || 'camelCase'}
- File naming: ${conventions.fileNaming || 'kebab-case'}

### Design Document
${designDoc || 'No design document available'}

## Dependencies
${taskCard.dependsOn?.length > 0 ? taskCard.dependsOn.map(id => `- ${id}`).join('\n') : 'None'}

## Previous Task Results
${
  previousTasks.length > 0
    ? previousTasks.map(t => `### ${t.id}: ${t.title}\n${t.output || 'No output'}`).join('\n\n')
    : 'None'
}

## Acceptance Criteria
${taskCard.acceptanceCriteria?.map(c => `- ${c}`).join('\n') || 'No specific criteria defined'}

## Instructions
1. Read the design document and understand the requirements
2. Check AGENTS.md for project conventions
3. Implement the task following the coding standards
4. Write unit tests for new functionality
5. Update documentation as needed
6. Ensure all acceptance criteria are met

Please complete this task and report the results including:
- Files created/modified
- Tests added
- Any issues encountered
`;
  }

  buildSubagentCommand(taskCard, options = {}) {
    return {
      command: 'cursor-subagent',
      args: ['--task-id', taskCard.id, '--prompt', this.buildPrompt(taskCard, options.context)],
      readOnly: this.capabilities.subagentReadOnly,
    };
  }
}

/**
 * Trae Adapter
 * Similar to Cursor, supports detailed prompts
 */
export class TraeAdapter extends BaseToolAdapter {
  constructor(config = {}) {
    super({ ...config, toolType: SupportedTools.TRAE });
  }

  buildPrompt(taskCard, context = {}) {
    // Similar to Cursor but slightly more concise
    const cursorAdapter = new CursorAdapter(this.config);
    let prompt = cursorAdapter.buildPrompt(taskCard, context);

    // Trae prefers slightly more structured format
    prompt = prompt.replace('## Instructions', '## Implementation Steps');

    return prompt;
  }

  buildSubagentCommand(taskCard, options = {}) {
    return {
      command: 'trae-subagent',
      args: [taskCard.id, this.buildPrompt(taskCard, options.context)],
      readOnly: this.capabilities.subagentReadOnly,
    };
  }
}

/**
 * Windsurf Adapter
 */
export class WindsurfAdapter extends BaseToolAdapter {
  constructor(config = {}) {
    super({ ...config, toolType: SupportedTools.WINDSURF });
  }

  buildPrompt(taskCard, context = {}) {
    const { projectProfile = {}, conventions = {}, designDoc = null } = context;

    return `## ${taskCard.id}: ${taskCard.title}

**Type:** ${taskCard.type} | **Priority:** ${taskCard.priority}

### Overview
${taskCard.description}

### Project Context
- Type: ${projectProfile.type || 'Unknown'}
- Framework: ${projectProfile.frontend?.framework?.name || projectProfile.backend?.framework?.name || 'Unknown'}
- Conventions: ${conventions.componentNaming || 'PascalCase'} components

### Design
${designDoc || 'See design document'}

### Dependencies
${taskCard.dependsOn?.map(id => `- ${id}`).join('\n') || 'None'}

### Deliverables
- ${taskCard.output?.files?.join('\n- ') || 'Implementation files'}
- Unit tests

### Acceptance Criteria
${taskCard.acceptanceCriteria?.map(c => `✓ ${c}`).join('\n') || 'Complete implementation'}
`;
  }

  buildSubagentCommand(taskCard, options = {}) {
    return {
      command: 'windsurf',
      args: ['task', this.buildPrompt(taskCard, options.context)],
      readOnly: this.capabilities.subagentReadOnly,
    };
  }
}

/**
 * Cline Adapter
 * Cline subagent is read-only, needs pseudocode-level instructions
 */
export class ClineAdapter extends BaseToolAdapter {
  constructor(config = {}) {
    super({ ...config, toolType: SupportedTools.CLINE });
  }

  buildPrompt(taskCard, context = {}) {
    // Cline subagent needs very detailed, pseudocode-level instructions
    // because it cannot read existing code context
    const { conventions = {} } = context;

    return `# TASK IMPLEMENTATION: ${taskCard.title}
TASK_ID: ${taskCard.id}

## OBJECTIVE
Implement the following task with exact pseudocode-level instructions.

## TASK DETAILS
${taskCard.description}

## TASK TYPE: ${taskCard.type}

## IMPLEMENTATION STEPS

### Step 1: Setup
1. Navigate to project directory
2. Check current state of files involved

### Step 2: Implementation (EXACT CODE)
\`\`\`
// TODO: Implement ${taskCard.title}
// File: ${taskCard.context?.files?.[0] || 'src/main.js'}

function ${taskCard.id.toLowerCase().replace(/-/g, '_')}_implementation() {
  // ${taskCard.description}
  
  // ACCEPTANCE CRITERIA:
  ${taskCard.acceptanceCriteria?.map((c, i) => `// ${i + 1}. ${c}`).join('\n  ') || '// Implement as described'}
  
  return true;
}
\`\`\`

### Step 3: Testing
\`\`\`
// Add test for ${taskCard.id}
describe('${taskCard.title}', () => {
  it('should ${taskCard.acceptanceCriteria?.[0] || 'pass'}', () => {
    expect(${taskCard.id.toLowerCase().replace(/-/g, '_')}_implementation()).toBe(true);
  });
});
\`\`\`

## PROJECT CONVENTIONS
- Components: ${conventions.componentNaming || 'PascalCase'}
- Files: ${conventions.fileNaming || 'kebab-case'}
- Functions: ${conventions.functionNaming || 'camelCase'}

## DEPENDENCIES
${taskCard.dependsOn?.map(id => `- Complete ${id} first`).join('\n') || 'No dependencies'}

## OUTPUT FORMAT
After completion, report:
1. Files created/modified
2. Code changes summary
3. Test results
4. Any blockers
`;
  }

  buildSubagentCommand(taskCard, options = {}) {
    // Cline subagent is read-only, so we need to provide detailed instructions
    // that can be executed without reading existing code
    return {
      command: 'cline-subagent',
      args: [this.buildPrompt(taskCard, options.context)],
      readOnly: this.capabilities.subagentReadOnly,
      needsFileContext: true,
    };
  }
}

/**
 * Roo Adapter
 * Similar to Cline, read-only subagent
 */
export class RooAdapter extends ClineAdapter {
  constructor(config = {}) {
    super({ ...config, toolType: SupportedTools.ROO });
  }

  buildSubagentCommand(taskCard, options = {}) {
    return {
      command: 'roo-subagent',
      args: [this.buildPrompt(taskCard, options.context)],
      readOnly: this.capabilities.subagentReadOnly,
      needsFileContext: true,
    };
  }
}

/**
 * Copilot Adapter
 * Limited context, needs concise prompts
 */
export class CopilotAdapter extends BaseToolAdapter {
  constructor(config = {}) {
    super({ ...config, toolType: SupportedTools.COPILOT });
  }

  buildPrompt(taskCard, _context = {}) {
    // Very concise for Copilot's limited context
    return `Task: ${taskCard.title}
ID: ${taskCard.id}
Type: ${taskCard.type}
Desc: ${taskCard.description}
Criteria: ${taskCard.acceptanceCriteria?.join('; ') || 'Complete implementation'}
Files: ${taskCard.context?.files?.join(', ') || 'See task details'}`;
  }

  buildSubagentCommand(taskCard, options = {}) {
    return {
      command: 'copilot',
      args: [this.buildPrompt(taskCard, options.context)],
      readOnly: this.capabilities.subagentReadOnly,
    };
  }
}

/**
 * Tool Adapter Factory
 */
export function createToolAdapter(toolType, config = {}) {
  switch (toolType) {
    case SupportedTools.CURSOR:
      return new CursorAdapter(config);
    case SupportedTools.TRAE:
      return new TraeAdapter(config);
    case SupportedTools.WINDSURF:
      return new WindsurfAdapter(config);
    case SupportedTools.CLINE:
      return new ClineAdapter(config);
    case SupportedTools.ROO:
      return new RooAdapter(config);
    case SupportedTools.COPILOT:
      return new CopilotAdapter(config);
    default:
      // Use Cursor as default
      return new CursorAdapter({ ...config, toolType: SupportedTools.CURSOR });
  }
}

/**
 * Get adapter for detected tool
 */
export function getAdapterForTool(toolType, config = {}) {
  return createToolAdapter(toolType, config);
}
