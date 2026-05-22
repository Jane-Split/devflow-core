/**
 * Design Consistency Checker
 * Compares implementation fingerprints with design specifications
 * Detects deviations, missing implementations, and extra implementations
 */

import { Logger } from '../utils/logger.js';
import { MemoryManager } from '../memory/manager.js';
import { DesignVersionTracker } from './design-version-tracker.js';

const logger = new Logger('DesignConsistencyChecker');

/**
 * Consistency check result types
 */
export const ConsistencyResultType = {
  MATCH: 'match',           // Implementation matches design
  DEVIATION: 'deviation',   // Implementation differs from design
  MISSING: 'missing',       // Design specifies but implementation missing
  EXTRA: 'extra',           // Implementation exists but not in design
};

/**
 * Implementation fingerprint types
 */
export const FingerprintType = {
  INTERFACE: 'interface',
  METHOD: 'method',
  PARAMETER: 'parameter',
  RETURN_TYPE: 'returnType',
  ENDPOINT: 'endpoint',
  DATA_MODEL: 'dataModel',
};

/**
 * Implementation Fingerprint
 */
export class ImplementationFingerprint {
  constructor(data = {}) {
    this.type = data.type;
    this.name = data.name;
    this.signature = data.signature;
    this.parameters = data.parameters || [];
    this.returnType = data.returnType;
    this.location = data.location; // file:line
    this.extractedAt = data.extractedAt || new Date().toISOString();
  }
}

/**
 * Design Consistency Checker
 */
export class DesignConsistencyChecker {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.projectRoot = config.projectRoot || process.cwd();
    this.memoryManager = config.memoryManager || null;
    this.versionTracker = config.versionTracker || null;
  }

  /**
   * Initialize checker
   */
  async initialize() {
    if (!this.memoryManager) {
      this.memoryManager = new MemoryManager({
        projectRoot: this.projectRoot,
        config: this.config,
      });
      await this.memoryManager.initialize();
    }

    if (!this.versionTracker) {
      this.versionTracker = new DesignVersionTracker({
        projectRoot: this.projectRoot,
        memoryManager: this.memoryManager,
        config: this.config,
      });
    }

    logger.debug('DesignConsistencyChecker initialized');
  }

  /**
   * Check consistency between implementation and design
   * @param {Object} task - Task object
   * @param {Array} fingerprints - Implementation fingerprints
   * @returns {Promise<Object>} Consistency check result
   */
  async checkConsistency(task, fingerprints) {
    await this.initialize();

    // Get design document
    const design = await this._getDesignForTask(task);
    if (!design) {
      return {
        hasDesign: false,
        message: 'No design document found for task',
        results: [],
      };
    }

    // Extract design specifications
    const designSpecs = this._extractDesignSpec(design);

    // Compare fingerprints with design specs
    const comparison = this._compareWithDesign(designSpecs, fingerprints);

    // Generate report
    const report = this._generateReport(comparison, task);

    return {
      hasDesign: true,
      designId: task.designDocId,
      designVersion: await this.versionTracker.getCurrentVersion(task.designDocId),
      ...comparison,
      report,
    };
  }

  /**
   * Extract design specifications from design document
   * @param {Object|string} design - Design document
   * @returns {Object} Extracted specifications
   */
  _extractDesignSpec(design) {
    const specs = {
      interfaces: [],
      methods: [],
      endpoints: [],
      dataModels: [],
      parameters: [],
      returnTypes: [],
    };

    const content = typeof design === 'string' ? design : JSON.stringify(design);

    // Extract interface definitions
    const interfaceMatches = content.matchAll(/(?:interface|class|type)\s+(\w+)[\s{]/g);
    for (const match of interfaceMatches) {
      specs.interfaces.push({
        name: match[1],
        location: this._findLocation(content, match.index),
      });
    }

    // Extract method/function definitions
    const methodMatches = content.matchAll(/(?:function|def|async\s+function|public|private|protected)?\s*(\w+)\s*\([^)]*\)/g);
    for (const match of methodMatches) {
      specs.methods.push({
        name: match[1],
        signature: match[0],
        location: this._findLocation(content, match.index),
      });
    }

    // Extract API endpoints
    const endpointMatches = content.matchAll(/(?:GET|POST|PUT|DELETE|PATCH)\s+([^\s\n]+)/gi);
    for (const match of endpointMatches) {
      specs.endpoints.push({
        path: match[1],
        method: match[0].split(/\s+/)[0],
        location: this._findLocation(content, match.index),
      });
    }

    // Extract parameter definitions
    const paramMatches = content.matchAll(/@param\s+\{([^}]+)\}\s+(\w+)/g);
    for (const match of paramMatches) {
      specs.parameters.push({
        type: match[1],
        name: match[2],
      });
    }

    // Extract return type definitions
    const returnMatches = content.matchAll(/@returns?\s+\{([^}]+)\}/g);
    for (const match of returnMatches) {
      specs.returnTypes.push({
        type: match[1],
      });
    }

    return specs;
  }

  /**
   * Compare implementation fingerprints with design specifications
   * @param {Object} designSpecs - Design specifications
   * @param {Array} fingerprints - Implementation fingerprints
   * @returns {Object} Comparison result
   */
  _compareWithDesign(designSpecs, fingerprints) {
    const results = {
      matches: [],
      deviations: [],
      missing: [],
      extra: [],
    };

    // Track which design specs have been matched
    const matchedSpecs = new Set();

    // Check each fingerprint against design specs
    for (const fp of fingerprints) {
      const matchResult = this._findMatchingSpec(fp, designSpecs);

      if (matchResult.found) {
        matchedSpecs.add(matchResult.specKey);

        // Check for deviations
        const deviationCheck = this._checkDeviation(fp, matchResult.spec);

        if (deviationCheck.isDeviation) {
          results.deviations.push({
            fingerprint: fp,
            spec: matchResult.spec,
            deviation: deviationCheck.details,
            type: ConsistencyResultType.DEVIATION,
          });
        } else {
          results.matches.push({
            fingerprint: fp,
            spec: matchResult.spec,
            type: ConsistencyResultType.MATCH,
          });
        }
      } else {
        // Implementation exists but not in design
        results.extra.push({
          fingerprint: fp,
          type: ConsistencyResultType.EXTRA,
          message: `Implementation '${fp.name}' not found in design`,
        });
      }
    }

    // Check for missing implementations (in design but not implemented)
    for (const [specType, specs] of Object.entries(designSpecs)) {
      for (let i = 0; i < specs.length; i++) {
        const specKey = `${specType}:${i}`;
        if (!matchedSpecs.has(specKey)) {
          results.missing.push({
            spec: specs[i],
            specType,
            type: ConsistencyResultType.MISSING,
            message: `Design specifies '${specs[i].name || specs[i].path}' but not implemented`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Find matching spec for a fingerprint
   * @param {Object} fingerprint - Implementation fingerprint
   * @param {Object} designSpecs - Design specifications
   * @returns {Object} Match result
   */
  _findMatchingSpec(fingerprint, designSpecs) {
    const specTypeMap = {
      [FingerprintType.INTERFACE]: 'interfaces',
      [FingerprintType.METHOD]: 'methods',
      [FingerprintType.ENDPOINT]: 'endpoints',
      [FingerprintType.DATA_MODEL]: 'dataModels',
      [FingerprintType.PARAMETER]: 'parameters',
      [FingerprintType.RETURN_TYPE]: 'returnTypes',
    };

    const specArray = designSpecs[specTypeMap[fingerprint.type]] || [];

    for (let i = 0; i < specArray.length; i++) {
      const spec = specArray[i];

      // Match by name
      if (spec.name === fingerprint.name) {
        return {
          found: true,
          spec,
          specKey: `${specTypeMap[fingerprint.type]}:${i}`,
        };
      }

      // Match by path for endpoints
      if (fingerprint.type === FingerprintType.ENDPOINT && spec.path === fingerprint.signature) {
        return {
          found: true,
          spec,
          specKey: `endpoints:${i}`,
        };
      }
    }

    return { found: false };
  }

  /**
   * Check for deviation between fingerprint and spec
   * @param {Object} fingerprint - Implementation fingerprint
   * @param {Object} spec - Design specification
   * @returns {Object} Deviation check result
   */
  _checkDeviation(fingerprint, spec) {
    const deviations = [];

    // Check parameter count/types
    if (fingerprint.parameters && spec.parameters) {
      if (fingerprint.parameters.length !== spec.parameters.length) {
        deviations.push({
          type: 'parameter-count',
          expected: spec.parameters.length,
          actual: fingerprint.parameters.length,
        });
      }
    }

    // Check return type
    if (fingerprint.returnType && spec.returnType) {
      if (fingerprint.returnType !== spec.returnType) {
        deviations.push({
          type: 'return-type',
          expected: spec.returnType,
          actual: fingerprint.returnType,
        });
      }
    }

    // Check signature
    if (fingerprint.signature && spec.signature) {
      // Normalize signatures for comparison
      const normalizedFp = this._normalizeSignature(fingerprint.signature);
      const normalizedSpec = this._normalizeSignature(spec.signature);

      if (normalizedFp !== normalizedSpec) {
        deviations.push({
          type: 'signature',
          expected: spec.signature,
          actual: fingerprint.signature,
        });
      }
    }

    return {
      isDeviation: deviations.length > 0,
      details: deviations,
    };
  }

  /**
   * Normalize signature for comparison
   * @param {string} signature - Signature to normalize
   * @returns {string} Normalized signature
   */
  _normalizeSignature(signature) {
    return signature
      .replace(/\s+/g, ' ')
      .replace(/\s*([(),{}[\]:;])\s*/g, '$1')
      .trim()
      .toLowerCase();
  }

  /**
   * Get design document for a task
   * @param {Object} task - Task object
   * @returns {Promise<Object|null>} Design document
   */
  async _getDesignForTask(task) {
    if (task.designDocId) {
      const entry = await this.memoryManager.getDesign(task.designDocId);
      return entry?.content;
    }
    return null;
  }

  /**
   * Find line number for an index in content
   * @param {string} content - Content
   * @param {number} index - Character index
   * @returns {number} Line number
   */
  _findLocation(content, index) {
    const lines = content.slice(0, index).split('\n');
    return lines.length;
  }

  /**
   * Generate consistency report
   * @param {Object} comparison - Comparison result
   * @param {Object} task - Task object
   * @returns {Object} Report
   */
  _generateReport(comparison, task) {
    const total = comparison.matches.length + comparison.deviations.length +
                  comparison.missing.length + comparison.extra.length;

    const consistencyScore = total > 0
      ? (comparison.matches.length / total * 100).toFixed(1)
      : 100;

    return {
      taskId: task.id,
      taskTitle: task.title,
      consistencyScore: `${consistencyScore}%`,
      summary: {
        total,
        matches: comparison.matches.length,
        deviations: comparison.deviations.length,
        missing: comparison.missing.length,
        extra: comparison.extra.length,
      },
      passed: comparison.deviations.length === 0 && comparison.missing.length === 0,
      requiresReview: comparison.deviations.length > 0 || comparison.extra.length > 0,
      recommendations: this._generateRecommendations(comparison),
    };
  }

  /**
   * Generate recommendations based on consistency check
   * @param {Object} comparison - Comparison result
   * @returns {Array} Recommendations
   */
  _generateRecommendations(comparison) {
    const recommendations = [];

    if (comparison.deviations.length > 0) {
      recommendations.push({
        type: 'deviation',
        action: 'review',
        message: `Review ${comparison.deviations.length} deviation(s) between implementation and design`,
        items: comparison.deviations.map(d => d.fingerprint?.name || d.spec?.name),
      });
    }

    if (comparison.missing.length > 0) {
      recommendations.push({
        type: 'missing',
        action: 'implement',
        message: `Implement ${comparison.missing.length} missing feature(s) from design`,
        items: comparison.missing.map(m => m.spec?.name || m.spec?.path),
      });
    }

    if (comparison.extra.length > 0) {
      recommendations.push({
        type: 'extra',
        action: 'verify',
        message: `Verify ${comparison.extra.length} extra implementation(s) - consider updating design`,
        items: comparison.extra.map(e => e.fingerprint?.name),
      });
    }

    return recommendations;
  }

  /**
   * Extract fingerprints from code file
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @returns {Array} Extracted fingerprints
   */
  extractFingerprints(content, filePath) {
    const fingerprints = [];

    // Extract interface/class definitions
    const interfaceMatches = content.matchAll(/(?:interface|class)\s+(\w+)[\s{]/g);
    for (const match of interfaceMatches) {
      fingerprints.push(new ImplementationFingerprint({
        type: FingerprintType.INTERFACE,
        name: match[1],
        signature: match[0],
        location: `${filePath}:${this._getLineNumber(content, match.index)}`,
      }));
    }

    // Extract function/method definitions
    const functionMatches = content.matchAll(/(?:function|const|let|var|async\s+function)\s+(\w+)\s*[=\(]/g);
    for (const match of functionMatches) {
      fingerprints.push(new ImplementationFingerprint({
        type: FingerprintType.METHOD,
        name: match[1],
        signature: match[0],
        location: `${filePath}:${this._getLineNumber(content, match.index)}`,
      }));
    }

    // Extract API endpoints (Express-style)
    const endpointMatches = content.matchAll(/(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi);
    for (const match of endpointMatches) {
      fingerprints.push(new ImplementationFingerprint({
        type: FingerprintType.ENDPOINT,
        name: `${match[1].toUpperCase()} ${match[2]}`,
        signature: match[2],
        parameters: [],
        location: `${filePath}:${this._getLineNumber(content, match.index)}`,
      }));
    }

    return fingerprints;
  }

  /**
   * Get line number for an index
   * @param {string} content - Content
   * @param {number} index - Character index
   * @returns {number} Line number
   */
  _getLineNumber(content, index) {
    return content.slice(0, index).split('\n').length;
  }
}

/**
 * Create design consistency checker instance
 */
export function createDesignConsistencyChecker(config = {}) {
  return new DesignConsistencyChecker(config);
}
