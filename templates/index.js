/**
 * Templates Index
 * Exports all template content
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load template content
 * @param {string} name - Template name (without extension)
 * @returns {string} Template content
 */
function loadTemplate(name) {
  try {
    return readFileSync(join(__dirname, name), 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Template content
 */
export const templates = {
  agentsMd: loadTemplate('AGENTS.md'),
  config: loadTemplate('devflow.config.js'),
  designDoc: loadTemplate('design-doc.md'),
  taskCard: loadTemplate('task-card.md'),
};

/**
 * Get template by name
 * @param {string} name - Template name
 * @returns {string} Template content
 */
export function getTemplate(name) {
  return templates[name] || '';
}

/**
 * Fill template placeholders
 * @param {string} template - Template content
 * @param {Object} data - Data to fill
 * @returns {string} Filled template
 */
export function fillTemplate(template, data) {
  let result = template;

  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  }

  return result;
}

/**
 * Create AGENTS.md content
 * @param {Object} projectInfo - Project information
 * @returns {string} AGENTS.md content
 */
export function createAgentsMd(projectInfo) {
  return fillTemplate(templates.agentsMd, {
    PROJECT_NAME: projectInfo.name || 'My Project',
    PROJECT_TYPE: projectInfo.type || 'unknown',
    PRIMARY_LANGUAGE: projectInfo.language || 'JavaScript',
    ARCHITECTURE_DIAGRAM: projectInfo.architecture || 'No architecture diagram available',
    FILE_NAMING_CONVENTION: projectInfo.conventions?.fileNaming || 'kebab-case',
    VARIABLE_NAMING_CONVENTION: projectInfo.conventions?.variableNaming || 'camelCase',
    FUNCTION_NAMING_CONVENTION: projectInfo.conventions?.functionNaming || 'camelCase',
    CLASS_NAMING_CONVENTION: projectInfo.conventions?.classNaming || 'PascalCase',
    INDENTATION: projectInfo.conventions?.indentation || '2 spaces',
    QUOTE_STYLE: projectInfo.conventions?.quotes || 'single',
    SEMICOLON_POLICY: projectInfo.conventions?.semicolons || 'required',
    TEST_FRAMEWORK: projectInfo.testing?.framework || 'Jest',
    TEST_COMMAND: projectInfo.testing?.testCommand || 'npm test',
    COVERAGE_COMMAND: projectInfo.testing?.coverageCommand || 'npm run test:coverage',
    BUILD_COMMAND: projectInfo.build?.command || 'npm run build',
    START_COMMAND: projectInfo.start?.command || 'npm start',
    DEPLOY_COMMAND: projectInfo.deploy?.command || 'npm run deploy',
  });
}

/**
 * Create config file content
 * @param {Object} projectInfo - Project information
 * @returns {string} Config file content
 */
export function createConfig(projectInfo) {
  return fillTemplate(templates.config, {
    PROJECT_NAME: projectInfo.name || 'my-project',
    PROJECT_TYPE: projectInfo.type || 'fullstack',
  });
}

/**
 * Create design document content
 * @param {Object} designInfo - Design information
 * @returns {string} Design document content
 */
export function createDesignDoc(designInfo) {
  return fillTemplate(templates.designDoc, {
    DOCUMENT_ID: designInfo.id || `design-${Date.now()}`,
    TITLE: designInfo.title || 'Untitled Design',
    VERSION: designInfo.version || '1.0.0',
    AUTHOR: designInfo.author || 'DevFlow',
    CREATED_DATE: designInfo.created || new Date().toISOString(),
    UPDATED_DATE: designInfo.updated || new Date().toISOString(),
    STATUS: designInfo.status || 'draft',
  });
}

/**
 * Create task card content
 * @param {Object} taskInfo - Task information
 * @returns {string} Task card content
 */
export function createTaskCard(taskInfo) {
  return fillTemplate(templates.taskCard, {
    TASK_ID: taskInfo.id || `task-${Date.now()}`,
    TITLE: taskInfo.title || 'Untitled Task',
    TYPE: taskInfo.type || 'implementation',
    PRIORITY: taskInfo.priority || 'medium',
    STATUS: taskInfo.status || 'pending',
    COMPLEXITY: taskInfo.complexity || 'medium',
    CREATED_DATE: taskInfo.created || new Date().toISOString(),
    UPDATED_DATE: taskInfo.updated || new Date().toISOString(),
    DESIGN_DOC_ID: taskInfo.designDocId || '',
    REQUIREMENT_ID: taskInfo.requirementId || '',
    DESCRIPTION: taskInfo.description || 'No description provided',
  });
}

export default {
  templates,
  getTemplate,
  fillTemplate,
  createAgentsMd,
  createConfig,
  createDesignDoc,
  createTaskCard,
};
