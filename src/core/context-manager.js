/**
 * Context Manager
 * Manages layered context architecture for task execution
 * Three-layer context: Global (10%) + Task (60%) + Retrieval (30%)
 */

import { Logger } from '../utils/logger.js';
import { MemoryManager } from '../memory/manager.js';
import { VectorIndex } from '../memory/vector-index.js';

const logger = new Logger('ContextManager');

/**
 * Context layer types
 */
export const ContextLayer = {
  GLOBAL: 'global',       // ~10% of token budget
  TASK: 'task',           // ~60% of token budget
  RETRIEVAL: 'retrieval', // ~30% of token budget
};

/**
 * Context budget allocation
 */
export const CONTEXT_BUDGET = {
  [ContextLayer.GLOBAL]: 0.10,     // 10%
  [ContextLayer.TASK]: 0.60,       // 60%
  [ContextLayer.RETRIEVAL]: 0.30,  // 30%
};

/**
 * Context Manager
 * Handles layered context construction and intelligent file selection
 */
export class ContextManager {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.projectRoot = config.projectRoot || process.cwd();
    this.memoryManager = config.memoryManager || null;
    this.vectorIndex = config.vectorIndex || null;
    this.contextLimit = config.contextLimit || 128000;
  }

  /**
   * Initialize context manager
   */
  async initialize() {
    if (!this.memoryManager) {
      this.memoryManager = new MemoryManager({
        projectRoot: this.projectRoot,
        config: this.config,
      });
      await this.memoryManager.initialize();
    }

    logger.debug('ContextManager initialized');
  }

  /**
   * Build full context for a task
   * @param {Object} task - Task object
   * @param {Object} options - Build options
   * @returns {Promise<Object>} Context object
   */
  async buildContext(task, options = {}) {
    await this.initialize();

    const {
      maxFiles = 10,
      maxTokens = this.contextLimit,
    } = options;

    // Calculate token budgets for each layer
    const budgets = this._calculateBudgets(maxTokens);

    // Build each layer
    const globalContext = await this._buildGlobalContext(budgets[ContextLayer.GLOBAL]);
    const taskContext = await this._buildTaskContext(task, budgets[ContextLayer.TASK]);
    const retrievalContext = await this._buildRetrievalContext(task, budgets[ContextLayer.RETRIEVAL]);

    return {
      global: globalContext,
      task: taskContext,
      retrieval: retrievalContext,
      budgets,
      totalTokens: globalContext.tokens + taskContext.tokens + retrievalContext.tokens,
    };
  }

  /**
   * Calculate token budgets for each layer
   * @param {number} totalBudget - Total token budget
   * @returns {Object} Budget per layer
   */
  _calculateBudgets(totalBudget) {
    return {
      [ContextLayer.GLOBAL]: Math.floor(totalBudget * CONTEXT_BUDGET[ContextLayer.GLOBAL]),
      [ContextLayer.TASK]: Math.floor(totalBudget * CONTEXT_BUDGET[ContextLayer.TASK]),
      [ContextLayer.RETRIEVAL]: Math.floor(totalBudget * CONTEXT_BUDGET[ContextLayer.RETRIEVAL]),
    };
  }

  /**
   * Build global context (shared across all tasks)
   * @param {number} budget - Token budget
   * @returns {Promise<Object>} Global context
   */
  async _buildGlobalContext(budget) {
    const context = {
      projectProfile: null,
      conventions: null,
      currentPhase: null,
      tokens: 0,
    };

    try {
      // Get project profile
      const profile = await this.memoryManager.getProjectProfile();
      if (profile?.content) {
        context.projectProfile = this._truncateToBudget(profile.content, budget * 0.5);
        context.tokens += this._estimateTokens(JSON.stringify(context.projectProfile));
      }

      // Get conventions from profile
      if (profile?.content?.conventions) {
        context.conventions = profile.content.conventions;
        context.tokens += this._estimateTokens(JSON.stringify(context.conventions));
      }

    } catch (error) {
      logger.warn(`Failed to build global context: ${error.message}`);
    }

    return context;
  }

  /**
   * Build task-specific context
   * @param {Object} task - Task object
   * @param {number} budget - Token budget
   * @returns {Promise<Object>} Task context
   */
  async _buildTaskContext(task, budget) {
    const context = {
      task: null,
      designDoc: null,
      requirementDoc: null,
      codeFiles: [],
      tokens: 0,
    };

    try {
      // Task description
      context.task = {
        id: task.id,
        title: task.title,
        description: task.description,
        type: task.type,
        priority: task.priority,
        acceptanceCriteria: task.acceptanceCriteria || [],
      };
      context.tokens += this._estimateTokens(JSON.stringify(context.task));

      // Get design document
      if (task.designDocId) {
        const design = await this.memoryManager.getDesign(task.designDocId);
        if (design?.content) {
          context.designDoc = this._truncateToBudget(design.content, budget * 0.3);
          context.tokens += this._estimateTokens(JSON.stringify(context.designDoc));
        }
      }

      // Get requirement document
      if (task.requirementId) {
        const requirement = await this.memoryManager.getRequirements(task.requirementId);
        if (requirement?.content) {
          context.requirementDoc = this._truncateToBudget(requirement.content, budget * 0.2);
          context.tokens += this._estimateTokens(JSON.stringify(context.requirementDoc));
        }
      }

      // Select relevant code files
      const remainingBudget = budget - context.tokens;
      context.codeFiles = await this.selectRelevantCode(task, 10, remainingBudget);
      context.tokens += this._estimateTokens(JSON.stringify(context.codeFiles));

    } catch (error) {
      logger.warn(`Failed to build task context: ${error.message}`);
    }

    return context;
  }

  /**
   * Build retrieval context (semantic search results)
   * @param {Object} task - Task object
   * @param {number} budget - Token budget
   * @returns {Promise<Object>} Retrieval context
   */
  async _buildRetrievalContext(task, budget) {
    const context = {
      patterns: [],
      pitfalls: [],
      similarCode: [],
      tokens: 0,
    };

    try {
      // Find similar patterns
      const patterns = await this.memoryManager.findSimilarPatterns(task.description || task.title, {
        limit: 5,
      });

      context.patterns = patterns.map(p => ({
        name: p.entry?.content?.name,
        description: p.entry?.content?.description,
        score: p.score,
      })).slice(0, 3);
      context.tokens += this._estimateTokens(JSON.stringify(context.patterns));

      // Find relevant pitfalls
      const pitfalls = await this.memoryManager.findRelevantPitfalls(task.description || task.title, {
        limit: 5,
      });

      context.pitfalls = pitfalls.map(p => ({
        name: p.entry?.content?.name,
        symptom: p.entry?.content?.symptom,
        solution: p.entry?.content?.solution,
        score: p.score,
      })).slice(0, 3);
      context.tokens += this._estimateTokens(JSON.stringify(context.pitfalls));

    } catch (error) {
      logger.warn(`Failed to build retrieval context: ${error.message}`);
    }

    return context;
  }

  /**
   * Select relevant code files for a task
   * Implements intelligent file selection with priority ranking
   * @param {Object} task - Task object
   * @param {number} maxFiles - Maximum files to select
   * @param {number} maxTokens - Maximum tokens for code
   * @returns {Promise<Array>} Selected files
   */
  async selectRelevantCode(task, maxFiles = 10, maxTokens = 4000) {
    const selectedFiles = [];
    let currentTokens = 0;

    try {
      // 1. Direct dependencies (must include)
      const directDeps = this._getDirectDependencies(task);
      for (const file of directDeps) {
        if (selectedFiles.length >= maxFiles) break;
        if (currentTokens >= maxTokens) break;

        selectedFiles.push({
          path: file.path,
          content: file.content,
          reason: 'direct-dependency',
          priority: 1,
        });
        currentTokens += this._estimateTokens(file.content || '');
      }

      // 2. Semantic matches from vector search
      const semanticMatches = await this._semanticSearch(task.description || task.title, maxFiles * 2);
      for (const match of semanticMatches) {
        if (selectedFiles.length >= maxFiles) break;
        if (currentTokens >= maxTokens) break;

        // Skip if already included
        if (selectedFiles.some(f => f.path === match.path)) continue;

        selectedFiles.push({
          path: match.path,
          summary: match.summary,
          reason: 'semantic-match',
          priority: 2,
          score: match.score,
        });
        currentTokens += this._estimateTokens(match.summary || '');
      }

      // 3. Call graph analysis (if available)
      const callGraphFiles = await this._analyzeCallGraph(task);
      for (const file of callGraphFiles) {
        if (selectedFiles.length >= maxFiles) break;
        if (currentTokens >= maxTokens) break;

        // Skip if already included
        if (selectedFiles.some(f => f.path === file.path)) continue;

        selectedFiles.push({
          path: file.path,
          summary: file.summary,
          reason: 'call-graph',
          priority: 3,
        });
        currentTokens += this._estimateTokens(file.summary || '');
      }

      // Sort by priority
      selectedFiles.sort((a, b) => a.priority - b.priority);

    } catch (error) {
      logger.warn(`Failed to select relevant code: ${error.message}`);
    }

    return selectedFiles;
  }

  /**
   * Get direct dependencies from task
   * @param {Object} task - Task object
   * @returns {Array} Direct dependency files
   */
  _getDirectDependencies(task) {
    const deps = [];

    if (task.dependencies && Array.isArray(task.dependencies)) {
      for (const dep of task.dependencies) {
        if (dep.outputFiles) {
          for (const file of dep.outputFiles) {
            deps.push({
              path: file,
              content: null, // Would be loaded from file system
            });
          }
        }
      }
    }

    if (task.context?.files) {
      for (const file of task.context.files) {
        deps.push({
          path: file,
          content: null,
        });
      }
    }

    return deps;
  }

  /**
   * Perform semantic search for relevant code
   * @param {string} query - Search query
   * @param {number} limit - Result limit
   * @returns {Promise<Array>} Search results
   */
  async _semanticSearch(query, limit = 20) {
    if (!this.memoryManager) return [];

    try {
      const results = await this.memoryManager.search(query, {
        category: 'code',
        limit,
      });

      return results.map(r => ({
        path: r.metadata?.path || r.entry?.metadata?.path,
        summary: r.entry?.content?.summary || r.entry?.content,
        score: r.score,
      }));
    } catch (error) {
      logger.debug(`Semantic search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Analyze call graph for related files
   * @param {Object} task - Task object
   * @returns {Promise<Array>} Related files from call graph
   */
  async _analyzeCallGraph(task) {
    const relatedFiles = [];

    try {
      // 1. Get entry points from task
      const entryPoints = this._getEntryPoints(task);
      if (entryPoints.length === 0) {
        return relatedFiles;
      }

      // 2. Parse entry files and extract imports/exports
      const callGraph = await this._buildCallGraph(entryPoints);

      // 3. Find related files based on call graph
      const relatedPaths = this._findRelatedFiles(callGraph, entryPoints);

      // 4. Build result with summaries
      for (const path of relatedPaths) {
        const fileInfo = callGraph.get(path);
        if (fileInfo) {
          relatedFiles.push({
            path: path,
            summary: this._generateFileSummary(fileInfo),
            reason: 'call-graph',
            priority: 3,
          });
        }
      }

    } catch (error) {
      logger.warn(`Call graph analysis failed: ${error.message}`);
    }

    return relatedFiles;
  }

  /**
   * Get entry points from task
   * @param {Object} task - Task object
   * @returns {Array} Entry file paths
   */
  _getEntryPoints(task) {
    const entryPoints = [];

    // From task output files
    if (task.output?.files) {
      entryPoints.push(...task.output.files);
    }

    // From task context files
    if (task.context?.files) {
      entryPoints.push(...task.context.files);
    }

    // From task dependencies
    if (task.dependencies) {
      for (const dep of task.dependencies) {
        if (dep.outputFiles) {
          entryPoints.push(...dep.outputFiles);
        }
      }
    }

    // Deduplicate
    return [...new Set(entryPoints)];
  }

  /**
   * Build call graph from entry points
   * @param {Array} entryPoints - Entry file paths
   * @returns {Promise<Map>} Call graph (path -> fileInfo)
   */
  async _buildCallGraph(entryPoints) {
    const callGraph = new Map();
    const visited = new Set();
    const queue = [...entryPoints];

    while (queue.length > 0) {
      const filePath = queue.shift();

      if (visited.has(filePath)) continue;
      visited.add(filePath);

      try {
        const fileInfo = await this._parseFile(filePath);
        if (fileInfo) {
          callGraph.set(filePath, fileInfo);

          // Add imported files to queue
          for (const importPath of fileInfo.imports) {
            if (!visited.has(importPath)) {
              queue.push(importPath);
            }
          }
        }
      } catch (error) {
        logger.debug(`Failed to parse ${filePath}: ${error.message}`);
      }
    }

    return callGraph;
  }

  /**
   * Parse a file and extract imports, exports, and functions
   * @param {string} filePath - File path
   * @returns {Promise<Object|null>} File info
   */
  async _parseFile(filePath) {
    const fs = await import('fs');
    const path = await import('path');

    const fullPath = path.resolve(this.projectRoot, filePath);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const ext = path.extname(filePath);

    const fileInfo = {
      path: filePath,
      content: content.slice(0, 1000), // First 1000 chars for summary
      imports: [],
      exports: [],
      functions: [],
      classes: [],
    };

    // Parse based on file extension
    if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx') {
      this._parseJavaScript(content, fileInfo, filePath);
    } else if (ext === '.py') {
      this._parsePython(content, fileInfo, filePath);
    } else if (ext === '.java') {
      this._parseJava(content, fileInfo, filePath);
    }

    return fileInfo;
  }

  /**
   * Parse JavaScript/TypeScript file
   * @param {string} content - File content
   * @param {Object} fileInfo - File info object
   * @param {string} filePath - File path
   */
  _parseJavaScript(content, fileInfo, filePath) {
    // Extract ES6 imports
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"];?/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = this._resolveImportPath(match[1], filePath);
      if (importPath) {
        fileInfo.imports.push(importPath);
      }
    }

    // Extract CommonJS requires
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const importPath = this._resolveImportPath(match[1], filePath);
      if (importPath) {
        fileInfo.imports.push(importPath);
      }
    }

    // Extract function definitions
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
    while ((match = functionRegex.exec(content)) !== null) {
      fileInfo.functions.push(match[1]);
    }

    // Extract arrow functions with names
    const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/g;
    while ((match = arrowRegex.exec(content)) !== null) {
      fileInfo.functions.push(match[1]);
    }

    // Extract class definitions
    const classRegex = /(?:export\s+)?class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      fileInfo.classes.push(match[1]);
    }

    // Extract exports
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)?\s*(\w+)?/g;
    while ((match = exportRegex.exec(content)) !== null) {
      if (match[1]) {
        fileInfo.exports.push(match[1]);
      }
    }
  }

  /**
   * Parse Python file
   * @param {string} content - File content
   * @param {Object} fileInfo - File info object
   * @param {string} filePath - File path
   */
  _parsePython(content, fileInfo, filePath) {
    // Extract imports
    const importRegex = /^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const moduleName = match[1] || match[2];
      if (moduleName && !moduleName.startsWith('.')) {
        fileInfo.imports.push(`${moduleName}.py`);
      }
    }

    // Extract function definitions
    const functionRegex = /^def\s+(\w+)\s*\(/gm;
    while ((match = functionRegex.exec(content)) !== null) {
      fileInfo.functions.push(match[1]);
    }

    // Extract class definitions
    const classRegex = /^class\s+(\w+)/gm;
    while ((match = classRegex.exec(content)) !== null) {
      fileInfo.classes.push(match[1]);
    }
  }

  /**
   * Parse Java file
   * @param {string} content - File content
   * @param {Object} fileInfo - File info object
   * @param {string} filePath - File path
   */
  _parseJava(content, fileInfo, filePath) {
    // Extract imports
    const importRegex = /^import\s+([\w.]+);/gm;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const className = match[1].split('.').pop();
      fileInfo.imports.push(`${className}.java`);
    }

    // Extract method definitions
    const methodRegex = /(?:public|private|protected)?\s+(?:static\s+)?(?:\w+)\s+(\w+)\s*\(/g;
    while ((match = methodRegex.exec(content)) !== null) {
      fileInfo.functions.push(match[1]);
    }

    // Extract class definitions
    const classRegex = /(?:public\s+)?class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      fileInfo.classes.push(match[1]);
    }
  }

  /**
   * Resolve import path to relative file path
   * @param {string} importPath - Import path
   * @param {string} currentFile - Current file path
   * @returns {string|null} Resolved path
   */
  _resolveImportPath(importPath, currentFile) {
    const path = require('path');

    // Skip external packages
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null;
    }

    const currentDir = path.dirname(currentFile);
    const resolvedPath = path.resolve(this.projectRoot, currentDir, importPath);

    // Try common extensions
    const extensions = ['', '.js', '.ts', '.jsx', '.tsx', '.py', '.java'];
    for (const ext of extensions) {
      const fullPath = resolvedPath + ext;
      if (require('fs').existsSync(fullPath)) {
        return path.relative(this.projectRoot, fullPath);
      }
    }

    // Try index file
    const indexPath = path.join(resolvedPath, 'index.js');
    if (require('fs').existsSync(indexPath)) {
      return path.relative(this.projectRoot, indexPath);
    }

    return null;
  }

  /**
   * Find related files based on call graph
   * @param {Map} callGraph - Call graph
   * @param {Array} entryPoints - Entry points
   * @returns {Array} Related file paths
   */
  _findRelatedFiles(callGraph, entryPoints) {
    const related = new Set();
    const visited = new Set();

    // BFS from entry points
    const queue = [...entryPoints];

    while (queue.length > 0) {
      const path = queue.shift();

      if (visited.has(path)) continue;
      visited.add(path);

      const fileInfo = callGraph.get(path);
      if (!fileInfo) continue;

      // Add to related
      related.add(path);

      // Add imported files
      for (const importPath of fileInfo.imports) {
        if (!visited.has(importPath)) {
          queue.push(importPath);
        }
      }

      // Limit to prevent explosion
      if (related.size >= 20) break;
    }

    return [...related];
  }

  /**
   * Generate summary for a file
   * @param {Object} fileInfo - File info
   * @returns {string} Summary
   */
  _generateFileSummary(fileInfo) {
    const parts = [];

    if (fileInfo.classes.length > 0) {
      parts.push(`Classes: ${fileInfo.classes.join(', ')}`);
    }

    if (fileInfo.functions.length > 0) {
      const funcs = fileInfo.functions.slice(0, 5);
      if (fileInfo.functions.length > 5) {
        funcs.push('...');
      }
      parts.push(`Functions: ${funcs.join(', ')}`);
    }

    if (fileInfo.imports.length > 0) {
      parts.push(`Imports: ${fileInfo.imports.length} files`);
    }

    return parts.join('; ') || 'No summary available';
  }

  /**
   * Public API: Analyze call graph
   * @param {Object} task - Task object
   * @returns {Promise<Object>} Call graph analysis result
   */
  async analyzeCallGraph(task) {
    const files = await this._analyzeCallGraph(task);

    return {
      files,
      count: files.length,
      entryPoints: this._getEntryPoints(task),
    };
  }

  /**
   * Truncate content to fit within token budget
   * @param {*} content - Content to truncate
   * @param {number} budget - Token budget
   * @returns {*} Truncated content
   */
  _truncateToBudget(content, budget) {
    if (!content) return content;

    const str = typeof content === 'string' ? content : JSON.stringify(content);
    const tokens = this._estimateTokens(str);

    if (tokens <= budget) return content;

    // Truncate string
    const charLimit = budget * 4; // ~4 chars per token
    const truncated = str.slice(0, charLimit);

    return typeof content === 'string'
      ? truncated + '... [truncated]'
      : JSON.parse(truncated + '... [truncated]');
  }

  /**
   * Estimate token count for text
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  _estimateTokens(text) {
    if (!text) return 0;

    const str = typeof text === 'string' ? text : JSON.stringify(text);

    // Simple estimation: ~4 chars per token for English, ~2 for Chinese
    const englishChars = str.replace(/[\u4e00-\u9fff]/g, '').length;
    const chineseChars = (str.match(/[\u4e00-\u9fff]/g) || []).length;

    return Math.ceil(englishChars / 4 + chineseChars / 2);
  }

  /**
   * Get context statistics
   * @param {Object} context - Context object
   * @returns {Object} Statistics
   */
  getStats(context) {
    return {
      totalTokens: context.totalTokens,
      layers: {
        global: {
          tokens: context.global?.tokens || 0,
          budget: context.budgets?.[ContextLayer.GLOBAL] || 0,
        },
        task: {
          tokens: context.task?.tokens || 0,
          budget: context.budgets?.[ContextLayer.TASK] || 0,
          fileCount: context.task?.codeFiles?.length || 0,
        },
        retrieval: {
          tokens: context.retrieval?.tokens || 0,
          budget: context.budgets?.[ContextLayer.RETRIEVAL] || 0,
          patternCount: context.retrieval?.patterns?.length || 0,
          pitfallCount: context.retrieval?.pitfalls?.length || 0,
        },
      },
    };
  }
}

/**
 * Create context manager instance
 */
export function createContextManager(config = {}) {
  return new ContextManager(config);
}
