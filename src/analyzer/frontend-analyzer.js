/**
 * Frontend Analyzer
 * Analyzes frontend projects to extract framework, components, styling, etc.
 */

import { join } from 'path';
import fs from 'fs-extra';
import glob from 'glob';
import { AnalysisError, ErrorCodes } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('FrontendAnalyzer');

/**
 * Frontend frameworks
 */
const FRAMEWORKS = {
  react: {
    name: 'React',
    indicators: ['react', 'react-dom', 'next', 'remix'],
    filePatterns: ['**/*.jsx', '**/*.tsx', '**/pages/**/*.js', '**/app/**/*.js'],
  },
  vue: {
    name: 'Vue',
    indicators: ['vue', 'vue-router', 'vuex', 'pinia', 'nuxt'],
    filePatterns: ['**/*.vue', '**/nuxt.config.*'],
  },
  angular: {
    name: 'Angular',
    indicators: ['@angular/core', '@angular/common', '@angular/cli'],
    filePatterns: ['**/*.component.ts', '**/angular.json'],
  },
  svelte: {
    name: 'Svelte',
    indicators: ['svelte', 'svelte-kit'],
    filePatterns: ['**/*.svelte', '**/svelte.config.*'],
  },
};

/**
 * UI component libraries
 */
const UI_LIBRARIES = {
  antd: { name: 'Ant Design', indicators: ['antd', '@ant-design/react-sass'] },
  mui: { name: 'Material-UI', indicators: ['@mui/material', '@material-ui/core'] },
  elementPlus: { name: 'Element Plus', indicators: ['element-plus'] },
  vuetify: { name: 'Vuetify', indicators: ['vuetify'] },
  bootstrap: { name: 'Bootstrap', indicators: ['bootstrap', 'react-bootstrap'] },
  tailwind: { name: 'Tailwind CSS', indicators: ['tailwindcss'] },
  chakra: { name: 'Chakra UI', indicators: ['@chakra-ui/react'] },
};

/**
 * State management libraries
 */
const STATE_MANAGEMENT = {
  redux: { name: 'Redux', indicators: ['redux', 'react-redux', '@reduxjs/toolkit'] },
  zustand: { name: 'Zustand', indicators: ['zustand'] },
  jotai: { name: 'Jotai', indicators: ['jotai'] },
  recoil: { name: 'Recoil', indicators: ['recoil'] },
  pinia: { name: 'Pinia', indicators: ['pinia'] },
  vuex: { name: 'Vuex', indicators: ['vuex'] },
  mobx: { name: 'MobX', indicators: ['mobx', 'mobx-react'] },
};

/**
 * Frontend Analyzer
 */
export class FrontendAnalyzer {
  /**
   * @param {string} projectRoot - Project root directory
   */
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.packageJson = null;
  }

  /**
   * Analyze frontend project
   * @returns {Promise<Object>} Analysis result
   */
  async analyze() {
    logger.debug(`Analyzing frontend project in ${this.projectRoot}`);

    // Load package.json
    await this._loadPackageJson();

    const analysis = {
      framework: await this._detectFramework(),
      uiLibrary: await this._detectUILibrary(),
      styling: await this._detectStyling(),
      stateManagement: await this._detectStateManagement(),
      routing: await this._detectRouting(),
      buildTool: await this._detectBuildTool(),
      testing: await this._detectTesting(),
      conventions: await this._extractConventions(),
    };

    logger.debug('Frontend analysis complete');
    return analysis;
  }

  /**
   * Load package.json
   */
  async _loadPackageJson() {
    const packagePath = join(this.projectRoot, 'package.json');
    
    if (!(await fs.pathExists(packagePath))) {
      throw new AnalysisError(
        'package.json not found',
        ErrorCodes.PROJECT_TYPE_UNKNOWN
      );
    }

    this.packageJson = await fs.readJson(packagePath);
  }

  /**
   * Detect frontend framework
   */
  async _detectFramework() {
    const deps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };

    for (const [key, framework] of Object.entries(FRAMEWORKS)) {
      for (const indicator of framework.indicators) {
        if (deps[indicator]) {
          return {
            name: framework.name,
            key,
            version: deps[indicator],
          };
        }
      }
    }

    return { name: 'Unknown', key: 'unknown', version: null };
  }

  /**
   * Detect UI component library
   */
  async _detectUILibrary() {
    const deps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };

    for (const [key, lib] of Object.entries(UI_LIBRARIES)) {
      for (const indicator of lib.indicators) {
        if (deps[indicator]) {
          return {
            name: lib.name,
            key,
            version: deps[indicator],
          };
        }
      }
    }

    return null;
  }

  /**
   * Detect styling approach
   */
  async _detectStyling() {
    const deps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };

    const styling = {
      approach: 'css',
      libraries: [],
    };

    if (deps.tailwindcss) {
      styling.approach = 'tailwind';
      styling.libraries.push({ name: 'Tailwind CSS', version: deps.tailwindcss });
    }

    if (deps.sass || deps['node-sass']) {
      styling.libraries.push({
        name: 'Sass',
        version: deps.sass || deps['node-sass'],
      });
    }

    if (deps['styled-components']) {
      styling.approach = 'css-in-js';
      styling.libraries.push({
        name: 'styled-components',
        version: deps['styled-components'],
      });
    }

    if (deps['@emotion/react'] || deps['@emotion/styled']) {
      styling.approach = 'css-in-js';
      styling.libraries.push({ name: 'Emotion', version: deps['@emotion/react'] });
    }

    // Check for CSS Modules
    const srcDir = join(this.projectRoot, 'src');
    if (await fs.pathExists(srcDir)) {
      try {
        const files = await fs.readdir(srcDir, { recursive: true });
        const hasCssModules = files.some(f => f.endsWith('.module.css') || f.endsWith('.module.scss'));
        if (hasCssModules) {
          styling.hasCssModules = true;
        }
      } catch {
        // Ignore
      }
    }

    return styling;
  }

  /**
   * Detect state management
   */
  async _detectStateManagement() {
    const deps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };

    const stateManagement = {
      primary: null,
      libraries: [],
    };

    for (const [key, lib] of Object.entries(STATE_MANAGEMENT)) {
      for (const indicator of lib.indicators) {
        if (deps[indicator]) {
          const libInfo = {
            name: lib.name,
            key,
            version: deps[indicator],
          };
          
          stateManagement.libraries.push(libInfo);
          
          if (!stateManagement.primary) {
            stateManagement.primary = libInfo;
          }
        }
      }
    }

    return stateManagement;
  }

  /**
   * Detect routing
   */
  async _detectRouting() {
    const deps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };

    if (deps['react-router-dom']) {
      return {
        library: 'React Router',
        version: deps['react-router-dom'],
      };
    }

    if (deps['vue-router']) {
      return {
        library: 'Vue Router',
        version: deps['vue-router'],
      };
    }

    if (deps['@angular/router']) {
      return {
        library: 'Angular Router',
        version: deps['@angular/router'],
      };
    }

    if (deps.next) {
      return {
        library: 'Next.js File-based Routing',
        version: deps.next,
      };
    }

    if (deps.nuxt) {
      return {
        library: 'Nuxt File-based Routing',
        version: deps.nuxt,
      };
    }

    return null;
  }

  /**
   * Detect build tool
   */
  async _detectBuildTool() {
    const deps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };

    if (deps.vite) {
      return { name: 'Vite', version: deps.vite };
    }

    if (deps.webpack) {
      return { name: 'Webpack', version: deps.webpack };
    }

    if (deps['@angular/cli']) {
      return { name: 'Angular CLI', version: deps['@angular/cli'] };
    }

    if (deps.next) {
      return { name: 'Next.js', version: deps.next };
    }

    if (deps.nuxt) {
      return { name: 'Nuxt', version: deps.nuxt };
    }

    // Check for config files
    const configFiles = [
      { name: 'Vite', file: 'vite.config.js' },
      { name: 'Webpack', file: 'webpack.config.js' },
      { name: 'Rollup', file: 'rollup.config.js' },
      { name: 'Parcel', file: '.parcelrc' },
    ];

    for (const { name, file } of configFiles) {
      if (await fs.pathExists(join(this.projectRoot, file))) {
        return { name, version: null };
      }
    }

    return { name: 'Unknown', version: null };
  }

  /**
   * Detect testing setup
   */
  async _detectTesting() {
    const deps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };

    const testing = {
      frameworks: [],
      hasE2E: false,
    };

    if (deps.jest) {
      testing.frameworks.push({ name: 'Jest', version: deps.jest });
    }

    if (deps.vitest) {
      testing.frameworks.push({ name: 'Vitest', version: deps.vitest });
    }

    if (deps['@testing-library/react'] || deps['@testing-library/vue'] || deps['@testing-library/angular']) {
      testing.frameworks.push({ name: 'Testing Library', version: deps['@testing-library/react'] });
    }

    if (deps.cypress) {
      testing.hasE2E = true;
      testing.e2eFramework = { name: 'Cypress', version: deps.cypress };
    }

    if (deps['@playwright/test']) {
      testing.hasE2E = true;
      testing.e2eFramework = { name: 'Playwright', version: deps['@playwright/test'] };
    }

    return testing;
  }

  /**
   * Extract code conventions
   */
  async _extractConventions() {
    const conventions = {
      componentNaming: 'unknown',
      fileNaming: 'unknown',
      folderStructure: [],
    };

    const srcDir = join(this.projectRoot, 'src');
    if (!(await fs.pathExists(srcDir))) {
      return conventions;
    }

    try {
      const entries = await fs.readdir(srcDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          conventions.folderStructure.push(entry.name);
        }
      }

      // Detect naming conventions from files
      const allFiles = await fs.readdir(srcDir, { recursive: true });
      
      const hasPascalCase = allFiles.some(f => /^[A-Z][a-zA-Z0-9]*\.(jsx?|tsx?|vue)$/.test(f));
      const hasKebabCase = allFiles.some(f => /^[a-z0-9]+(-[a-z0-9]+)*\.(jsx?|tsx?|vue)$/.test(f));

      if (hasPascalCase) {
        conventions.componentNaming = 'PascalCase';
      }
      if (hasKebabCase) {
        conventions.fileNaming = 'kebab-case';
      }
    } catch {
      // Ignore errors
    }

    return conventions;
  }
}

/**
 * Quick analyze function
 */
export async function analyzeFrontend(projectRoot) {
  const analyzer = new FrontendAnalyzer(projectRoot);
  return analyzer.analyze();
}
