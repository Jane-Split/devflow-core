/**
 * Embedding Provider
 * 3-level strategy: Keyword (zero dep) -> Local ONNX -> OpenAI API
 * Automatic fallback from top to bottom
 */

import { ErrorCodes, MemoryError } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('EmbeddingProvider');

/**
 * Embedding model types
 */
export const EmbeddingModelType = {
  KEYWORD: 'keyword',
  LOCAL: 'local',
  OPENAI: 'openai',
};

/**
 * Base embedding provider interface
 */
export class BaseEmbeddingProvider {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Initialize the provider
   */
  async initialize() {
    // Override in subclass
  }

  /**
   * Generate embedding for text
   * @param {string} text - Input text
   * @returns {Promise<number[]>} Embedding vector
   */
  async embed(_text) {
    throw new MemoryError('embed() must be implemented by subclass', ErrorCodes.NOT_IMPLEMENTED);
  }

  /**
   * Generate embeddings for multiple texts
   * @param {string[]} texts - Input texts
   * @returns {Promise<number[][]>} Embedding vectors
   */
  async embedBatch(texts) {
    const embeddings = [];
    for (const text of texts) {
      embeddings.push(await this.embed(text));
    }
    return embeddings;
  }

  /**
   * Get embedding dimension
   */
  getDimension() {
    return 0;
  }

  /**
   * Check if provider is available
   */
  isAvailable() {
    return true;
  }
}

/**
 * Keyword-based embedding (zero dependency fallback)
 * Uses TF-IDF-like approach with simple tokenization
 */
export class KeywordEmbeddingProvider extends BaseEmbeddingProvider {
  constructor(config = {}) {
    super(config);
    this.vocabulary = new Map();
    this.dimension = config.dimension || 1000;
  }

  /**
   * Simple tokenization
   */
  _tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  /**
   * Hash token to index
   */
  _hashToken(token) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % this.dimension;
  }

  /**
   * Generate keyword-based embedding
   */
  async embed(text) {
    const tokens = this._tokenize(text);
    const embedding = new Array(this.dimension).fill(0);

    // Count token frequencies
    const tokenCounts = new Map();
    for (const token of tokens) {
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    }

    // Build embedding based on token hashes
    for (const [token, count] of tokenCounts) {
      const index = this._hashToken(token);
      // TF-like weighting
      embedding[index] += Math.log(1 + count);
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }

    return embedding;
  }

  getDimension() {
    return this.dimension;
  }
}

/**
 * Local ONNX embedding provider
 * Uses lightweight local models
 */
export class LocalEmbeddingProvider extends BaseEmbeddingProvider {
  constructor(config = {}) {
    super(config);
    this.model = null;
    this.pipeline = null;
    this.dimension = 384; // Default for all-MiniLM-L6-v2
  }

  /**
   * Initialize local model
   */
  async initialize() {
    try {
      // Dynamic import to avoid hard dependency
      const { pipeline } = await import('@xenova/transformers');
      this.pipeline = pipeline;

      // Use lightweight model
      this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      logger.debug('Local embedding model loaded');
    } catch (error) {
      throw new MemoryError(
        `Failed to load local embedding model: ${error.message}`,
        ErrorCodes.EMBEDDING_ERROR,
        { model: 'Xenova/all-MiniLM-L6-v2' }
      );
    }
  }

  /**
   * Generate embedding using local model
   */
  async embed(text) {
    if (!this.model) {
      await this.initialize();
    }

    try {
      const output = await this.model(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      throw new MemoryError(
        `Failed to generate embedding: ${error.message}`,
        ErrorCodes.EMBEDDING_ERROR
      );
    }
  }

  getDimension() {
    return this.dimension;
  }

  /**
   * Check if local model is available
   */
  isAvailable() {
    try {
      // Check if optional dependency is installed
      require.resolve('@xenova/transformers');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * OpenAI API embedding provider
 */
export class OpenAIEmbeddingProvider extends BaseEmbeddingProvider {
  constructor(config = {}) {
    super(config);
    this.client = null;
    this.model = config.model || 'text-embedding-3-small';
    this.dimension = config.dimension || 1536;
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
  }

  /**
   * Initialize OpenAI client
   */
  async initialize() {
    if (!this.apiKey) {
      throw new MemoryError('OpenAI API key not provided', ErrorCodes.EMBEDDING_ERROR);
    }

    try {
      const { OpenAI } = await import('openai');
      this.client = new OpenAI({ apiKey: this.apiKey });
      logger.debug('OpenAI client initialized');
    } catch (error) {
      throw new MemoryError(
        `Failed to initialize OpenAI client: ${error.message}`,
        ErrorCodes.EMBEDDING_ERROR
      );
    }
  }

  /**
   * Generate embedding using OpenAI API
   */
  async embed(text) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      throw new MemoryError(`OpenAI API error: ${error.message}`, ErrorCodes.EMBEDDING_ERROR);
    }
  }

  /**
   * Generate embeddings for multiple texts (batch API call)
   */
  async embedBatch(texts) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
      });

      return response.data.map(d => d.embedding);
    } catch (error) {
      throw new MemoryError(`OpenAI API error: ${error.message}`, ErrorCodes.EMBEDDING_ERROR);
    }
  }

  getDimension() {
    return this.dimension;
  }

  /**
   * Check if OpenAI is available
   */
  isAvailable() {
    return !!this.apiKey;
  }
}

/**
 * Smart embedding provider with automatic fallback
 */
export class SmartEmbeddingProvider extends BaseEmbeddingProvider {
  /**
   * @param {Object} config - Configuration
   * @param {string} config.preferred - Preferred model type
   * @param {string} config.apiKey - OpenAI API key
   */
  constructor(config = {}) {
    super(config);
    this.preferred = config.preferred || EmbeddingModelType.AUTO;
    this.providers = [];
    this.activeProvider = null;
  }

  /**
   * Initialize with fallback chain
   */
  async initialize() {
    logger.debug(`Initializing smart embedding provider (preferred: ${this.preferred})`);

    // Build provider chain based on preference
    const providerChain = this._buildProviderChain();

    for (const ProviderClass of providerChain) {
      try {
        const provider = new ProviderClass(this.config);

        if (!provider.isAvailable()) {
          logger.debug(`${ProviderClass.name} not available, skipping`);
          continue;
        }

        await provider.initialize();
        this.activeProvider = provider;
        logger.info(`Using embedding provider: ${ProviderClass.name}`);
        return;
      } catch (error) {
        logger.warn(`Failed to initialize ${ProviderClass.name}: ${error.message}`);
      }
    }

    throw new MemoryError('No embedding provider available', ErrorCodes.EMBEDDING_ERROR);
  }

  /**
   * Build provider chain based on preference
   */
  _buildProviderChain() {
    const allProviders = [
      OpenAIEmbeddingProvider,
      LocalEmbeddingProvider,
      KeywordEmbeddingProvider,
    ];

    switch (this.preferred) {
      case EmbeddingModelType.OPENAI:
        return [OpenAIEmbeddingProvider, LocalEmbeddingProvider, KeywordEmbeddingProvider];
      case EmbeddingModelType.LOCAL:
        return [LocalEmbeddingProvider, OpenAIEmbeddingProvider, KeywordEmbeddingProvider];
      case EmbeddingModelType.KEYWORD:
        return [KeywordEmbeddingProvider];
      default: // AUTO
        return allProviders;
    }
  }

  /**
   * Generate embedding
   */
  async embed(text) {
    if (!this.activeProvider) {
      await this.initialize();
    }
    return this.activeProvider.embed(text);
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts) {
    if (!this.activeProvider) {
      await this.initialize();
    }
    return this.activeProvider.embedBatch(texts);
  }

  getDimension() {
    return this.activeProvider?.getDimension() || 0;
  }

  /**
   * Get active provider name
   */
  getActiveProviderName() {
    return this.activeProvider?.constructor.name || 'none';
  }
}

/**
 * Factory function to create embedding provider
 */
export function createEmbeddingProvider(config = {}) {
  const type = config.embeddingModel || 'auto';

  switch (type) {
    case EmbeddingModelType.OPENAI:
      return new OpenAIEmbeddingProvider(config);
    case EmbeddingModelType.LOCAL:
      return new LocalEmbeddingProvider(config);
    case EmbeddingModelType.KEYWORD:
      return new KeywordEmbeddingProvider(config);
    default:
      return new SmartEmbeddingProvider(config);
  }
}
