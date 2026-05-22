/**
 * Backend Analyzer
 * Analyzes backend projects to extract tech stack, ORM, API framework, etc.
 */

import { join } from 'path';
import fs from 'fs-extra';
import { Logger } from '../utils/logger.js';

const logger = new Logger('BackendAnalyzer');

/**
 * Backend languages and frameworks
 */
const BACKEND_FRAMEWORKS = {
  // JavaScript/TypeScript
  express: { name: 'Express.js', language: 'javascript', indicators: ['express'] },
  nestjs: { name: 'NestJS', language: 'typescript', indicators: ['@nestjs/core'] },
  fastify: { name: 'Fastify', language: 'javascript', indicators: ['fastify'] },
  koa: { name: 'Koa', language: 'javascript', indicators: ['koa'] },
  hapi: { name: 'Hapi', language: 'javascript', indicators: ['@hapi/hapi'] },

  // Python
  django: { name: 'Django', language: 'python', indicators: ['django'] },
  flask: { name: 'Flask', language: 'python', indicators: ['flask'] },
  fastapi: { name: 'FastAPI', language: 'python', indicators: ['fastapi'] },

  // Java
  spring: { name: 'Spring Boot', language: 'java', indicators: ['spring-boot'] },

  // Go
  gin: { name: 'Gin', language: 'go', indicators: ['gin-gonic/gin'] },
  echo: { name: 'Echo', language: 'go', indicators: ['labstack/echo'] },

  // Rust
  actix: { name: 'Actix-web', language: 'rust', indicators: ['actix-web'] },
  axum: { name: 'Axum', language: 'rust', indicators: ['axum'] },

  // PHP
  laravel: { name: 'Laravel', language: 'php', indicators: ['laravel/framework'] },
  symfony: { name: 'Symfony', language: 'php', indicators: ['symfony/framework-bundle'] },

  // Ruby
  rails: { name: 'Ruby on Rails', language: 'ruby', indicators: ['rails'] },
  sinatra: { name: 'Sinatra', language: 'ruby', indicators: ['sinatra'] },
};

/**
 * ORM libraries
 */
const ORM_LIBRARIES = {
  // JavaScript/TypeScript
  prisma: { name: 'Prisma', language: 'javascript', indicators: ['@prisma/client'] },
  typeorm: { name: 'TypeORM', language: 'typescript', indicators: ['typeorm'] },
  sequelize: { name: 'Sequelize', language: 'javascript', indicators: ['sequelize'] },
  mongoose: { name: 'Mongoose', language: 'javascript', indicators: ['mongoose'] },

  // Python
  sqlalchemy: { name: 'SQLAlchemy', language: 'python', indicators: ['sqlalchemy'] },
  django_orm: { name: 'Django ORM', language: 'python', indicators: ['django'] },

  // Java
  hibernate: { name: 'Hibernate', language: 'java', indicators: ['hibernate-core'] },
  jpa: { name: 'JPA', language: 'java', indicators: ['spring-boot-starter-data-jpa'] },

  // Go
  gorm: { name: 'GORM', language: 'go', indicators: ['gorm.io/gorm'] },
  ent: { name: 'Ent', language: 'go', indicators: ['entgo.io/ent'] },

  // Rust
  diesel: { name: 'Diesel', language: 'rust', indicators: ['diesel'] },
  sea_orm: { name: 'SeaORM', language: 'rust', indicators: ['sea-orm'] },
};

/**
 * Database drivers
 */
const DATABASES = {
  postgresql: {
    name: 'PostgreSQL',
    indicators: ['pg', 'postgres', 'postgresql', 'psycopg2', 'jdbc:postgresql'],
  },
  mysql: { name: 'MySQL', indicators: ['mysql', 'mysql2', 'mysql-connector', 'jdbc:mysql'] },
  mongodb: { name: 'MongoDB', indicators: ['mongodb', 'mongoose', 'mongo'] },
  sqlite: { name: 'SQLite', indicators: ['sqlite', 'sqlite3'] },
  redis: { name: 'Redis', indicators: ['redis', 'ioredis'] },
};

/**
 * Backend Analyzer
 */
export class BackendAnalyzer {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.packageJson = null;
    this.pomXml = null;
  }

  /**
   * Analyze backend project
   */
  async analyze() {
    logger.debug(`Analyzing backend project in ${this.projectRoot}`);

    // Detect project type and load appropriate files
    await this._detectProjectType();

    const analysis = {
      language: await this._detectLanguage(),
      framework: await this._detectFramework(),
      orm: await this._detectORM(),
      database: await this._detectDatabase(),
      apiStyle: await this._detectAPIStyle(),
      testing: await this._detectTesting(),
      conventions: await this._extractConventions(),
    };

    logger.debug('Backend analysis complete');
    return analysis;
  }

  /**
   * Detect project type and load config files
   */
  async _detectProjectType() {
    // Check for Node.js project
    const packagePath = join(this.projectRoot, 'package.json');
    if (await fs.pathExists(packagePath)) {
      this.packageJson = await fs.readJson(packagePath);
      return 'nodejs';
    }

    // Check for Java/Maven project
    const pomPath = join(this.projectRoot, 'pom.xml');
    if (await fs.pathExists(pomPath)) {
      this.pomXml = await fs.readFile(pomPath, 'utf8');
      return 'java-maven';
    }

    // Check for Go project
    const goModPath = join(this.projectRoot, 'go.mod');
    if (await fs.pathExists(goModPath)) {
      this.goMod = await fs.readFile(goModPath, 'utf8');
      return 'go';
    }

    // Check for Python project
    const requirementsPath = join(this.projectRoot, 'requirements.txt');
    if (await fs.pathExists(requirementsPath)) {
      this.requirements = await fs.readFile(requirementsPath, 'utf8');
      return 'python';
    }

    const pyprojectPath = join(this.projectRoot, 'pyproject.toml');
    if (await fs.pathExists(pyprojectPath)) {
      this.pyproject = await fs.readFile(pyprojectPath, 'utf8');
      return 'python';
    }

    // Check for Rust project
    const cargoPath = join(this.projectRoot, 'Cargo.toml');
    if (await fs.pathExists(cargoPath)) {
      this.cargoToml = await fs.readFile(cargoPath, 'utf8');
      return 'rust';
    }

    return 'unknown';
  }

  /**
   * Detect programming language
   */
  async _detectLanguage() {
    if (this.packageJson) {
      return 'javascript';
    }
    if (this.pomXml) {
      return 'java';
    }
    if (this.goMod) {
      return 'go';
    }
    if (this.requirements || this.pyproject) {
      return 'python';
    }
    if (this.cargoToml) {
      return 'rust';
    }
    return 'unknown';
  }

  /**
   * Detect backend framework
   */
  async _detectFramework() {
    const deps = this._getDependencies();

    for (const [key, framework] of Object.entries(BACKEND_FRAMEWORKS)) {
      for (const indicator of framework.indicators) {
        if (deps.includes(indicator)) {
          return {
            name: framework.name,
            key,
            language: framework.language,
          };
        }
      }
    }

    return null;
  }

  /**
   * Detect ORM
   */
  async _detectORM() {
    const deps = this._getDependencies();

    for (const [key, orm] of Object.entries(ORM_LIBRARIES)) {
      for (const indicator of orm.indicators) {
        if (deps.includes(indicator)) {
          return {
            name: orm.name,
            key,
            language: orm.language,
          };
        }
      }
    }

    return null;
  }

  /**
   * Detect database
   */
  async _detectDatabase() {
    const deps = this._getDependencies();
    const databases = [];

    for (const [key, db] of Object.entries(DATABASES)) {
      for (const indicator of db.indicators) {
        if (deps.includes(indicator)) {
          databases.push({
            name: db.name,
            key,
          });
          break;
        }
      }
    }

    return databases;
  }

  /**
   * Detect API style (REST, GraphQL, gRPC)
   */
  async _detectAPIStyle() {
    const deps = this._getDependencies();
    const styles = [];

    if (
      deps.includes('graphql') ||
      deps.includes('apollo-server') ||
      deps.includes('@nestjs/graphql')
    ) {
      styles.push('graphql');
    }

    if (deps.includes('grpc') || deps.includes('@grpc/grpc-js')) {
      styles.push('grpc');
    }

    if (
      deps.includes('swagger-ui-express') ||
      deps.includes('@nestjs/swagger') ||
      deps.includes('springdoc')
    ) {
      styles.push('openapi');
    }

    // Default to REST if no specific style detected
    if (styles.length === 0) {
      styles.push('rest');
    }

    return styles;
  }

  /**
   * Detect testing setup
   */
  async _detectTesting() {
    const deps = this._getDependencies();
    const testing = {
      frameworks: [],
    };

    // JavaScript/TypeScript
    if (deps.includes('jest')) {
      testing.frameworks.push('Jest');
    }
    if (deps.includes('mocha')) {
      testing.frameworks.push('Mocha');
    }
    if (deps.includes('supertest')) {
      testing.frameworks.push('Supertest');
    }

    // Python
    if (deps.includes('pytest')) {
      testing.frameworks.push('pytest');
    }
    if (deps.includes('unittest')) {
      testing.frameworks.push('unittest');
    }

    // Java
    if (deps.includes('junit')) {
      testing.frameworks.push('JUnit');
    }
    if (deps.includes('spring-boot-starter-test')) {
      testing.frameworks.push('Spring Test');
    }

    // Go
    if (deps.includes('testify')) {
      testing.frameworks.push('Testify');
    }

    return testing;
  }

  /**
   * Extract code conventions
   */
  async _extractConventions() {
    const conventions = {
      folderStructure: [],
      namingPatterns: [],
    };

    // Check common backend folder structures
    const commonFolders = [
      'controllers',
      'routes',
      'handlers',
      'models',
      'entities',
      'schemas',
      'services',
      'repositories',
      'dao',
      'middleware',
      'filters',
      'interceptors',
      'config',
      'utils',
      'helpers',
    ];

    for (const folder of commonFolders) {
      const folderPath = join(this.projectRoot, 'src', folder);
      if (await fs.pathExists(folderPath)) {
        conventions.folderStructure.push(folder);
      }
    }

    return conventions;
  }

  /**
   * Get dependencies as array of strings
   */
  _getDependencies() {
    const deps = [];

    if (this.packageJson) {
      deps.push(...Object.keys(this.packageJson.dependencies || {}));
      deps.push(...Object.keys(this.packageJson.devDependencies || {}));
    }

    if (this.pomXml) {
      // Extract dependencies from pom.xml
      const matches = this.pomXml.match(/<artifactId>([^<]+)<\/artifactId>/g);
      if (matches) {
        deps.push(...matches.map(m => m.replace(/<\/?artifactId>/g, '')));
      }
    }

    if (this.goMod) {
      const matches = this.goMod.match(/\t([^\s]+)/g);
      if (matches) {
        deps.push(...matches.map(m => m.trim()));
      }
    }

    if (this.requirements) {
      const lines = this.requirements.split('\n');
      for (const line of lines) {
        const match = line.match(/^([a-zA-Z0-9_-]+)/);
        if (match) {
          deps.push(match[1]);
        }
      }
    }

    if (this.cargoToml) {
      const matches = this.cargoToml.match(/([a-zA-Z0-9_-]+)\s*=/g);
      if (matches) {
        deps.push(...matches.map(m => m.replace('=', '').trim()));
      }
    }

    return deps;
  }
}

/**
 * Quick analyze function
 */
export async function analyzeBackend(projectRoot) {
  const analyzer = new BackendAnalyzer(projectRoot);
  return analyzer.analyze();
}
