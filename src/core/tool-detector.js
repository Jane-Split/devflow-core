/**
 * Tool Detector
 * Automatically detects which AI coding tool is being used
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ToolDetector');

/**
 * Supported AI tools
 */
export const SupportedTools = {
  CURSOR: 'cursor',
  TRAE: 'trae',
  WINDSURF: 'windsurf',
  CLINE: 'cline',
  ROO: 'roo',
  COPILOT: 'copilot',
  UNKNOWN: 'unknown',
};

/**
 * Tool detection signatures
 * Each tool has specific files, directories, or environment indicators
 */
const TOOL_SIGNATURES = {
  [SupportedTools.CURSOR]: {
    files: ['.cursorrules'],
    dirs: ['.cursor'],
    envVars: ['CURSOR_TRACE_ID'],
    configPaths: [
      join(homedir(), '.cursor'),
      join(homedir(), 'Library', 'Application Support', 'Cursor'),
    ],
  },
  [SupportedTools.TRAE]: {
    files: ['.trae', '.trae-rules'],
    dirs: ['.trae'],
    envVars: ['TRAE_VERSION'],
    configPaths: [
      join(homedir(), '.trae'),
      join(homedir(), 'Library', 'Application Support', 'Trae'),
    ],
  },
  [SupportedTools.WINDSURF]: {
    files: ['.windsurfrules'],
    dirs: ['.windsurf'],
    envVars: ['WINDSURF_VERSION'],
    configPaths: [
      join(homedir(), '.windsurf'),
      join(homedir(), 'Library', 'Application Support', 'Windsurf'),
    ],
  },
  [SupportedTools.CLINE]: {
    files: ['.clinerules', 'cline.md'],
    dirs: ['.cline'],
    envVars: [],
    configPaths: [join(homedir(), '.vscode', 'extensions', 'saoudrizwan.claude-dev')],
  },
  [SupportedTools.ROO]: {
    files: ['.roorules', 'roo.md'],
    dirs: ['.roo'],
    envVars: [],
    configPaths: [join(homedir(), '.vscode', 'extensions', 'rooveterinaryinc.roo-cline')],
  },
  [SupportedTools.COPILOT]: {
    files: [],
    dirs: [],
    envVars: ['GITHUB_COPILOT_TOKEN', 'COPILOT_TOKEN'],
    configPaths: [join(homedir(), '.config', 'github-copilot')],
  },
};

/**
 * Tool capabilities and limitations
 */
export const TOOL_CAPABILITIES = {
  [SupportedTools.CURSOR]: {
    contextLimit: 200000,
    supportsSubagents: true,
    subagentReadOnly: false,
    supportsImages: true,
    preferredPromptStyle: 'detailed',
  },
  [SupportedTools.TRAE]: {
    contextLimit: 128000,
    supportsSubagents: true,
    subagentReadOnly: false,
    supportsImages: true,
    preferredPromptStyle: 'detailed',
  },
  [SupportedTools.WINDSURF]: {
    contextLimit: 128000,
    supportsSubagents: true,
    subagentReadOnly: false,
    supportsImages: true,
    preferredPromptStyle: 'detailed',
  },
  [SupportedTools.CLINE]: {
    contextLimit: 128000,
    supportsSubagents: true,
    subagentReadOnly: true, // Cline subagent is read-only
    supportsImages: true,
    preferredPromptStyle: 'pseudocode',
  },
  [SupportedTools.ROO]: {
    contextLimit: 128000,
    supportsSubagents: true,
    subagentReadOnly: true,
    supportsImages: true,
    preferredPromptStyle: 'pseudocode',
  },
  [SupportedTools.COPILOT]: {
    contextLimit: 8000,
    supportsSubagents: false,
    subagentReadOnly: false,
    supportsImages: false,
    preferredPromptStyle: 'concise',
  },
  [SupportedTools.UNKNOWN]: {
    contextLimit: 128000,
    supportsSubagents: false,
    subagentReadOnly: false,
    supportsImages: false,
    preferredPromptStyle: 'detailed',
  },
};

/**
 * Tool Detector class
 */
export class ToolDetector {
  /**
   * @param {string} projectRoot - Project root directory
   */
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Detect which AI tool is being used
   * Uses multiple detection methods for accuracy
   * @returns {Object} Detection result with tool type and confidence
   */
  detect() {
    logger.debug('Detecting AI tool...');

    const scores = {};

    for (const [tool, signatures] of Object.entries(TOOL_SIGNATURES)) {
      scores[tool] = this._calculateScore(signatures);
    }

    // Find tool with highest score
    let detectedTool = SupportedTools.UNKNOWN;
    let maxScore = 0;

    for (const [tool, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedTool = tool;
      }
    }

    // Confidence threshold
    const confidence = maxScore > 0 ? 'high' : maxScore === 0 ? 'none' : 'low';

    // If no clear detection, check environment hints
    if (detectedTool === SupportedTools.UNKNOWN) {
      detectedTool = this._detectFromEnvironment();
    }

    const result = {
      tool: detectedTool,
      confidence,
      capabilities: TOOL_CAPABILITIES[detectedTool],
      scores,
    };

    logger.debug(`Detected tool: ${detectedTool} (${confidence} confidence)`);

    return result;
  }

  /**
   * Calculate detection score for a tool
   */
  _calculateScore(signatures) {
    let score = 0;

    // Check for signature files
    for (const file of signatures.files) {
      const filePath = join(this.projectRoot, file);
      if (existsSync(filePath)) {
        score += 3; // High weight for project-specific files
      }
    }

    // Check for signature directories
    for (const dir of signatures.dirs) {
      const dirPath = join(this.projectRoot, dir);
      if (existsSync(dirPath)) {
        score += 2;
      }
    }

    // Check for environment variables
    for (const envVar of signatures.envVars) {
      if (process.env[envVar]) {
        score += 2;
      }
    }

    // Check for config paths
    for (const configPath of signatures.configPaths) {
      if (existsSync(configPath)) {
        score += 1;
      }
    }

    return score;
  }

  /**
   * Detect tool from environment hints
   */
  _detectFromEnvironment() {
    // Check for VS Code extensions
    const vscodeDir = join(this.projectRoot, '.vscode');
    if (existsSync(vscodeDir)) {
      try {
        const extensionsPath = join(vscodeDir, 'extensions.json');
        if (existsSync(extensionsPath)) {
          const fs = require('fs');
          const content = fs.readFileSync(extensionsPath, 'utf8');
          const extensions = JSON.parse(content);

          if (extensions.recommendations) {
            if (extensions.recommendations.some(id => id.includes('claude-dev'))) {
              return SupportedTools.CLINE;
            }
            if (extensions.recommendations.some(id => id.includes('roo'))) {
              return SupportedTools.ROO;
            }
          }
        }
      } catch (error) {
        logger.debug('Failed to parse VS Code extensions:', error.message);
      }
    }

    // Check for GitHub Copilot indicators
    if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
      return SupportedTools.COPILOT;
    }

    return SupportedTools.UNKNOWN;
  }

  /**
   * Get capabilities for a specific tool
   */
  getCapabilities(tool) {
    return TOOL_CAPABILITIES[tool] || TOOL_CAPABILITIES[SupportedTools.UNKNOWN];
  }

  /**
   * Check if a tool supports subagents
   */
  supportsSubagents(tool) {
    const caps = this.getCapabilities(tool);
    return caps.supportsSubagents;
  }

  /**
   * Get context limit for a tool
   */
  getContextLimit(tool) {
    const caps = this.getCapabilities(tool);
    return caps.contextLimit;
  }
}

/**
 * Get singleton detector instance
 */
let detectorInstance = null;

export function getToolDetector(projectRoot) {
  if (!detectorInstance || detectorInstance.projectRoot !== projectRoot) {
    detectorInstance = new ToolDetector(projectRoot);
  }
  return detectorInstance;
}

/**
 * Quick detect function
 */
export function detectTool(projectRoot) {
  return new ToolDetector(projectRoot).detect();
}
