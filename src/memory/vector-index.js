/**
 * Vector Index
 * In-memory vector storage with cosine similarity search
 */

import { ErrorCodes, MemoryError } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';
import { createEmbeddingProvider } from './embedding.js';

const logger = new Logger('VectorIndex');

/**
 * Vector Index for semantic search
 */
export class VectorIndex {
  /**
   * @param {Object} options - Index options
   * @param {Object} options.embeddingConfig - Embedding provider config
   * @param {number} options.similarityThreshold - Minimum similarity score (0-1)
   * @param {number} options.maxResults - Maximum search results
   */
  constructor(options = {}) {
    this.embeddingConfig = options.embeddingConfig || {};
    this.similarityThreshold = options.similarityThreshold || 0.7;
    this.maxResults = options.maxResults || 10;

    this.embeddingProvider = null;
    this.vectors = new Map(); // id -> { vector, metadata }
    this.initialized = false;
  }

  /**
   * Initialize the index
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    logger.debug('Initializing vector index...');

    this.embeddingProvider = createEmbeddingProvider(this.embeddingConfig);
    await this.embeddingProvider.initialize();

    logger.debug(`Vector index initialized with ${this.embeddingProvider.getActiveProviderName()}`);
    this.initialized = true;
  }

  /**
   * Add a document to the index
   * @param {string} id - Document ID
   * @param {string} text - Document text
   * @param {Object} metadata - Document metadata
   */
  async add(id, text, metadata = {}) {
    await this.initialize();

    try {
      const vector = await this.embeddingProvider.embed(text);

      this.vectors.set(id, {
        vector,
        text,
        metadata: {
          ...metadata,
          id,
          addedAt: new Date().toISOString(),
        },
      });

      logger.debug(`Added document to index: ${id}`);
    } catch (error) {
      throw new MemoryError(
        `Failed to add document to index: ${error.message}`,
        ErrorCodes.VECTOR_INDEX_ERROR,
        { id }
      );
    }
  }

  /**
   * Add multiple documents to the index
   * @param {Array<{id: string, text: string, metadata?: Object}>} documents
   */
  async addBatch(documents) {
    await this.initialize();

    const texts = documents.map(d => d.text);
    const embeddings = await this.embeddingProvider.embedBatch(texts);

    for (let i = 0; i < documents.length; i++) {
      const { id, text, metadata = {} } = documents[i];

      this.vectors.set(id, {
        vector: embeddings[i],
        text,
        metadata: {
          ...metadata,
          id,
          addedAt: new Date().toISOString(),
        },
      });
    }

    logger.debug(`Added ${documents.length} documents to index`);
  }

  /**
   * Remove a document from the index
   * @param {string} id - Document ID
   */
  remove(id) {
    const existed = this.vectors.has(id);
    this.vectors.delete(id);

    if (existed) {
      logger.debug(`Removed document from index: ${id}`);
    }

    return existed;
  }

  /**
   * Search for similar documents
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array<{id: string, score: number, text: string, metadata: Object}>}
   */
  async search(query, options = {}) {
    await this.initialize();

    const { threshold = this.similarityThreshold, limit = this.maxResults, filter } = options;

    try {
      const queryVector = await this.embeddingProvider.embed(query);
      const results = [];

      for (const [id, entry] of this.vectors) {
        // Apply metadata filter if provided
        if (filter && !this._matchesFilter(entry.metadata, filter)) {
          continue;
        }

        const score = this._cosineSimilarity(queryVector, entry.vector);

        if (score >= threshold) {
          results.push({
            id,
            score,
            text: entry.text,
            metadata: entry.metadata,
          });
        }
      }

      // Sort by score (descending) and limit
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, limit);
    } catch (error) {
      throw new MemoryError(`Search failed: ${error.message}`, ErrorCodes.VECTOR_INDEX_ERROR);
    }
  }

  /**
   * Check if metadata matches filter
   */
  _matchesFilter(metadata, filter) {
    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  _cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get document by ID
   * @param {string} id - Document ID
   */
  get(id) {
    const entry = this.vectors.get(id);
    if (!entry) {
      return null;
    }

    return {
      id,
      text: entry.text,
      metadata: entry.metadata,
    };
  }

  /**
   * Check if document exists
   * @param {string} id - Document ID
   */
  has(id) {
    return this.vectors.has(id);
  }

  /**
   * Get all document IDs
   */
  getAllIds() {
    return Array.from(this.vectors.keys());
  }

  /**
   * Get index size
   */
  size() {
    return this.vectors.size;
  }

  /**
   * Clear all documents
   */
  clear() {
    this.vectors.clear();
    logger.debug('Vector index cleared');
  }

  /**
   * Export index to serializable format
   */
  export() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      embeddingProvider: this.embeddingProvider?.getActiveProviderName() || 'unknown',
      vectors: {},
    };

    for (const [id, entry] of this.vectors) {
      data.vectors[id] = {
        vector: entry.vector,
        text: entry.text,
        metadata: entry.metadata,
      };
    }

    return data;
  }

  /**
   * Import index from serialized format
   * @param {Object} data - Exported data
   */
  async import(data) {
    this.vectors.clear();

    for (const [id, entry] of Object.entries(data.vectors || {})) {
      this.vectors.set(id, entry);
    }

    logger.debug(`Imported ${this.vectors.size} vectors`);
  }

  /**
   * Get embedding dimension
   */
  getDimension() {
    return this.embeddingProvider?.getDimension() || 0;
  }
}

/**
 * Persistent Vector Index
 * Saves/loads from disk
 */
export class PersistentVectorIndex extends VectorIndex {
  /**
   * @param {Object} options - Index options
   * @param {string} options.storagePath - Path to store index
   */
  constructor(options = {}) {
    super(options);
    this.storagePath = options.storagePath;
  }

  /**
   * Load index from disk
   */
  async load() {
    if (!this.storagePath) {
      return;
    }

    try {
      const fs = await import('fs-extra');

      if (await fs.pathExists(this.storagePath)) {
        const data = await fs.readJson(this.storagePath);
        await this.import(data);
        logger.debug(`Loaded vector index from ${this.storagePath}`);
      }
    } catch (error) {
      logger.warn(`Failed to load vector index: ${error.message}`);
    }
  }

  /**
   * Save index to disk
   */
  async save() {
    if (!this.storagePath) {
      return;
    }

    try {
      const fs = await import('fs-extra');
      await fs.ensureDir(require('path').dirname(this.storagePath));
      await fs.writeJson(this.storagePath, this.export(), { spaces: 2 });
      logger.debug(`Saved vector index to ${this.storagePath}`);
    } catch (error) {
      logger.warn(`Failed to save vector index: ${error.message}`);
    }
  }

  /**
   * Add and save
   */
  async add(id, text, metadata = {}) {
    await super.add(id, text, metadata);
    await this.save();
  }

  /**
   * Add batch and save
   */
  async addBatch(documents) {
    await super.addBatch(documents);
    await this.save();
  }

  /**
   * Remove and save
   */
  async remove(id) {
    const existed = super.remove(id);
    if (existed) {
      await this.save();
    }
    return existed;
  }
}
