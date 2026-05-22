/**
 * Test Runner
 * Executes tests and parses results
 */

import { spawn } from 'child_process';
import { ErrorCodes, TestingError } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('TestRunner');

/**
 * Test result status
 */
export const TestStatus = {
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  PENDING: 'pending',
};

/**
 * Test Runner
 */
export class TestRunner {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.projectRoot = config.projectRoot || process.cwd();
    this.framework = config.framework || 'jest';
  }

  /**
   * Run unit tests
   * @param {Object} options - Run options
   * @returns {Promise<Object>} Test results
   */
  async runUnitTests(options = {}) {
    const { pattern = '**/*.test.js', coverage = false, watch = false, update = false } = options;

    logger.info('Running unit tests...');

    const args = [...this._buildJestArgs({ pattern, coverage, watch, update })];

    return this._runCommand('jest', args);
  }

  /**
   * Run integration tests
   * @param {Object} options - Run options
   * @returns {Promise<Object>} Test results
   */
  async runIntegrationTests(options = {}) {
    const { pattern = 'integration/**/*.test.js', coverage = false } = options;

    logger.info('Running integration tests...');

    const args = this._buildJestArgs({ pattern, coverage });

    return this._runCommand('jest', args);
  }

  /**
   * Run E2E tests
   * @param {Object} options - Run options
   * @returns {Promise<Object>} Test results
   */
  async runE2ETests(options = {}) {
    const {
      pattern = 'e2e/**/*.spec.ts',
      browser = 'chromium',
      headed = false,
      timeout = 30000,
    } = options;

    logger.info(`Running E2E tests on ${browser}...`);

    const args = [
      pattern,
      '--project',
      browser,
      !headed && '--headed' !== headed ? '--headed' : '',
      `--timeout=${timeout}`,
    ].filter(Boolean);

    return this._runCommand('playwright', ['test', ...args]);
  }

  /**
   * Run all tests
   * @param {Object} options - Run options
   * @returns {Promise<Object>} Combined test results
   */
  async runAllTests(options = {}) {
    const results = {
      unit: null,
      integration: null,
      e2e: null,
      timestamp: new Date().toISOString(),
    };

    // Run unit tests
    try {
      results.unit = await this.runUnitTests(options);
    } catch (error) {
      results.unit = { status: 'error', error: error.message };
    }

    // Run integration tests
    if (options.includeIntegration !== false) {
      try {
        results.integration = await this.runIntegrationTests(options);
      } catch (error) {
        results.integration = { status: 'error', error: error.message };
      }
    }

    // Run E2E tests
    if (options.includeE2E) {
      try {
        results.e2e = await this.runE2ETests(options);
      } catch (error) {
        results.e2e = { status: 'error', error: error.message };
      }
    }

    // Calculate summary
    results.summary = this._calculateSummary(results);

    return results;
  }

  /**
   * Run a specific test file
   * @param {string} filePath - Test file path
   * @param {Object} options - Run options
   * @returns {Promise<Object>} Test results
   */
  async runTestFile(filePath, options = {}) {
    logger.info(`Running test file: ${filePath}`);

    const args = [filePath, ...this._buildJestArgs(options)];

    return this._runCommand('jest', args);
  }

  /**
   * Build Jest arguments
   */
  _buildJestArgs(options = {}) {
    const args = [];

    if (options.coverage) {
      args.push('--coverage');
    }

    if (options.watch) {
      args.push('--watch');
    }

    if (options.update) {
      args.push('--updateSnapshot');
    }

    if (options.pattern) {
      args.push(options.pattern);
    }

    // Pass through additional Jest options
    if (options.jestArgs) {
      args.push(...options.jestArgs);
    }

    return args;
  }

  /**
   * Run a command
   */
  async _runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: this.projectRoot,
        stdio: 'pipe',
        shell: process.platform === 'win32',
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', data => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', data => {
        stderr += data.toString();
      });

      proc.on('close', code => {
        try {
          const results = this._parseOutput(stdout, stderr, code);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      });

      proc.on('error', error => {
        reject(
          new TestingError(
            `Failed to run tests: ${error.message}`,
            ErrorCodes.TEST_EXECUTION_FAILED
          )
        );
      });
    });
  }

  /**
   * Parse test output
   */
  _parseOutput(stdout, stderr, exitCode) {
    const results = {
      exitCode,
      success: exitCode === 0,
      output: stdout,
      errors: stderr,
      timestamp: new Date().toISOString(),
    };

    // Try to parse JSON output
    const jsonMatch = stdout.match(/\{[\s\S]*"success"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        Object.assign(results, JSON.parse(jsonMatch[0]));
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Parse coverage from output
    const coverageMatch = stdout.match(/All files[^]*?\d+\.\d+%/);
    if (coverageMatch) {
      results.coverage = this._parseCoverage(coverageMatch[0]);
    }

    // Parse test counts
    const testMatch = stdout.match(
      /Tests:\s+(?:(\d+)\s+passed?,\s+)?(\d+)\s+failed?(?:,\s+(\d+)\s+skipped?)?/
    );
    if (testMatch) {
      results.tests = {
        passed: parseInt(testMatch[1]) || 0,
        failed: parseInt(testMatch[2]) || 0,
        skipped: parseInt(testMatch[3]) || 0,
        total:
          (parseInt(testMatch[1]) || 0) +
          (parseInt(testMatch[2]) || 0) +
          (parseInt(testMatch[3]) || 0),
      };
    }

    return results;
  }

  /**
   * Parse coverage report
   */
  _parseCoverage(coverageText) {
    const lines = coverageText.split('\n');
    const coverage = {};

    for (const line of lines) {
      const match = line.match(/^\s*([^\s|]+)\s*[|]\s*([\d.]+)%/);
      if (match) {
        const type = match[1];
        const percent = parseFloat(match[2]);
        coverage[type] = {
          percent,
          covered: percent >= 80,
        };
      }
    }

    return coverage;
  }

  /**
   * Calculate summary
   */
  _calculateSummary(results) {
    const summary = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      coverage: null,
      success: true,
    };

    for (const [key, result] of Object.entries(results)) {
      if (key === 'summary' || key === 'timestamp') {
        continue;
      }

      if (result?.tests) {
        summary.totalTests += result.tests.total;
        summary.passed += result.tests.passed;
        summary.failed += result.tests.failed;
        summary.skipped += result.tests.skipped;

        if (result.tests.failed > 0) {
          summary.success = false;
        }
      }

      if (result?.coverage) {
        summary.coverage = result.coverage;
      }
    }

    summary.passRate =
      summary.totalTests > 0
        ? `${((summary.passed / summary.totalTests) * 100).toFixed(2)}%`
        : 'N/A';

    return summary;
  }

  /**
   * Watch mode
   */
  watch(_onChange) {
    logger.info('Starting test watcher...');

    const proc = spawn('jest', ['--watch', '--verbose'], {
      cwd: this.projectRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    proc.on('close', code => {
      if (code !== 0) {
        logger.error(`Test watcher exited with code ${code}`);
      }
    });

    return proc;
  }
}

/**
 * Create test runner
 */
export function createTestRunner(config = {}) {
  return new TestRunner(config);
}
