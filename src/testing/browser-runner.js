/**
 * Browser Runner
 * Playwright-based browser automation for E2E testing
 */

import { TestingError, ErrorCodes } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('BrowserRunner');

/**
 * Browser types
 */
export const BrowserType = {
  CHROMIUM: 'chromium',
  FIREFOX: 'firefox',
  WEBKIT: 'webkit',
};

/**
 * Browser Runner
 */
export class BrowserRunner {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.browser = config.browser || BrowserType.CHROMIUM;
    this.headless = config.headless !== false;
    this.timeout = config.timeout || 30000;
    this.browserInstance = null;
    this.context = null;
    this.page = null;
  }

  /**
   * Initialize browser
   */
  async initialize() {
    logger.debug(`Initializing browser: ${this.browser}`);

    try {
      const playwright = await import('playwright');
      this.playwright = playwright;

      this.browserInstance = await playwright[this.browser].launch({
        headless: this.headless,
      });

      this.context = await this.browserInstance.newContext({
        viewport: this.config.viewport || { width: 1280, height: 720 },
        ...this.config.context,
      });

      this.page = await this.context.newPage();

      logger.debug('Browser initialized');
    } catch (error) {
      throw new TestingError(
        `Failed to initialize browser: ${error.message}`,
        ErrorCodes.BROWSER_NOT_FOUND
      );
    }
  }

  /**
   * Navigate to URL
   * @param {string} url - URL to navigate to
   * @param {Object} options - Navigation options
   */
  async navigate(url, options = {}) {
    if (!this.page) {
      await this.initialize();
    }

    logger.debug(`Navigating to: ${url}`);

    await this.page.goto(url, {
      waitUntil: options.waitUntil || 'networkidle',
      timeout: options.timeout || this.timeout,
    });

    return this;
  }

  /**
   * Click element
   * @param {string} selector - Element selector
   */
  async click(selector) {
    await this.page.click(selector);
    return this;
  }

  /**
   * Fill input
   * @param {string} selector - Input selector
   * @param {string} value - Value to fill
   */
  async fill(selector, value) {
    await this.page.fill(selector, value);
    return this;
  }

  /**
   * Type text
   * @param {string} selector - Input selector
   * @param {string} text - Text to type
   * @param {Object} options - Type options
   */
  async type(selector, text, options = {}) {
    await this.page.type(selector, text, {
      delay: options.delay || 0,
    });
    return this;
  }

  /**
   * Wait for element
   * @param {string} selector - Element selector
   * @param {Object} options - Wait options
   */
  async waitFor(selector, options = {}) {
    await this.page.waitForSelector(selector, {
      state: options.state || 'visible',
      timeout: options.timeout || this.timeout,
    });
    return this;
  }

  /**
   * Get text content
   * @param {string} selector - Element selector
   */
  async getText(selector) {
    return this.page.textContent(selector);
  }

  /**
   * Get attribute value
   * @param {string} selector - Element selector
   * @param {string} attribute - Attribute name
   */
  async getAttribute(selector, attribute) {
    return this.page.getAttribute(selector, attribute);
  }

  /**
   * Take screenshot
   * @param {string} path - Screenshot path
   * @param {Object} options - Screenshot options
   */
  async screenshot(path, options = {}) {
    await this.page.screenshot({
      path,
      fullPage: options.fullPage || false,
    });
    logger.debug(`Screenshot saved: ${path}`);
    return this;
  }

  /**
   * Execute JavaScript
   * @param {Function} fn - Function to execute
   */
  async evaluate(fn) {
    return this.page.evaluate(fn);
  }

  /**
   * Wait for navigation
   * @param {Function} condition - Navigation condition
   * @param {Object} options - Wait options
   */
  async waitForNavigation(options = {}, condition = null) {
    if (condition) {
      await this.page.waitForNavigation({
        waitUntil: options.waitUntil || 'networkidle',
        timeout: options.timeout || this.timeout,
      });
    } else {
      await Promise.all([
        this.page.waitForLoadState('networkidle'),
      ]);
    }
    return this;
  }

  /**
   * Check if element is visible
   * @param {string} selector - Element selector
   */
  async isVisible(selector) {
    return this.page.isVisible(selector);
  }

  /**
   * Check if element exists
   * @param {string} selector - Element selector
   */
  async exists(selector) {
    return (await this.page.$(selector)) !== null;
  }

  /**
   * Get page title
   */
  async getTitle() {
    return this.page.title();
  }

  /**
   * Get current URL
   */
  async getUrl() {
    return this.page.url();
  }

  /**
   * Close browser
   */
  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
    }

    this.page = null;
    logger.debug('Browser closed');
  }

  /**
   * Generate Playwright test script
   * @param {Array} actions - Array of actions to perform
   * @returns {string} Playwright test script
   */
  generatePlaywrightScript(actions) {
    const lines = [
      "import { test, expect } from '@playwright/test';",
      '',
      `test('automated test', async ({ page }) => {`,
    ];

    for (const action of actions) {
      lines.push(...this._generateActionLines(action));
    }

    lines.push('});');

    return lines.join('\n');
  }

  /**
   * Generate action lines for Playwright script
   */
  _generateActionLines(action) {
    const lines = [];

    switch (action.type) {
      case 'navigate':
        lines.push(`  await page.goto('${action.url}');`);
        break;
      case 'click':
        lines.push(`  await page.click('${action.selector}');`);
        break;
      case 'fill':
        lines.push(`  await page.fill('${action.selector}', '${action.value}');`);
        break;
      case 'type':
        lines.push(`  await page.type('${action.selector}', '${action.value}');`);
        break;
      case 'wait':
        lines.push(`  await page.waitForSelector('${action.selector}');`);
        break;
      case 'screenshot':
        lines.push(`  await page.screenshot({ path: '${action.path}' });`);
        break;
      case 'assert':
        lines.push(`  await expect(page.locator('${action.selector}')).${action.assertion}(${action.value ? `'${action.value}'` : ''});`);
        break;
      case 'waitForNavigation':
        lines.push(`  await page.waitForNavigation();`);
        break;
    }

    return lines;
  }

  /**
   * Run E2E test scenario
   * @param {Object} scenario - Test scenario
   * @returns {Promise<Object>} Test results
   */
  async runScenario(scenario) {
    logger.info(`Running E2E scenario: ${scenario.name}`);

    const results = {
      name: scenario.name,
      steps: [],
      passed: true,
      errors: [],
      screenshots: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Initialize browser if needed
      if (!this.page) {
        await this.initialize();
      }

      // Execute each step
      for (const step of scenario.steps || []) {
        const stepResult = {
          step: step.name || step.action,
          success: true,
        };

        try {
          await this._executeStep(step);
          results.steps.push(stepResult);
        } catch (error) {
          stepResult.success = false;
          stepResult.error = error.message;

          // Take screenshot on failure
          const screenshotPath = `test-results/failure-${Date.now()}.png`;
          await this.screenshot(screenshotPath);
          stepResult.screenshot = screenshotPath;
          results.screenshots.push(screenshotPath);

          results.passed = false;
          results.errors.push(error.message);
        }

        // Take screenshot after each step if requested
        if (step.screenshot) {
          const path = `test-results/step-${step.name}-${Date.now()}.png`;
          await this.screenshot(path);
          stepResult.screenshot = path;
        }
      }

    } catch (error) {
      results.error = error.message;
      results.passed = false;
    } finally {
      await this.close();
    }

    return results;
  }

  /**
   * Execute a single step
   */
  async _executeStep(step) {
    switch (step.action) {
      case 'navigate':
        await this.navigate(step.url, step.options);
        break;
      case 'click':
        await this.click(step.selector);
        break;
      case 'fill':
        await this.fill(step.selector, step.value);
        break;
      case 'type':
        await this.type(step.selector, step.value, step.options);
        break;
      case 'wait':
        await this.waitFor(step.selector, step.options);
        break;
      case 'screenshot':
        await this.screenshot(step.path);
        break;
      case 'waitForNavigation':
        await this.waitForNavigation();
        break;
      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
  }
}

/**
 * Create browser runner
 */
export function createBrowserRunner(config = {}) {
  return new BrowserRunner(config);
}
