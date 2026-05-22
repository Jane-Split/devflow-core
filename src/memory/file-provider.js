/**
 * File Memory Provider
 * Markdown-based file storage for human-readable memory
 */

import { join } from 'path';
import fs from 'fs-extra';
import { MemoryProtocol, MemoryCategories, MemoryEntry } from './protocol.js';
import { MemoryError, ErrorCodes } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('FileMemoryProvider');

/**
 * File extension for memory files
 */
const FILE_EXTENSION = '.md';

/**
 * Frontmatter delimiter
 */
const FRONTMATTER_DELIMITER = '---';

/**
 * File-based memory provider
 * Stores memories as Markdown files with YAML frontmatter
 */
export class FileMemoryProvider extends MemoryProtocol {
  /**
   * @param {Object} options - Provider options
   * @param {string} options.basePath - Base path for memory storage
   */
  constructor(options = {}) {
    super();
    this.basePath = options.basePath || '.ai-memory';
    this.initialized = false;
  }

  /**
   * Initialize the provider
   */
  async initialize() {
    logger.debug(`Initializing FileMemoryProvider at ${this.basePath}`);

    // Create base directory
    await fs.ensureDir(this.basePath);

    // Create category directories
    for (const category of Object.values(MemoryCategories)) {
      const categoryPath = join(this.basePath, category);
      await fs.ensureDir(categoryPath);
    }

    this.initialized = true;
    logger.debug('FileMemoryProvider initialized');
  }

  /**
   * Get file path for a memory entry
   */
  _getFilePath(category, id) {
    return join(this.basePath, category, `${id}${FILE_EXTENSION}`);
  }

  /**
   * Parse frontmatter from markdown content
   */
  _parseFrontmatter(content) {
    const lines = content.split('\n');
    
    if (lines[0] !== FRONTMATTER_DELIMITER) {
      return { metadata: {}, body: content };
    }

    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === FRONTMATTER_DELIMITER) {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      return { metadata: {}, body: content };
    }

    const frontmatterLines = lines.slice(1, endIndex);
    const body = lines.slice(endIndex + 1).join('\n').trim();

    // Simple YAML parsing (for basic types)
    const metadata = {};
    for (const line of frontmatterLines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();
        
        // Try to parse as number or boolean
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(value) && value !== '') value = Number(value);
        else if (value.startsWith('[') && value.endsWith(']')) {
          // Parse array
          try {
            value = JSON.parse(value);
          } catch {
            // Keep as string
          }
        }
        
        metadata[key] = value;
      }
    }

    return { metadata, body };
  }

  /**
   * Serialize frontmatter to YAML-like string
   */
  _serializeFrontmatter(metadata) {
    const lines = [FRONTMATTER_DELIMITER];
    
    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || value === undefined) continue;
      
      if (Array.isArray(value)) {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      } else if (typeof value === 'object') {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    
    lines.push(FRONTMATTER_DELIMITER);
    return lines.join('\n');
  }

  /**
   * Read a memory entry
   */
  async read(category, id) {
    this._validateCategory(category);
    this._validateId(id);

    const filePath = this._getFilePath(category, id);

    try {
      if (!(await fs.pathExists(filePath))) {
        throw new MemoryError(
          `Memory entry not found: ${category}/${id}`,
          ErrorCodes.MEMORY_NOT_FOUND,
          { category, id, path: filePath }
        );
      }

      const content = await fs.readFile(filePath, 'utf8');
      const { metadata, body } = this._parseFrontmatter(content);

      return new MemoryEntry({
        id,
        category,
        content: this._parseContent(body),
        metadata,
      });
    } catch (error) {
      if (error instanceof MemoryError) throw error;
      
      throw new MemoryError(
        `Failed to read memory entry: ${error.message}`,
        ErrorCodes.MEMORY_READ_ERROR,
        { category, id, path: filePath }
      );
    }
  }

  /**
   * Parse content body (try JSON, fallback to text)
   */
  _parseContent(body) {
    try {
      return JSON.parse(body);
    } catch {
      return { text: body };
    }
  }

  /**
   * Write a memory entry
   */
  async write(category, id, content, metadata = {}) {
    this._validateCategory(category);
    this._validateId(id);

    const filePath = this._getFilePath(category, id);

    try {
      // Check if entry exists to preserve creation time
      let existingMetadata = {};
      if (await fs.pathExists(filePath)) {
        const existing = await this.read(category, id);
        existingMetadata = existing.metadata;
      }

      // Merge metadata
      const mergedMetadata = this._createMetadata(category, id, {
        ...existingMetadata,
        ...metadata,
        tags: [...(existingMetadata.tags || []), ...(metadata.tags || [])],
      });

      // Serialize content
      const contentStr = typeof content === 'string' 
        ? content 
        : JSON.stringify(content, null, 2);

      // Build file content
      const frontmatter = this._serializeFrontmatter(mergedMetadata);
      const fileContent = `${frontmatter}\n\n${contentStr}`;

      // Write file
      await fs.writeFile(filePath, fileContent, 'utf8');

      logger.debug(`Wrote memory entry: ${category}/${id}`);

      return new MemoryEntry({
        id,
        category,
        content,
        metadata: mergedMetadata,
      });
    } catch (error) {
      if (error instanceof MemoryError) throw error;
      
      throw new MemoryError(
        `Failed to write memory entry: ${error.message}`,
        ErrorCodes.MEMORY_WRITE_ERROR,
        { category, id, path: filePath }
      );
    }
  }

  /**
   * Delete a memory entry
   */
  async delete(category, id) {
    this._validateCategory(category);
    this._validateId(id);

    const filePath = this._getFilePath(category, id);

    try {
      if (!(await fs.pathExists(filePath))) {
        return false;
      }

      await fs.remove(filePath);
      logger.debug(`Deleted memory entry: ${category}/${id}`);
      return true;
    } catch (error) {
      throw new MemoryError(
        `Failed to delete memory entry: ${error.message}`,
        ErrorCodes.MEMORY_WRITE_ERROR,
        { category, id, path: filePath }
      );
    }
  }

  /**
   * List entries in a category
   */
  async list(category, options = {}) {
    this._validateCategory(category);

    const { limit = 100, offset = 0, sortBy = 'updatedAt', sortOrder = 'desc' } = options;
    const categoryPath = join(this.basePath, category);

    try {
      if (!(await fs.pathExists(categoryPath))) {
        return [];
      }

      const files = await fs.readdir(categoryPath);
      const entries = [];

      for (const file of files) {
        if (!file.endsWith(FILE_EXTENSION)) continue;

        const id = file.slice(0, -FILE_EXTENSION.length);
        
        try {
          const metadata = await this.getMetadata(category, id);
          entries.push({
            id,
            category,
            metadata,
          });
        } catch (error) {
          logger.warn(`Failed to read metadata for ${category}/${id}: ${error.message}`);
        }
      }

      // Sort entries
      entries.sort((a, b) => {
        const aVal = a.metadata[sortBy] || '';
        const bVal = b.metadata[sortBy] || '';
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortOrder === 'asc' ? comparison : -comparison;
      });

      // Apply pagination
      return entries.slice(offset, offset + limit);
    } catch (error) {
      throw new MemoryError(
        `Failed to list memory entries: ${error.message}`,
        ErrorCodes.MEMORY_READ_ERROR,
        { category }
      );
    }
  }

  /**
   * Search for entries (basic keyword search)
   */
  async search(query, options = {}) {
    const { category, limit = 10 } = options;
    const categories = category ? [category] : Object.values(MemoryCategories);
    
    const results = [];
    const queryLower = query.toLowerCase();

    for (const cat of categories) {
      const entries = await this.list(cat, { limit: 1000 });

      for (const entry of entries) {
        try {
          const fullEntry = await this.read(cat, entry.id);
          const contentStr = JSON.stringify(fullEntry.content).toLowerCase();
          const metadataStr = JSON.stringify(fullEntry.metadata).toLowerCase();

          if (contentStr.includes(queryLower) || metadataStr.includes(queryLower)) {
            // Calculate simple relevance score
            const contentMatches = (contentStr.match(new RegExp(queryLower, 'g')) || []).length;
            const metadataMatches = (metadataStr.match(new RegExp(queryLower, 'g')) || []).length;
            const score = (contentMatches + metadataMatches * 2) / 100;

            results.push({
              entry: fullEntry,
              score: Math.min(score, 1),
              matchedFields: [],
            });
          }
        } catch (error) {
          logger.warn(`Failed to search entry ${cat}/${entry.id}: ${error.message}`);
        }
      }
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Check if an entry exists
   */
  async exists(category, id) {
    this._validateCategory(category);
    this._validateId(id);

    const filePath = this._getFilePath(category, id);
    return fs.pathExists(filePath);
  }

  /**
   * Get entry metadata
   */
  async getMetadata(category, id) {
    this._validateCategory(category);
    this._validateId(id);

    const filePath = this._getFilePath(category, id);

    try {
      if (!(await fs.pathExists(filePath))) {
        throw new MemoryError(
          `Memory entry not found: ${category}/${id}`,
          ErrorCodes.MEMORY_NOT_FOUND,
          { category, id }
        );
      }

      const content = await fs.readFile(filePath, 'utf8');
      const { metadata } = this._parseFrontmatter(content);
      return metadata;
    } catch (error) {
      if (error instanceof MemoryError) throw error;
      
      throw new MemoryError(
        `Failed to get metadata: ${error.message}`,
        ErrorCodes.MEMORY_READ_ERROR,
        { category, id }
      );
    }
  }

  /**
   * Update entry metadata
   */
  async updateMetadata(category, id, metadata) {
    const entry = await this.read(category, id);
    const newMetadata = { ...entry.metadata, ...metadata, updatedAt: new Date().toISOString() };
    await this.write(category, id, entry.content, newMetadata);
    return newMetadata;
  }

  /**
   * Export memory data
   */
  async export(options = {}) {
    const { categories } = options;
    const catsToExport = categories || Object.values(MemoryCategories);
    
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      entries: {},
    };

    for (const category of catsToExport) {
      const entries = await this.list(category, { limit: 10000 });
      data.entries[category] = [];

      for (const entry of entries) {
        const fullEntry = await this.read(category, entry.id);
        data.entries[category].push(fullEntry.toObject());
      }
    }

    return data;
  }

  /**
   * Import memory data
   */
  async import(data, options = {}) {
    const { overwrite = false } = options;
    let imported = 0;
    let skipped = 0;

    for (const [category, entries] of Object.entries(data.entries || {})) {
      for (const entryData of entries) {
        const exists = await this.exists(category, entryData.id);
        
        if (exists && !overwrite) {
          skipped++;
          continue;
        }

        await this.write(category, entryData.id, entryData.content, entryData.metadata);
        imported++;
      }
    }

    return { imported, skipped };
  }
}
