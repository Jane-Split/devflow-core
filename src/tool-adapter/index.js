/**
 * Tool Adapter Index
 * Exports all tool adapters
 */

import { BaseToolAdapter, ToolCapability } from './base.js';
import { CursorAdapter } from './cursor.js';
import { TraeAdapter } from './trae.js';
import { WindsurfAdapter } from './windsurf.js';
import { ClineAdapter } from './cline.js';
import { RooAdapter } from './roo.js';
import { CopilotAdapter } from './copilot.js';

/**
 * Adapter registry
 */
const adapters = {
  cursor: CursorAdapter,
  trae: TraeAdapter,
  windsurf: WindsurfAdapter,
  cline: ClineAdapter,
  roo: RooAdapter,
  copilot: CopilotAdapter,
};

/**
 * Get adapter by name
 * @param {string} name - Adapter name
 * @param {Object} config - Adapter configuration
 * @returns {BaseToolAdapter|null} Adapter instance
 */
export function getAdapter(name, config = {}) {
  const AdapterClass = adapters[name.toLowerCase()];
  if (!AdapterClass) {
    return null;
  }
  return new AdapterClass(config);
}

/**
 * Get all available adapters
 * @param {Object} config - Configuration for all adapters
 * @returns {Array} Array of adapter instances
 */
export function getAllAdapters(config = {}) {
  return Object.values(adapters).map(AdapterClass => new AdapterClass(config));
}

/**
 * Get adapter names
 * @returns {Array} Array of adapter names
 */
export function getAdapterNames() {
  return Object.keys(adapters);
}

// Re-export everything
export {
  BaseToolAdapter,
  ToolCapability,
  CursorAdapter,
  TraeAdapter,
  WindsurfAdapter,
  ClineAdapter,
  RooAdapter,
  CopilotAdapter,
};

export default {
  getAdapter,
  getAllAdapters,
  getAdapterNames,
  BaseToolAdapter,
  ToolCapability,
  CursorAdapter,
  TraeAdapter,
  WindsurfAdapter,
  ClineAdapter,
  RooAdapter,
  CopilotAdapter,
};
