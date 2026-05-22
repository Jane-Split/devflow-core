/**
 * Convention Extractor
 * Extracts naming conventions, file organization patterns from source code
 */

import { basename, extname, join } from 'path';
import fs from 'fs-extra';
import { glob } from 'glob';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ConventionExtractor');

/**
 * Naming convention patterns
 */
const NAMING_PATTERNS = {
  pascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  kebabCase: /^[a-z0-9]+(-[a-z0-9]+)*$/,
  snakeCase: /^[a-z0-9]+(_[a-z0-9]+)*$/,
  upperSnakeCase: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
};

/**
 * Convention Extractor
 */
export class ConventionExtractor {
  /**
   * @param {string} projectRoot - Project root directory
   */
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.files = [];
    this.directories = [];
  }

  /**
   * Extract all conventions
   * @returns {Promise<Object>} Extracted conventions
   */
  async extract() {
    logger.debug(`Extracting conventions from ${this.projectRoot}`);

    // Scan project structure
    await this._scanProject();

    const conventions = {
      naming: await this._extractNamingConventions(),
      fileOrganization: await this._extractFileOrganization(),
      folderStructure: await this._extractFolderStructure(),
      importPatterns: await this._extractImportPatterns(),
      codeStyle: await this._extractCodeStyle(),
    };

    logger.debug('Convention extraction complete');
    return conventions;
  }

  /**
   * Scan project for files and directories
   */
  async _scanProject() {
    const srcDir = join(this.projectRoot, 'src');

    if (!(await fs.pathExists(srcDir))) {
      // Try to find source files in root
      this.files = await glob('**/*.{js,ts,jsx,tsx,vue,py,java,go,rs}', {
        cwd: this.projectRoot,
        ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**'],
      });
    } else {
      this.files = await glob('**/*.{js,ts,jsx,tsx,vue,py,java,go,rs}', {
        cwd: srcDir,
        ignore: ['node_modules/**', 'dist/**', 'build/**'],
      });
    }

    // Get unique directories
    const dirSet = new Set();
    for (const file of this.files) {
      const parts = file.split('/');
      for (let i = 1; i < parts.length; i++) {
        dirSet.add(parts.slice(0, i).join('/'));
      }
    }
    this.directories = Array.from(dirSet);
  }

  /**
   * Extract naming conventions
   */
  async _extractNamingConventions() {
    const naming = {
      components: this._detectNamingPattern(this._getComponentFiles()),
      functions: this._detectNamingPattern(this._getFunctionFiles()),
      constants: this._detectNamingPattern(this._getConstantFiles()),
      hooks: this._detectNamingPattern(this._getHookFiles()),
      utils: this._detectNamingPattern(this._getUtilFiles()),
    };

    // Determine dominant patterns
    naming.componentPattern = naming.components.dominant;
    naming.functionPattern = naming.functions.dominant;
    naming.constantPattern = naming.constants.dominant;

    return naming;
  }

  /**
   * Get component files
   */
  _getComponentFiles() {
    return this.files.filter(f => {
      const name = basename(f, extname(f));
      return (
        f.includes('/components/') ||
        f.includes('/Component') ||
        NAMING_PATTERNS.pascalCase.test(name)
      );
    });
  }

  /**
   * Get function files
   */
  _getFunctionFiles() {
    return this.files.filter(f => {
      const name = basename(f, extname(f));
      return (
        f.includes('/utils/') ||
        f.includes('/helpers/') ||
        f.includes('/functions/') ||
        NAMING_PATTERNS.camelCase.test(name)
      );
    });
  }

  /**
   * Get constant files
   */
  _getConstantFiles() {
    return this.files.filter(f => {
      const name = basename(f, extname(f));
      return (
        f.includes('/constants/') ||
        f.includes('/const/') ||
        NAMING_PATTERNS.upperSnakeCase.test(name)
      );
    });
  }

  /**
   * Get hook files
   */
  _getHookFiles() {
    return this.files.filter(f => {
      const name = basename(f, extname(f));
      return f.includes('/hooks/') || name.startsWith('use') || name.startsWith('use-');
    });
  }

  /**
   * Get utility files
   */
  _getUtilFiles() {
    return this.files.filter(f => {
      return f.includes('/utils/') || f.includes('/helpers/') || f.includes('/lib/');
    });
  }

  /**
   * Detect naming pattern from file names
   */
  _detectNamingPattern(files) {
    const counts = {
      pascalCase: 0,
      camelCase: 0,
      kebabCase: 0,
      snakeCase: 0,
      upperSnakeCase: 0,
    };

    for (const file of files) {
      const name = basename(file, extname(file));

      for (const [pattern, regex] of Object.entries(NAMING_PATTERNS)) {
        if (regex.test(name)) {
          counts[pattern]++;
        }
      }
    }

    // Find dominant pattern
    let dominant = 'unknown';
    let maxCount = 0;

    for (const [pattern, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = pattern;
      }
    }

    return {
      dominant: maxCount > 0 ? dominant : 'unknown',
      counts,
      sampleFiles: files.slice(0, 5),
    };
  }

  /**
   * Extract file organization patterns
   */
  async _extractFileOrganization() {
    const organization = {
      byFeature: false,
      byType: false,
      byLayer: false,
      patterns: [],
    };

    // Check for feature-based organization
    const hasFeatures = this.directories.some(
      d => d.includes('/features/') || d.includes('/modules/')
    );

    // Check for type-based organization
    const hasTypes = this.directories.some(
      d => d.includes('/components/') && d.includes('/hooks/') && d.includes('/utils/')
    );

    // Check for layer-based organization (common in backend)
    const hasLayers = this.directories.some(
      d => d.includes('/controllers/') || d.includes('/services/') || d.includes('/repositories/')
    );

    organization.byFeature = hasFeatures;
    organization.byType = hasTypes;
    organization.byLayer = hasLayers;

    // Determine primary pattern
    if (hasFeatures) {
      organization.patterns.push('feature-based');
    }
    if (hasTypes) {
      organization.patterns.push('type-based');
    }
    if (hasLayers) {
      organization.patterns.push('layer-based');
    }

    return organization;
  }

  /**
   * Extract folder structure
   */
  async _extractFolderStructure() {
    const structure = {
      root: [],
      src: [],
      commonFolders: [],
    };

    // Common folder patterns
    const commonPatterns = {
      components: 'UI Components',
      pages: 'Pages/Routes',
      hooks: 'Custom Hooks',
      utils: 'Utilities',
      services: 'Services/API',
      store: 'State Management',
      assets: 'Static Assets',
      styles: 'Styles/CSS',
      types: 'TypeScript Types',
      api: 'API Definitions',
      lib: 'Library Code',
      config: 'Configuration',
      tests: 'Tests',
      __tests__: 'Tests',
      fixtures: 'Test Fixtures',
      mocks: 'Mocks',
    };

    for (const dir of this.directories) {
      const folderName = dir.split('/').pop();

      if (commonPatterns[folderName]) {
        structure.commonFolders.push({
          name: folderName,
          description: commonPatterns[folderName],
          path: dir,
        });
      }
    }

    return structure;
  }

  /**
   * Extract import patterns
   */
  async _extractImportPatterns() {
    const patterns = {
      usesPathAliases: false,
      usesAbsoluteImports: false,
      usesRelativeImports: true,
      aliases: [],
    };

    // Check tsconfig.json or jsconfig.json for path aliases
    const tsConfigPath = join(this.projectRoot, 'tsconfig.json');
    const jsConfigPath = join(this.projectRoot, 'jsconfig.json');

    let config = null;
    if (await fs.pathExists(tsConfigPath)) {
      config = await fs.readJson(tsConfigPath);
    } else if (await fs.pathExists(jsConfigPath)) {
      config = await fs.readJson(jsConfigPath);
    }

    if (config?.compilerOptions?.paths) {
      patterns.usesPathAliases = true;
      patterns.aliases = Object.keys(config.compilerOptions.paths);

      if (config.compilerOptions.baseUrl) {
        patterns.usesAbsoluteImports = true;
      }
    }

    // Check vite.config.js for aliases
    const viteConfigPath = join(this.projectRoot, 'vite.config.js');
    if (await fs.pathExists(viteConfigPath)) {
      const content = await fs.readFile(viteConfigPath, 'utf8');
      if (content.includes('resolve') && content.includes('alias')) {
        patterns.usesPathAliases = true;
      }
    }

    return patterns;
  }

  /**
   * Extract code style patterns
   */
  async _extractCodeStyle() {
    const style = {
      usesTypeScript: false,
      usesJsx: false,
      usesStrictMode: false,
      indentStyle: 'unknown',
      quoteStyle: 'unknown',
      semicolons: true,
    };

    // Check for TypeScript
    const tsFiles = this.files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    style.usesTypeScript = tsFiles.length > 0;

    // Check for JSX
    const jsxFiles = this.files.filter(f => f.endsWith('.jsx') || f.endsWith('.tsx'));
    style.usesJsx = jsxFiles.length > 0;

    // Sample a few files to detect style
    const sampleFiles = this.files.slice(0, 5);

    for (const file of sampleFiles) {
      try {
        const filePath = join(this.projectRoot, 'src', file);
        if (await fs.pathExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf8');

          // Detect indent style
          if (content.includes('  ')) {
            style.indentStyle = 'space-2';
          } else if (content.includes('    ')) {
            style.indentStyle = 'space-4';
          } else if (content.includes('\t')) {
            style.indentStyle = 'tab';
          }

          // Detect quote style
          const singleQuotes = (content.match(/'/g) || []).length;
          const doubleQuotes = (content.match(/"/g) || []).length;
          if (singleQuotes > doubleQuotes) {
            style.quoteStyle = 'single';
          } else if (doubleQuotes > singleQuotes) {
            style.quoteStyle = 'double';
          }

          // Detect semicolons
          const linesWithoutSemicolons = content.split('\n').filter(line => {
            const trimmed = line.trim();
            return (
              trimmed.length > 0 &&
              !trimmed.startsWith('//') &&
              !trimmed.startsWith('import') &&
              !trimmed.startsWith('export') &&
              !trimmed.endsWith(';') &&
              !trimmed.endsWith('{') &&
              !trimmed.endsWith('}')
            );
          });

          if (linesWithoutSemicolons.length > 10) {
            style.semicolons = false;
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }

    return style;
  }

  /**
   * Generate AGENTS.md content from extracted conventions
   */
  async generateAgentsMd(projectInfo = {}) {
    const conventions = await this.extract();

    return `# Project Rules for AI Agents

> Auto-generated from project analysis
> Last updated: ${new Date().toISOString()}

## Project Overview

- **Name**: ${projectInfo.name || 'Unknown'}
- **Type**: ${projectInfo.type || 'Unknown'}
- **Framework**: ${projectInfo.framework || 'Unknown'}

## Naming Conventions

### Components
- Pattern: ${conventions.naming.componentPattern}
- Example: ${conventions.naming.components.sampleFiles[0] || 'N/A'}

### Functions
- Pattern: ${conventions.naming.functionPattern}

### Constants
- Pattern: ${conventions.naming.constantPattern}

## File Organization

- Primary Pattern: ${conventions.fileOrganization.patterns.join(', ') || 'Mixed'}
- ${conventions.fileOrganization.byFeature ? '✓' : '✗'} Feature-based organization
- ${conventions.fileOrganization.byType ? '✓' : '✗'} Type-based organization
- ${conventions.fileOrganization.byLayer ? '✓' : '✗'} Layer-based organization

## Folder Structure

${conventions.folderStructure.commonFolders.map(f => `- \`${f.path}\` - ${f.description}`).join('\n')}

## Import Patterns

- ${conventions.importPatterns.usesPathAliases ? '✓' : '✗'} Path aliases
- ${conventions.importPatterns.usesAbsoluteImports ? '✓' : '✗'} Absolute imports
- Aliases: ${conventions.importPatterns.aliases.join(', ') || 'None'}

## Code Style

- ${conventions.codeStyle.usesTypeScript ? '✓' : '✗'} TypeScript
- ${conventions.codeStyle.usesJsx ? '✓' : '✗'} JSX
- Indent: ${conventions.codeStyle.indentStyle}
- Quotes: ${conventions.codeStyle.quoteStyle}
- Semicolons: ${conventions.codeStyle.semicolons ? 'Required' : 'Optional'}
`;
  }
}

/**
 * Quick extract function
 */
export async function extractConventions(projectRoot) {
  const extractor = new ConventionExtractor(projectRoot);
  return extractor.extract();
}
