/**
 * Memory Protocol
 * Unified interface for memory operations with category-based organization
 */

import { MemoryError, ErrorCodes } from '../utils/errors.js';

/**
 * Memory categories
 * Organizes different types of information
 */
export const MemoryCategories = {
  // Project information
  PROJECT_PROFILE: 'project-profile',
  REQUIREMENT: 'requirements',
  DESIGN: 'design',
  
  // Task management
  TASK: 'tasks',
  TASK_CARD: 'task-cards',
  
  // Execution tracking
  EXECUTION: 'execution',
  EXECUTION_LOG: 'execution-logs',
  
  // Learning and patterns
  LEARNING: 'learning',
  PATTERN: 'patterns',
  PITFALL: 'pitfalls',
  
  // Vector index
  VECTOR_INDEX: 'vector-index',
};

/**
 * Memory metadata schema
 * Standard metadata for all memory entries
 */
export const MemoryMetadataSchema = {
  id: 'string',           // Unique identifier
  category: 'string',     // Memory category
  createdAt: 'string',    // ISO timestamp
  updatedAt: 'string',    // ISO timestamp
  version: 'number',      // Version for optimistic locking
  tags: 'array',          // Array of string tags
  source: 'string',       // Source of the memory (e.g., 'analyzer', 'orchestrator')
  embedding: 'object',    // Optional embedding vector
};

/**
 * Base Memory Protocol interface
 * All memory providers must implement this
 */
export class MemoryProtocol {
  /**
   * Initialize the memory provider
   */
  async initialize() {
    throw new MemoryError(
      'initialize() must be implemented by subclass',
      ErrorCodes.NOT_IMPLEMENTED
    );
  }

  /**
   * Read a memory entry
   * @param {string} category - Memory category
   * @param {string} id - Entry identifier
   * @returns {Promise<Object>} Memory entry with content and metadata
   */
  async read(category, id) {
    throw new MemoryError(
      'read() must be implemented by subclass',
      ErrorCodes.NOT_IMPLEMENTED
    );
  }

  /**
   * Write a memory entry
   * @param {string} category - Memory category
   * @param {string} id - Entry identifier
   * @param {Object} content - Entry content
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<Object>} Written entry
   */
  async write(category, id, content, metadata = {}) {
    throw new MemoryError(
      'write() must be implemented by subclass',
      ErrorCodes.NOT_IMPLEMENTED
    );
  }

  /**
   * Delete a memory entry
   * @param {string} category - Memory category
   * @param {string} id - Entry identifier
   * @returns {Promise<boolean>} Success status
   */
  async delete(category, id) {
    throw new MemoryError(
      'delete() must be implemented by subclass',
      ErrorCodes.NOT_IMPLEMENTED
    );
  }

  /**
   * List entries in a category
   * @param {string} category - Memory category
   * @param {Object} options - List options (limit, offset, sort)
   * @returns {Promise<Array>} List of entry summaries
   */
  async list(category, options = {}) {
    throw new MemoryError(
      'list() must be implemented by subclass',
      ErrorCodes.NOT_IMPLEMENTED
    );
  }

  /**
   * Search for entries
   * @param {string} query - Search query
   * @param {Object} options - Search options (category, limit, threshold)
   * @returns {Promise<Array>} Search results with scores
   */
  async search(query, options = {}) {
    throw new MemoryError(
      'search() must be implemented by subclass',
      ErrorCodes.NOT_IMPLEMENTED
    );
  }

  /**
   * Check if an entry exists
   * @param {string} category - Memory category
   * @param {string} id - Entry identifier
   * @returns {Promise<boolean>} Existence status
   */
  async exists(category, id) {
    throw new MemoryError(
      'exists() must be implemented by subclass',
      ErrorCodes.NOT_IMPLEMENTED
    );
  }

  /**
   * Get entry metadata without content
   * @param {string} category - Memory category
   * @param {string} id - Entry identifier
   * @returns {Promise<Object>} Entry metadata
   */
  async getMetadata(category, id) {
    throw new MemoryError(
      'getMetadata() must be implemented by subclass',
      ErrorCodes.NOT_IMPLEMENTED
    );
  }

  /**
   * Update entry metadata
   * @param {string} category - Memory category
   * @param {string} id - Entry identifier
   * @param {Object} metadata - Metadata updates
   * @returns {Promise<Object>} Updated metadata
   */
  async updateMetadata(category, id, metadata) {
    throw new MemoryError(
      'updateMetadata() must be implemented by subclass',
      ErrorCodes.NOT_IMPLEMENTED
    );
  }

  /**
   * Export memory data
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Exported data
   */
  async export(options = {}) {
    throw new MemoryError(
      'export() must be implemented by subclass',
      ErrorCodes.NOT_IMPLEMENTED
    );
  }

  /**
   * Import memory data
   * @param {Object} data - Data to import
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async import(data, options = {}) {
    throw new MemoryError(
      'import() must be implemented by subclass',
      ErrorCodes.NOT_IMPLEMENTED
    );
  }

  /**
   * Validate category
   * @param {string} category - Category to validate
   */
  _validateCategory(category) {
    const validCategories = Object.values(MemoryCategories);
    if (!validCategories.includes(category)) {
      throw new MemoryError(
        `Invalid memory category: ${category}. Valid categories: ${validCategories.join(', ')}`,
        ErrorCodes.MEMORY_WRITE_ERROR,
        { category }
      );
    }
  }

  /**
   * Validate ID
   * @param {string} id - ID to validate
   */
  _validateId(id) {
    if (!id || typeof id !== 'string') {
      throw new MemoryError(
        'Invalid memory ID: must be a non-empty string',
        ErrorCodes.MEMORY_WRITE_ERROR,
        { id }
      );
    }

    // Sanitize ID (prevent directory traversal)
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw new MemoryError(
        'Invalid memory ID: cannot contain path separators',
        ErrorCodes.MEMORY_WRITE_ERROR,
        { id }
      );
    }
  }

  /**
   * Create standard metadata
   * @param {string} category - Memory category
   * @param {string} id - Entry ID
   * @param {Object} overrides - Metadata overrides
   */
  _createMetadata(category, id, overrides = {}) {
    const now = new Date().toISOString();
    
    return {
      id,
      category,
      createdAt: overrides.createdAt || now,
      updatedAt: now,
      version: (overrides.version || 0) + 1,
      tags: overrides.tags || [],
      source: overrides.source || 'unknown',
      embedding: overrides.embedding || null,
      ...overrides,
    };
  }
}

/**
 * Memory entry structure
 */
export class MemoryEntry {
  /**
   * @param {Object} data - Entry data
   */
  constructor(data = {}) {
    this.id = data.id || '';
    this.category = data.category || '';
    this.content = data.content || {};
    this.metadata = data.metadata || {};
  }

  /**
   * Convert to plain object
   */
  toObject() {
    return {
      id: this.id,
      category: this.category,
      content: this.content,
      metadata: this.metadata,
    };
  }

  /**
   * Create from plain object
   */
  static fromObject(obj) {
    return new MemoryEntry(obj);
  }
}

/**
 * Memory search result
 */
export class MemorySearchResult {
  /**
   * @param {Object} data - Result data
   */
  constructor(data = {}) {
    this.entry = data.entry || null;
    this.score = data.score || 0;
    this.matchedFields = data.matchedFields || [];
  }
}
