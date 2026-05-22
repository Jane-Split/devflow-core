/**
 * Memory Manager
 * Unified entry point for all memory operations
 * Combines file-based storage with vector search
 */

import { join } from 'path';
import { FileMemoryProvider } from './file-provider.js';
import { PersistentVectorIndex } from './vector-index.js';
import { MemoryCategories } from './protocol.js';
import { MemoryError, ErrorCodes } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('MemoryManager');

/**
 * Memory Manager
 * Provides unified interface for memory storage and retrieval
 */
export class MemoryManager {
  /**
   * @param {Object} options - Manager options
   * @param {string} options.projectRoot - Project root directory
   * @param {Object} options.config - Memory configuration
   */
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.config = options.config || {};
    
    this.fileProvider = null;
    this.vectorIndex = null;
    this.initialized = false;
  }

  /**
   * Initialize memory manager
   */
  async initialize() {
    if (this.initialized) return;

    logger.debug('Initializing MemoryManager...');

    const memoryPath = join(this.projectRoot, this.config.paths?.aiMemory || '.ai-memory');
    const vectorIndexPath = join(memoryPath, 'vector-index', 'index.json');

    // Initialize file provider
    this.fileProvider = new FileMemoryProvider({ basePath: memoryPath });
    await this.fileProvider.initialize();

    // Initialize vector index
    this.vectorIndex = new PersistentVectorIndex({
      storagePath: vectorIndexPath,
      embeddingConfig: {
        preferred: this.config.memory?.embeddingModel || 'auto',
        apiKey: this.config.memory?.openaiApiKey,
      },
      similarityThreshold: this.config.memory?.similarityThreshold || 0.7,
      maxResults: this.config.memory?.maxResults || 10,
    });

    await this.vectorIndex.initialize();
    await this.vectorIndex.load();

    this.initialized = true;
    logger.debug('MemoryManager initialized');
  }

  /**
   * Store a memory entry
   * @param {string} category - Memory category
   * @param {string} id - Entry ID
   * @param {Object} content - Entry content
   * @param {Object} options - Store options
   */
  async store(category, id, content, options = {}) {
    await this.initialize();

    const { 
      metadata = {}, 
      indexForSearch = true,
      searchText,
    } = options;

    try {
      // Store in file provider
      const entry = await this.fileProvider.write(category, id, content, {
        ...metadata,
        source: metadata.source || 'memory-manager',
      });

      // Index for search if requested
      if (indexForSearch) {
        const textToIndex = searchText || this._extractSearchableText(content);
        if (textToIndex) {
          await this.vectorIndex.add(`${category}:${id}`, textToIndex, {
            category,
            id,
            ...metadata,
          });
        }
      }

      logger.debug(`Stored memory: ${category}/${id}`);
      return entry;
    } catch (error) {
      throw new MemoryError(
        `Failed to store memory: ${error.message}`,
        ErrorCodes.MEMORY_WRITE_ERROR,
        { category, id }
      );
    }
  }

  /**
   * Retrieve a memory entry
   * @param {string} category - Memory category
   * @param {string} id - Entry ID
   */
  async retrieve(category, id) {
    await this.initialize();

    try {
      return await this.fileProvider.read(category, id);
    } catch (error) {
      if (error.code === ErrorCodes.MEMORY_NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if memory exists
   * @param {string} category - Memory category
   * @param {string} id - Entry ID
   */
  async exists(category, id) {
    await this.initialize();
    return this.fileProvider.exists(category, id);
  }

  /**
   * Delete a memory entry
   * @param {string} category - Memory category
   * @param {string} id - Entry ID
   */
  async delete(category, id) {
    await this.initialize();

    try {
      // Delete from file provider
      const deleted = await this.fileProvider.delete(category, id);

      // Remove from vector index
      await this.vectorIndex.remove(`${category}:${id}`);

      if (deleted) {
        logger.debug(`Deleted memory: ${category}/${id}`);
      }

      return deleted;
    } catch (error) {
      throw new MemoryError(
        `Failed to delete memory: ${error.message}`,
        ErrorCodes.MEMORY_WRITE_ERROR,
        { category, id }
      );
    }
  }

  /**
   * List memories in a category
   * @param {string} category - Memory category
   * @param {Object} options - List options
   */
  async list(category, options = {}) {
    await this.initialize();
    return this.fileProvider.list(category, options);
  }

  /**
   * Search memories
   * @param {string} query - Search query
   * @param {Object} options - Search options
   */
  async search(query, options = {}) {
    await this.initialize();

    const { category, limit = 10, threshold } = options;

    try {
      // Search vector index
      const results = await this.vectorIndex.search(query, {
        limit,
        threshold,
        filter: category ? { category } : undefined,
      });

      // Enrich with full content
      const enrichedResults = [];
      for (const result of results) {
        const entry = await this.retrieve(result.metadata.category, result.metadata.id);
        if (entry) {
          enrichedResults.push({
            ...result,
            entry,
          });
        }
      }

      return enrichedResults;
    } catch (error) {
      throw new MemoryError(
        `Search failed: ${error.message}`,
        ErrorCodes.MEMORY_READ_ERROR
      );
    }
  }

  /**
   * Update memory metadata
   * @param {string} category - Memory category
   * @param {string} id - Entry ID
   * @param {Object} metadata - Metadata updates
   */
  async updateMetadata(category, id, metadata) {
    await this.initialize();
    return this.fileProvider.updateMetadata(category, id, metadata);
  }

  /**
   * Export all memories
   * @param {Object} options - Export options
   */
  async export(options = {}) {
    await this.initialize();

    const data = await this.fileProvider.export(options);
    data.vectorIndex = this.vectorIndex.export();

    return data;
  }

  /**
   * Import memories
   * @param {Object} data - Data to import
   * @param {Object} options - Import options
   */
  async import(data, options = {}) {
    await this.initialize();

    const result = await this.fileProvider.import(data, options);

    // Rebuild vector index
    if (data.vectorIndex) {
      await this.vectorIndex.import(data.vectorIndex);
    }

    return result;
  }

  /**
   * Get project profile
   */
  async getProjectProfile() {
    return this.retrieve(MemoryCategories.PROJECT_PROFILE, 'main');
  }

  /**
   * Store project profile
   * @param {Object} profile - Project profile
   */
  async storeProjectProfile(profile) {
    return this.store(MemoryCategories.PROJECT_PROFILE, 'main', profile, {
      metadata: { source: 'analyzer' },
    });
  }

  /**
   * Get requirements
   * @param {string} id - Requirement ID
   */
  async getRequirements(id = 'latest') {
    return this.retrieve(MemoryCategories.REQUIREMENT, id);
  }

  /**
   * Store requirements
   * @param {string} id - Requirement ID
   * @param {Object} requirements - Requirements content
   */
  async storeRequirements(id, requirements) {
    return this.store(MemoryCategories.REQUIREMENT, id, requirements, {
      metadata: { source: 'user-input' },
    });
  }

  /**
   * Get design document
   * @param {string} id - Design ID
   */
  async getDesign(id = 'latest') {
    return this.retrieve(MemoryCategories.DESIGN, id);
  }

  /**
   * Store design document
   * @param {string} id - Design ID
   * @param {Object} design - Design content
   */
  async storeDesign(id, design) {
    return this.store(MemoryCategories.DESIGN, id, design, {
      metadata: { source: 'design-phase' },
    });
  }

  /**
   * Get task card
   * @param {string} id - Task ID
   */
  async getTaskCard(id) {
    return this.retrieve(MemoryCategories.TASK_CARD, id);
  }

  /**
   * Store task card
   * @param {string} id - Task ID
   * @param {Object} taskCard - Task card content
   */
  async storeTaskCard(id, taskCard) {
    return this.store(MemoryCategories.TASK_CARD, id, taskCard, {
      metadata: { 
        source: 'split-phase',
        status: taskCard.status || 'pending',
        priority: taskCard.priority || 'medium',
      },
    });
  }

  /**
   * Record execution log
   * @param {string} taskId - Task ID
   * @param {Object} log - Execution log
   */
  async recordExecutionLog(taskId, log) {
    const id = `${taskId}-${Date.now()}`;
    return this.store(MemoryCategories.EXECUTION_LOG, id, log, {
      metadata: { 
        source: 'execution',
        taskId,
        timestamp: new Date().toISOString(),
      },
      indexForSearch: false,
    });
  }

  /**
   * Record pattern
   * @param {Object} pattern - Pattern to record
   */
  async recordPattern(pattern) {
    const id = `pattern-${Date.now()}`;
    return this.store(MemoryCategories.PATTERN, id, pattern, {
      metadata: {
        source: 'learning',
        category: pattern.category,
        tags: pattern.tags || [],
      },
    });
  }

  /**
   * Record pitfall
   * @param {Object} pitfall - Pitfall to record
   */
  async recordPitfall(pitfall) {
    const id = `pitfall-${Date.now()}`;
    return this.store(MemoryCategories.PITFALL, id, pitfall, {
      metadata: {
        source: 'learning',
        category: pitfall.category,
        tags: pitfall.tags || [],
      },
    });
  }

  /**
   * Find similar patterns
   * @param {string} context - Context to search for
   * @param {Object} options - Search options
   */
  async findSimilarPatterns(context, options = {}) {
    return this.search(context, {
      category: MemoryCategories.PATTERN,
      limit: options.limit || 5,
    });
  }

  /**
   * Find relevant pitfalls
   * @param {string} context - Context to search for
   * @param {Object} options - Search options
   */
  async findRelevantPitfalls(context, options = {}) {
    return this.search(context, {
      category: MemoryCategories.PITFALL,
      limit: options.limit || 5,
    });
  }

  /**
   * Extract searchable text from content
   */
  _extractSearchableText(content) {
    if (typeof content === 'string') {
      return content;
    }

    if (typeof content === 'object') {
      // Extract text from common fields
      const textFields = ['text', 'description', 'content', 'summary', 'title'];
      const texts = [];

      for (const field of textFields) {
        if (content[field]) {
          texts.push(String(content[field]));
        }
      }

      // Also include all string values
      for (const value of Object.values(content)) {
        if (typeof value === 'string') {
          texts.push(value);
        }
      }

      return texts.join(' ');
    }

    return String(content);
  }

  /**
   * Get statistics
   */
  async getStats() {
    await this.initialize();

    const stats = {
      categories: {},
      vectorIndex: {
        size: this.vectorIndex.size(),
        dimension: this.vectorIndex.getDimension(),
      },
    };

    for (const category of Object.values(MemoryCategories)) {
      try {
        const entries = await this.list(category);
        stats.categories[category] = entries.length;
      } catch {
        stats.categories[category] = 0;
      }
    }

    return stats;
  }
}

/**
 * Get singleton memory manager instance
 */
let managerInstance = null;

export function getMemoryManager(projectRoot, config) {
  if (!managerInstance || managerInstance.projectRoot !== projectRoot) {
    managerInstance = new MemoryManager({ projectRoot, config });
  }
  return managerInstance;
}
