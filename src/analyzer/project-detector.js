/**
 * Project Type Detector
 * Automatically detects project type: frontend, backend, fullstack, microservice
 */

import { join } from 'path';
import fs from 'fs-extra';
import { AnalysisError, ErrorCodes } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ProjectTypeDetector');

/**
 * Project types
 */
export const ProjectType = {
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  FULLSTACK: 'fullstack',
  MICROSERVICE: 'microservice',
  UNKNOWN: 'unknown',
};

/**
 * Detection signatures for different project types
 */
const DETECTION_SIGNATURES = {
  frontend: {
    files: [
      'package.json', // Check for React/Vue/Angular deps
      'vite.config.js',
      'vite.config.ts',
      'webpack.config.js',
      'next.config.js',
      'nuxt.config.js',
      'angular.json',
    ],
    dirs: [
      'src/components',
      'src/pages',
      'public',
      'src/app',
    ],
  },
  backend: {
    files: [
      'pom.xml', // Java/Maven
      'build.gradle', // Java/Gradle
      'Cargo.toml', // Rust
      'go.mod', // Go
      'requirements.txt', // Python
      'Pipfile',
      'pyproject.toml',
      'composer.json', // PHP
      'Gemfile', // Ruby
    ],
    dirs: [
      'src/main',
      'src/main/java',
      'src/main/resources',
      'app',
      'controllers',
      'models',
    ],
  },
  microservice: {
    files: [
      'docker-compose.yml',
      'docker-compose.yaml',
      'k8s',
      'kubernetes',
    ],
    dirs: [
      'services',
      'microservices',
      'apps',
      'k8s',
      'kubernetes',
      'deployments',
    ],
  },
};

/**
 * Project Type Detector
 */
export class ProjectTypeDetector {
  /**
   * @param {string} projectRoot - Project root directory
   */
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.scores = {};
  }

  /**
   * Detect project type
   * @returns {Promise<Object>} Detection result
   */
  async detect() {
    logger.debug(`Detecting project type in ${this.projectRoot}`);

    // Calculate scores for each type
    this.scores = {
      frontend: await this._calculateScore('frontend'),
      backend: await this._calculateScore('backend'),
      microservice: await this._calculateScore('microservice'),
    };

    logger.debug(`Detection scores: ${JSON.stringify(this.scores)}`);

    // Determine project type
    const detectedType = this._determineType();

    return {
      type: detectedType,
      scores: this.scores,
      confidence: this._calculateConfidence(detectedType),
    };
  }

  /**
   * Calculate score for a project type
   */
  async _calculateScore(type) {
    const signatures = DETECTION_SIGNATURES[type];
    let score = 0;

    // Check files
    for (const file of signatures.files) {
      const filePath = join(this.projectRoot, file);
      if (await fs.pathExists(filePath)) {
        score += await this._scoreFile(type, file, filePath);
      }
    }

    // Check directories
    for (const dir of signatures.dirs) {
      const dirPath = join(this.projectRoot, dir);
      if (await fs.pathExists(dirPath)) {
        score += 2;
      }
    }

    return score;
  }

  /**
   * Score a specific file based on content
   */
  async _scoreFile(type, filename, filePath) {
    let score = 1; // Base score for file existence

    try {
      if (type === 'frontend' && filename === 'package.json') {
        const content = await fs.readJson(filePath);
        const deps = { ...content.dependencies, ...content.devDependencies };

        // Check for frontend frameworks
        if (deps.react || deps['react-dom']) score += 5;
        if (deps.vue || deps['vue-router']) score += 5;
        if (deps.angular || deps['@angular/core']) score += 5;
        if (deps.svelte) score += 5;
        if (deps.next) score += 3;
        if (deps.nuxt) score += 3;

        // Check for build tools
        if (deps.vite) score += 2;
        if (deps.webpack) score += 2;
        if (deps['@angular/cli']) score += 2;
      }

      if (type === 'backend') {
        if (filename === 'pom.xml' || filename === 'build.gradle') {
          score += 5; // Strong indicator for Java backend
        }
        if (filename === 'go.mod') {
          score += 5; // Strong indicator for Go backend
        }
        if (filename === 'Cargo.toml') {
          score += 5; // Strong indicator for Rust backend
        }
        if (filename === 'requirements.txt' || filename === 'pyproject.toml') {
          score += 4; // Python backend
        }
      }

      if (type === 'microservice') {
        if (filename === 'docker-compose.yml' || filename === 'docker-compose.yaml') {
          const content = await fs.readFile(filePath, 'utf8');
          // Check for multiple services
          const serviceMatches = content.match(/services:/g);
          if (serviceMatches && serviceMatches.length > 0) {
            score += 5;
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to score file ${filePath}: ${error.message}`);
    }

    return score;
  }

  /**
   * Determine project type from scores
   */
  _determineType() {
    const { frontend, backend, microservice } = this.scores;

    // Microservice takes precedence if detected
    if (microservice >= 5) {
      return ProjectType.MICROSERVICE;
    }

    // Fullstack if both frontend and backend detected
    if (frontend >= 5 && backend >= 5) {
      return ProjectType.FULLSTACK;
    }

    // Frontend only
    if (frontend > backend && frontend >= 3) {
      return ProjectType.FRONTEND;
    }

    // Backend only
    if (backend > frontend && backend >= 3) {
      return ProjectType.BACKEND;
    }

    return ProjectType.UNKNOWN;
  }

  /**
   * Calculate confidence level
   */
  _calculateConfidence(type) {
    const maxScore = Math.max(...Object.values(this.scores));
    
    if (maxScore >= 10) return 'high';
    if (maxScore >= 5) return 'medium';
    return 'low';
  }

  /**
   * Check if project has specific framework
   */
  async hasFramework(framework) {
    const packageJsonPath = join(this.projectRoot, 'package.json');
    
    if (!(await fs.pathExists(packageJsonPath))) {
      return false;
    }

    try {
      const content = await fs.readJson(packageJsonPath);
      const deps = { ...content.dependencies, ...content.devDependencies };
      return !!deps[framework];
    } catch {
      return false;
    }
  }

  /**
   * Check if project is a frontend project
   * @returns {Promise<Object>} Frontend check result
   */
  async checkFrontend() {
    logger.debug('Checking frontend project type');
    
    const score = await this._calculateScore('frontend');
    const isFrontend = score >= 3;
    
    // Detect specific framework
    let framework = null;
    const frameworks = ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt'];
    for (const fw of frameworks) {
      if (await this.hasFramework(fw)) {
        framework = fw;
        break;
      }
    }

    return {
      isFrontend,
      score,
      framework,
      indicators: this._getFrontendIndicators(),
    };
  }

  /**
   * Check if project is a backend project
   * @returns {Promise<Object>} Backend check result
   */
  async checkBackend() {
    logger.debug('Checking backend project type');
    
    const score = await this._calculateScore('backend');
    const isBackend = score >= 3;
    
    // Detect specific language/framework
    const languages = [];
    const checks = [
      { file: 'pom.xml', lang: 'java' },
      { file: 'build.gradle', lang: 'java' },
      { file: 'go.mod', lang: 'go' },
      { file: 'Cargo.toml', lang: 'rust' },
      { file: 'requirements.txt', lang: 'python' },
      { file: 'pyproject.toml', lang: 'python' },
      { file: 'composer.json', lang: 'php' },
      { file: 'Gemfile', lang: 'ruby' },
    ];

    for (const check of checks) {
      const filePath = join(this.projectRoot, check.file);
      if (await fs.pathExists(filePath)) {
        languages.push(check.lang);
      }
    }

    return {
      isBackend,
      score,
      languages: [...new Set(languages)],
      indicators: this._getBackendIndicators(),
    };
  }

  /**
   * Check if project is a microservice project
   * @returns {Promise<Object>} Microservice check result
   */
  async checkMicroservice() {
    logger.debug('Checking microservice project type');
    
    const score = await this._calculateScore('microservice');
    const isMicroservice = score >= 5;
    
    // Count services
    let serviceCount = 0;
    const serviceDirs = ['services', 'microservices', 'apps'];
    for (const dir of serviceDirs) {
      const dirPath = join(this.projectRoot, dir);
      if (await fs.pathExists(dirPath)) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        serviceCount += entries.filter(e => e.isDirectory()).length;
      }
    }

    return {
      isMicroservice,
      score,
      serviceCount,
      hasDockerCompose: await fs.pathExists(join(this.projectRoot, 'docker-compose.yml')),
      hasKubernetes: await fs.pathExists(join(this.projectRoot, 'k8s')),
      indicators: this._getMicroserviceIndicators(),
    };
  }

  /**
   * Get frontend indicators
   * @returns {Array} Frontend indicators
   */
  _getFrontendIndicators() {
    const indicators = [];
    const signatures = DETECTION_SIGNATURES.frontend;
    
    for (const file of signatures.files) {
      indicators.push({ type: 'file', name: file });
    }
    for (const dir of signatures.dirs) {
      indicators.push({ type: 'directory', name: dir });
    }
    
    return indicators;
  }

  /**
   * Get backend indicators
   * @returns {Array} Backend indicators
   */
  _getBackendIndicators() {
    const indicators = [];
    const signatures = DETECTION_SIGNATURES.backend;
    
    for (const file of signatures.files) {
      indicators.push({ type: 'file', name: file });
    }
    for (const dir of signatures.dirs) {
      indicators.push({ type: 'directory', name: dir });
    }
    
    return indicators;
  }

  /**
   * Get microservice indicators
   * @returns {Array} Microservice indicators
   */
  _getMicroserviceIndicators() {
    const indicators = [];
    const signatures = DETECTION_SIGNATURES.microservice;
    
    for (const file of signatures.files) {
      indicators.push({ type: 'file', name: file });
    }
    for (const dir of signatures.dirs) {
      indicators.push({ type: 'directory', name: dir });
    }
    
    return indicators;
  }
}

/**
 * Quick detect function
 */
export async function detectProjectType(projectRoot) {
  const detector = new ProjectTypeDetector(projectRoot);
  return detector.detect();
}
