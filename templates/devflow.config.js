/**
 * DevFlow Configuration
 * @type {import('@devflow-ai/core').DevFlowConfig}
 */
export default {
  // Project information
  project: {
    name: '{{PROJECT_NAME}}',
    type: '{{PROJECT_TYPE}}', // frontend | backend | fullstack | microservice
  },

  // AI Tool configuration
  tool: {
    // Preferred AI tool: cursor | trae | windsurf | cline | roo | copilot
    preferred: 'cursor',

    // Context limit override (use tool default if not set)
    // contextLimit: 128000,

    // Enable subagent for parallel execution
    enableSubagent: true,

    // Maximum parallel tasks
    maxParallelTasks: 3,
  },

  // Memory configuration
  memory: {
    // Memory storage directory
    directory: '.ai-memory',

    // Enable vector index for semantic search
    enableVectorIndex: true,

    // Embedding provider: keyword | local | openai
    embeddingProvider: 'keyword',

    // OpenAI API key (if using openai embedding)
    // openaiApiKey: process.env.OPENAI_API_KEY,
  },

  // Workflow configuration
  workflow: {
    // Phases to execute (in order)
    phases: [
      'research',
      'analyze',
      'design',
      'split',
      'dev',
      'test',
      'fix',
      'regression',
    ],

    // Auto-approve phase transitions
    autoApprove: false,

    // Stop on first failure
    stopOnFailure: true,
  },

  // Testing configuration
  testing: {
    // Test frameworks
    unit: {
      framework: 'jest',
      command: 'npm test',
    },

    integration: {
      framework: 'jest',
      command: 'npm run test:integration',
    },

    e2e: {
      framework: 'playwright',
      command: 'npx playwright test',
      headed: false,
    },

    // Minimum coverage threshold
    coverageThreshold: 80,
  },

  // Token budget configuration
  tokenBudget: {
    // Maximum context tokens
    maxTokens: 128000,

    // Enable compression pipeline
    enableCompression: true,

    // Compression steps to use
    compressionSteps: [
      'compress-design',
      'summarize-code',
      'remove-retrieval',
      'compress-task',
      'split-subtask',
    ],
  },

  // Logging configuration
  logging: {
    level: 'info', // debug | info | warn | error
    file: '.ai-memory/devflow.log',
  },
};
