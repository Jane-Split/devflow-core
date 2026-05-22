/**
 * Configuration Management
 * 3-level priority: defaults < global config < project config
 */

import { cosmiconfigSync } from 'cosmiconfig';
import { join } from 'path';
import { homedir } from 'os';
import fs from 'fs-extra';
import { ConfigError, ErrorCodes } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ConfigManager');

/**
 * Default configuration
 */
export const DEFAULT_CONFIG = {
  // Project identification
  project: {
    name: '',
    type: 'auto',
    description: '',
  },

  // AI Tool Configuration
  aiTool: {
    type: 'auto',
    contextLimit: 128000,
  },

  // Memory System
  memory: {
    embeddingModel: 'auto',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    similarityThreshold: 0.7,
    maxResults: 10,
  },

  // Workflow Configuration
  workflow: {
    phases: ['research', 'analyze', 'design', 'split', 'dev', 'test', 'fix', 'regression'],
    autoApprove: false,
    parallelTasks: 3,
  },

  // Testing Configuration
  testing: {
    unitTestFramework: 'auto',
    e2eFramework: 'playwright',
    coverageThreshold: 80,
    browser: 'chromium',
  },

  // Output Configuration
  output: {
    docsDir: './docs',
    specsDir: './docs/specs',
    plansDir: './docs/plans',
  },

  // Paths
  paths: {
    aiMemory: '.ai-memory',
    projectProfile: '.ai-memory/project-profile',
    requirements: '.ai-memory/requirements',
    design: '.ai-memory/design',
    tasks: '.ai-memory/tasks',
    execution: '.ai-memory/execution',
    learning: '.ai-memory/learning',
    vectorIndex: '.ai-memory/vector-index',
  },
};

/**
 * Configuration Manager
 * Handles loading and merging configuration from multiple sources
 */
export class ConfigManager {
  /**
   * @param {string} projectRoot - Project root directory
   */
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.config = null;
    this.explorer = cosmiconfigSync('devflow', {
      searchPlaces: [
        'devflow.config.js',
        'devflow.config.mjs',
        '.devflowrc',
        '.devflowrc.json',
        '.devflowrc.yaml',
        '.devflowrc.yml',
        'package.json',
      ],
    });
  }

  /**
   * Load configuration from all sources
   * Priority: defaults < global config < project config < env vars
   */
  async load() {
    logger.debug('Loading configuration...');

    // Start with defaults
    let config = structuredClone(DEFAULT_CONFIG);

    // Load global config
    const globalConfig = await this._loadGlobalConfig();
    if (globalConfig) {
      logger.debug('Loaded global config');
      config = this._mergeConfig(config, globalConfig);
    }

    // Load project config
    const projectConfig = await this._loadProjectConfig();
    if (projectConfig) {
      logger.debug('Loaded project config');
      config = this._mergeConfig(config, projectConfig);
    }

    // Apply environment variable overrides
    config = this._applyEnvOverrides(config);

    // Validate configuration
    this._validate(config);

    this.config = config;
    logger.debug('Configuration loaded successfully');

    return config;
  }

  /**
   * Get current configuration
   */
  get() {
    if (!this.config) {
      throw new ConfigError(
        'Configuration not loaded. Call load() first.',
        ErrorCodes.CONFIG_NOT_FOUND
      );
    }
    return this.config;
  }

  /**
   * Get a specific config value by path
   * @param {string} path - Dot-separated path (e.g., 'memory.embeddingModel')
   * @param {*} defaultValue - Default value if path not found
   */
  getValue(path, defaultValue = undefined) {
    const config = this.get();
    const keys = path.split('.');
    let value = config;

    for (const key of keys) {
      if (value === null || value === undefined || !(key in value)) {
        return defaultValue;
      }
      value = value[key];
    }

    return value;
  }

  /**
   * Load global configuration from home directory
   */
  async _loadGlobalConfig() {
    const globalConfigPath = join(homedir(), '.devflow', 'config.js');

    try {
      if (await fs.pathExists(globalConfigPath)) {
        const module = await import(globalConfigPath);
        return module.default || module;
      }
    } catch (error) {
      logger.warn(`Failed to load global config: ${error.message}`);
    }

    return null;
  }

  /**
   * Load project configuration
   */
  async _loadProjectConfig() {
    try {
      const result = this.explorer.search(this.projectRoot);
      if (result) {
        // Handle package.json config
        if (result.filepath.endsWith('package.json')) {
          return result.config.devflow;
        }
        return result.config;
      }
    } catch (error) {
      logger.warn(`Failed to load project config: ${error.message}`);
    }

    return null;
  }

  /**
   * Merge two configuration objects
   * Deep merge for nested objects
   */
  _mergeConfig(base, override) {
    const merged = structuredClone(base);

    for (const key in override) {
      if (override[key] === null || override[key] === undefined) {
        continue;
      }

      if (
        typeof override[key] === 'object' &&
        !Array.isArray(override[key]) &&
        key in merged &&
        typeof merged[key] === 'object'
      ) {
        merged[key] = this._mergeConfig(merged[key], override[key]);
      } else {
        merged[key] = override[key];
      }
    }

    return merged;
  }

  /**
   * Apply environment variable overrides
   */
  _applyEnvOverrides(config) {
    const overrides = {};

    if (process.env.DEVFLOW_AI_TOOL) {
      overrides.aiTool = { type: process.env.DEVFLOW_AI_TOOL };
    }

    if (process.env.DEVFLOW_CONTEXT_LIMIT) {
      overrides.aiTool = {
        ...overrides.aiTool,
        contextLimit: parseInt(process.env.DEVFLOW_CONTEXT_LIMIT, 10),
      };
    }

    if (process.env.OPENAI_API_KEY) {
      overrides.memory = { openaiApiKey: process.env.OPENAI_API_KEY };
    }

    if (process.env.DEVFLOW_EMBEDDING_MODEL) {
      overrides.memory = {
        ...overrides.memory,
        embeddingModel: process.env.DEVFLOW_EMBEDDING_MODEL,
      };
    }

    if (process.env.DEVFLOW_PARALLEL_TASKS) {
      overrides.workflow = { parallelTasks: parseInt(process.env.DEVFLOW_PARALLEL_TASKS, 10) };
    }

    return this._mergeConfig(config, overrides);
  }

  /**
   * Validate configuration
   */
  _validate(config) {
    // Validate AI tool type
    const validToolTypes = ['auto', 'cursor', 'trae', 'windsurf', 'cline', 'copilot'];
    if (!validToolTypes.includes(config.aiTool.type)) {
      throw new ConfigError(
        `Invalid AI tool type: ${config.aiTool.type}. Valid types: ${validToolTypes.join(', ')}`,
        ErrorCodes.CONFIG_INVALID,
        { field: 'aiTool.type', value: config.aiTool.type }
      );
    }

    // Validate embedding model
    const validEmbeddingModels = ['auto', 'keyword', 'local', 'openai'];
    if (!validEmbeddingModels.includes(config.memory.embeddingModel)) {
      throw new ConfigError(
        `Invalid embedding model: ${config.memory.embeddingModel}. Valid models: ${validEmbeddingModels.join(', ')}`,
        ErrorCodes.CONFIG_INVALID,
        { field: 'memory.embeddingModel', value: config.memory.embeddingModel }
      );
    }

    // Validate context limit
    if (config.aiTool.contextLimit < 1000) {
      throw new ConfigError(
        `Context limit too small: ${config.aiTool.contextLimit}. Minimum: 1000`,
        ErrorCodes.CONFIG_INVALID,
        { field: 'aiTool.contextLimit', value: config.aiTool.contextLimit }
      );
    }

    // Validate similarity threshold
    if (config.memory.similarityThreshold < 0 || config.memory.similarityThreshold > 1) {
      throw new ConfigError(
        `Similarity threshold out of range: ${config.memory.similarityThreshold}. Must be between 0 and 1`,
        ErrorCodes.CONFIG_INVALID,
        { field: 'memory.similarityThreshold', value: config.memory.similarityThreshold }
      );
    }

    logger.debug('Configuration validation passed');
  }

  /**
   * Save configuration to project config file
   */
  async save(config) {
    const configPath = join(this.projectRoot, 'devflow.config.js');

    const configContent = `/**
 * DevFlow Configuration
 * @see https://github.com/devflow-ai/core#configuration
 */

export default ${JSON.stringify(config, null, 2)};
`;

    await fs.writeFile(configPath, configContent);
    logger.info(`Configuration saved to ${configPath}`);
  }
}

/**
 * Get singleton config manager instance
 */
let configManagerInstance = null;

export function getConfigManager(projectRoot) {
  if (!configManagerInstance || configManagerInstance.projectRoot !== projectRoot) {
    configManagerInstance = new ConfigManager(projectRoot);
  }
  return configManagerInstance;
}
