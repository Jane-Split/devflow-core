/**
 * Test Reporter
 * Generates comprehensive test reports in multiple formats
 */

import { Logger } from '../utils/logger.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const logger = new Logger('TestReporter');

/**
 * Report formats
 */
export const ReportFormat = {
  JSON: 'json',
  MARKDOWN: 'markdown',
  HTML: 'html',
  JUNIT: 'junit',
};

/**
 * Test status
 */
export const TestStatus = {
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  PENDING: 'pending',
};

/**
 * Test Report
 */
export class TestReport {
  constructor(data = {}) {
    this.id = data.id || `report-${Date.now()}`;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.projectName = data.projectName || 'Unknown Project';
    this.environment = data.environment || {};
    this.summary = data.summary || {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
    };
    this.testSuites = data.testSuites || [];
    this.coverage = data.coverage || null;
    this.failures = data.failures || [];
  }
}

/**
 * Test Suite
 */
export class TestSuite {
  constructor(data = {}) {
    this.name = data.name || 'Unnamed Suite';
    this.file = data.file || '';
    this.tests = data.tests || [];
    this.duration = data.duration || 0;
    this.status = data.status || TestStatus.PENDING;
  }
}

/**
 * Test Case
 */
export class TestCase {
  constructor(data = {}) {
    this.name = data.name || 'Unnamed Test';
    this.status = data.status || TestStatus.PENDING;
    this.duration = data.duration || 0;
    this.error = data.error || null;
    this.stackTrace = data.stackTrace || null;
    this.retries = data.retries || 0;
  }
}

/**
 * Test Reporter
 */
export class TestReporter {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.projectRoot = config.projectRoot || process.cwd();
    this.outputDir = config.outputDir || join(this.projectRoot, '.ai-memory', 'reports');
    this.formats = config.formats || [ReportFormat.MARKDOWN, ReportFormat.JSON];
  }

  /**
   * Generate report from test results
   * @param {Object} testResults - Test execution results
   * @param {Object} options - Report options
   * @returns {Promise<TestReport>} Generated report
   */
  async generateReport(testResults, options = {}) {
    logger.info('Generating test report...');

    const report = new TestReport({
      projectName: options.projectName || this.config.projectName || 'DevFlow Project',
      environment: {
        node: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString(),
      },
      summary: this._calculateSummary(testResults),
      testSuites: this._processTestSuites(testResults),
      coverage: testResults.coverage || null,
      failures: this._extractFailures(testResults),
    });

    // Save report in each format
    for (const format of this.formats) {
      await this._saveReport(report, format);
    }

    logger.info(`Report generated: ${report.id}`);
    return report;
  }

  /**
   * Calculate summary statistics
   * @param {Object} testResults - Test results
   * @returns {Object} Summary
   */
  _calculateSummary(testResults) {
    const summary = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      passRate: 0,
    };

    const suites = testResults.testResults || testResults.suites || [];

    for (const suite of suites) {
      const tests = suite.tests || suite.testResults || [];
      for (const test of tests) {
        summary.total++;
        summary.duration += test.duration || 0;

        if (test.status === 'passed' || test.status === TestStatus.PASSED) {
          summary.passed++;
        } else if (test.status === 'failed' || test.status === TestStatus.FAILED) {
          summary.failed++;
        } else if (test.status === 'skipped' || test.status === TestStatus.SKIPPED) {
          summary.skipped++;
        }
      }
    }

    summary.passRate = summary.total > 0
      ? ((summary.passed / summary.total) * 100).toFixed(1)
      : 0;

    return summary;
  }

  /**
   * Process test suites
   * @param {Object} testResults - Test results
   * @returns {Array} Processed test suites
   */
  _processTestSuites(testResults) {
    const suites = testResults.testResults || testResults.suites || [];

    return suites.map(suite => {
      const testSuite = new TestSuite({
        name: suite.name || suite.testFilePath || 'Unknown Suite',
        file: suite.testFilePath || suite.file || '',
        duration: suite.duration || 0,
        status: this._determineSuiteStatus(suite),
        tests: (suite.tests || suite.testResults || []).map(test => new TestCase({
          name: test.name || test.fullName || test.title || 'Unknown Test',
          status: test.status || (test.passed ? TestStatus.PASSED : TestStatus.FAILED),
          duration: test.duration || 0,
          error: test.error || test.failureMessage || null,
          stackTrace: test.stackTrace || test.failureMessages?.join('\n') || null,
          retries: test.retryCount || 0,
        })),
      });

      return testSuite;
    });
  }

  /**
   * Determine suite status
   * @param {Object} suite - Test suite
   * @returns {string} Status
   */
  _determineSuiteStatus(suite) {
    if (suite.status) return suite.status;
    if (suite.numFailingTests > 0) return TestStatus.FAILED;
    if (suite.numPendingTests > 0) return TestStatus.PENDING;
    return TestStatus.PASSED;
  }

  /**
   * Extract failures from test results
   * @param {Object} testResults - Test results
   * @returns {Array} Failures
   */
  _extractFailures(testResults) {
    const failures = [];
    const suites = testResults.testResults || testResults.suites || [];

    for (const suite of suites) {
      const tests = suite.tests || suite.testResults || [];
      for (const test of tests) {
        if (test.status === 'failed' || test.status === TestStatus.FAILED || test.failureMessage) {
          failures.push({
            suite: suite.name || suite.testFilePath,
            test: test.name || test.fullName || test.title,
            error: test.error || test.failureMessage,
            stackTrace: test.stackTrace || test.failureMessages?.join('\n'),
          });
        }
      }
    }

    return failures;
  }

  /**
   * Save report in specified format
   * @param {TestReport} report - Report to save
   * @param {string} format - Report format
   */
  async _saveReport(report, format) {
    // Ensure output directory exists
    mkdirSync(this.outputDir, { recursive: true });

    const filename = `test-report-${report.id}.${format}`;
    const filepath = join(this.outputDir, filename);

    let content;

    switch (format) {
      case ReportFormat.JSON:
        content = this._toJSON(report);
        break;
      case ReportFormat.MARKDOWN:
        content = this._toMarkdown(report);
        break;
      case ReportFormat.HTML:
        content = this._toHTML(report);
        break;
      case ReportFormat.JUNIT:
        content = this._toJUnit(report);
        break;
      default:
        content = this._toJSON(report);
    }

    writeFileSync(filepath, content, 'utf-8');
    logger.debug(`Report saved: ${filepath}`);
  }

  /**
   * Convert report to JSON
   * @param {TestReport} report - Report
   * @returns {string} JSON string
   */
  _toJSON(report) {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Convert report to Markdown
   * @param {TestReport} report - Report
   * @returns {string} Markdown string
   */
  _toMarkdown(report) {
    const lines = [
      `# Test Report`,
      '',
      `**Project**: ${report.projectName}`,
      `**Timestamp**: ${report.timestamp}`,
      `**Duration**: ${this._formatDuration(report.summary.duration)}`,
      '',
      '## Summary',
      '',
      '| Metric | Value |',
      '|:---|:---|',
      `| Total Tests | ${report.summary.total} |`,
      `| Passed | ${report.summary.passed} ✅ |`,
      `| Failed | ${report.summary.failed} ❌ |`,
      `| Skipped | ${report.summary.skipped} ⏭️ |`,
      `| Pass Rate | ${report.summary.passRate}% |`,
      '',
    ];

    // Add coverage if available
    if (report.coverage) {
      lines.push('## Coverage');
      lines.push('');
      lines.push('| Type | Coverage |');
      lines.push('|:---|:---|');
      if (report.coverage.lines) {
        lines.push(`| Lines | ${report.coverage.lines.pct}% |`);
      }
      if (report.coverage.branches) {
        lines.push(`| Branches | ${report.coverage.branches.pct}% |`);
      }
      if (report.coverage.functions) {
        lines.push(`| Functions | ${report.coverage.functions.pct}% |`);
      }
      if (report.coverage.statements) {
        lines.push(`| Statements | ${report.coverage.statements.pct}% |`);
      }
      lines.push('');
    }

    // Add test suites
    if (report.testSuites.length > 0) {
      lines.push('## Test Suites');
      lines.push('');

      for (const suite of report.testSuites) {
        const statusIcon = suite.status === TestStatus.PASSED ? '✅' :
          suite.status === TestStatus.FAILED ? '❌' : '⏭️';
        lines.push(`### ${statusIcon} ${suite.name}`);
        lines.push('');
        lines.push(`**File**: \`${suite.file}\``);
        lines.push(`**Duration**: ${this._formatDuration(suite.duration)}`);
        lines.push('');

        if (suite.tests.length > 0) {
          lines.push('| Test | Status | Duration |');
          lines.push('|:---|:---|:---|');

          for (const test of suite.tests) {
            const icon = test.status === TestStatus.PASSED ? '✅' :
              test.status === TestStatus.FAILED ? '❌' : '⏭️';
            lines.push(`| ${test.name} | ${icon} | ${this._formatDuration(test.duration)} |`);
          }
          lines.push('');
        }
      }
    }

    // Add failures section
    if (report.failures.length > 0) {
      lines.push('## Failures');
      lines.push('');

      for (const failure of report.failures) {
        lines.push(`### ❌ ${failure.test}`);
        lines.push('');
        lines.push(`**Suite**: ${failure.suite}`);
        lines.push('');
        if (failure.error) {
          lines.push('**Error**:');
          lines.push('```');
          lines.push(failure.error);
          lines.push('```');
          lines.push('');
        }
        if (failure.stackTrace) {
          lines.push('<details>');
          lines.push('<summary>Stack Trace</summary>');
          lines.push('');
          lines.push('```');
          lines.push(failure.stackTrace);
          lines.push('```');
          lines.push('</details>');
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Convert report to HTML
   * @param {TestReport} report - Report
   * @returns {string} HTML string
   */
  _toHTML(report) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report - ${report.projectName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
    h1, h2, h3 { color: #333; }
    .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; margin: 20px 0; }
    .stat { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; }
    .passed { color: #4caf50; }
    .failed { color: #f44336; }
    .skipped { color: #ff9800; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .error { background: #ffebee; padding: 10px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <h1>Test Report</h1>
  <p><strong>Project:</strong> ${report.projectName}</p>
  <p><strong>Timestamp:</strong> ${report.timestamp}</p>

  <div class="summary">
    <div class="stat">
      <div class="stat-value">${report.summary.total}</div>
      <div>Total</div>
    </div>
    <div class="stat passed">
      <div class="stat-value">${report.summary.passed}</div>
      <div>Passed</div>
    </div>
    <div class="stat failed">
      <div class="stat-value">${report.summary.failed}</div>
      <div>Failed</div>
    </div>
    <div class="stat skipped">
      <div class="stat-value">${report.summary.skipped}</div>
      <div>Skipped</div>
    </div>
    <div class="stat">
      <div class="stat-value">${report.summary.passRate}%</div>
      <div>Pass Rate</div>
    </div>
  </div>

  <h2>Test Suites</h2>
  ${report.testSuites.map(suite => `
    <h3>${suite.status === TestStatus.PASSED ? '✅' : '❌'} ${suite.name}</h3>
    <table>
      <tr><th>Test</th><th>Status</th><th>Duration</th></tr>
      ${suite.tests.map(test => `
        <tr>
          <td>${test.name}</td>
          <td class="${test.status}">${test.status}</td>
          <td>${this._formatDuration(test.duration)}</td>
        </tr>
      `).join('')}
    </table>
  `).join('')}

  ${report.failures.length > 0 ? `
    <h2>Failures</h2>
    ${report.failures.map(f => `
      <h3>❌ ${f.test}</h3>
      <div class="error">${f.error || 'No error message'}</div>
    `).join('')}
  ` : ''}
</body>
</html>`;
  }

  /**
   * Convert report to JUnit XML format
   * @param {TestReport} report - Report
   * @returns {string} JUnit XML string
   */
  _toJUnit(report) {
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<testsuites tests="${report.summary.total}" failures="${report.summary.failed}" time="${report.summary.duration / 1000}">`,
    ];

    for (const suite of report.testSuites) {
      lines.push(`  <testsuite name="${this._escapeXml(suite.name)}" tests="${suite.tests.length}" failures="${suite.tests.filter(t => t.status === TestStatus.FAILED).length}" time="${suite.duration / 1000}">`);

      for (const test of suite.tests) {
        lines.push(`    <testcase name="${this._escapeXml(test.name)}" classname="${this._escapeXml(suite.name)}" time="${test.duration / 1000}">`);

        if (test.status === TestStatus.FAILED) {
          lines.push(`      <failure message="${this._escapeXml(test.error || 'Test failed')}">`);
          if (test.stackTrace) {
            lines.push(this._escapeXml(test.stackTrace));
          }
          lines.push('      </failure>');
        } else if (test.status === TestStatus.SKIPPED) {
          lines.push('      <skipped/>');
        }

        lines.push('    </testcase>');
      }

      lines.push('  </testsuite>');
    }

    lines.push('</testsuites>');
    return lines.join('\n');
  }

  /**
   * Escape XML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  _escapeXml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Format duration in human-readable format
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  _formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  }
}

/**
 * Create test reporter instance
 */
export function createTestReporter(config = {}) {
  return new TestReporter(config);
}
