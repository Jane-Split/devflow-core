/**
 * Design Version Tracker
 * Tracks design document versions and notifies affected tasks on changes
 * Implements Section 9.4 Risk 4 mitigation
 */

import { createHash } from 'crypto';
import { Logger } from '../utils/logger.js';
import { MemoryManager } from '../memory/manager.js';

const logger = new Logger('DesignVersionTracker');

/**
 * Version change types
 */
export const VersionChangeType = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
};

/**
 * Design Version
 */
export class DesignVersion {
  constructor(data = {}) {
    this.id = data.id || `v${Date.now()}`;
    this.hash = data.hash || '';
    this.timestamp = data.timestamp || new Date().toISOString();
    this.author = data.author || 'system';
    this.changes = data.changes || [];
    this.previousVersionId = data.previousVersionId || null;
  }
}

/**
 * Design Version Tracker
 */
export class DesignVersionTracker {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.projectRoot = config.projectRoot || process.cwd();
    this.memoryManager = config.memoryManager || null;
    this.versionHistory = new Map(); // designDocId -> Version[]
    this.taskReferences = new Map(); // taskId -> { designDocId, versionId }
  }

  /**
   * Initialize tracker
   */
  async initialize() {
    if (!this.memoryManager) {
      this.memoryManager = new MemoryManager({
        projectRoot: this.projectRoot,
        config: this.config,
      });
      await this.memoryManager.initialize();
    }

    // Load existing version history
    await this._loadVersionHistory();

    logger.debug('DesignVersionTracker initialized');
  }

  /**
   * Track a design document version
   * @param {string} designDocId - Design document ID
   * @param {string} content - Design document content
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Tracking result
   */
  async trackVersion(designDocId, content, metadata = {}) {
    await this.initialize();

    const hash = this._computeHash(content);
    const currentVersion = await this.getCurrentVersion(designDocId);

    // Check if content has changed
    if (currentVersion && currentVersion.hash === hash) {
      logger.debug(`Design document ${designDocId} unchanged (hash: ${hash.slice(0, 8)})`);
      return {
        changed: false,
        version: currentVersion,
      };
    }

    // Create new version
    const newVersion = new DesignVersion({
      id: this._generateVersionId(designDocId),
      hash,
      timestamp: new Date().toISOString(),
      author: metadata.author || 'system',
      changes: metadata.changes || [],
      previousVersionId: currentVersion?.id || null,
    });

    // Save version
    await this._saveVersion(designDocId, newVersion, content);

    // Update history
    if (!this.versionHistory.has(designDocId)) {
      this.versionHistory.set(designDocId, []);
    }
    this.versionHistory.get(designDocId).push(newVersion);

    // Notify affected tasks
    const affectedTasks = await this.notifyAffectedTasks(designDocId, currentVersion?.id, newVersion.id);

    logger.info(`Design document ${designDocId} updated to ${newVersion.id}`);

    return {
      changed: true,
      oldVersion: currentVersion,
      newVersion,
      affectedTasks,
    };
  }

  /**
   * Get current version of a design document
   * @param {string} designDocId - Design document ID
   * @returns {Promise<DesignVersion|null>} Current version
   */
  async getCurrentVersion(designDocId) {
    const versions = this.versionHistory.get(designDocId);
    if (!versions || versions.length === 0) {
      // Try to load from storage
      const stored = await this._loadVersions(designDocId);
      if (stored && stored.length > 0) {
        return stored[stored.length - 1];
      }
      return null;
    }
    return versions[versions.length - 1];
  }

  /**
   * Get version history for a design document
   * @param {string} designDocId - Design document ID
   * @returns {Promise<Array>} Version history
   */
  async getVersionHistory(designDocId) {
    const versions = this.versionHistory.get(designDocId);
    if (versions) {
      return versions;
    }
    return this._loadVersions(designDocId);
  }

  /**
   * Register a task reference to a design document version
   * @param {string} taskId - Task ID
   * @param {string} designDocId - Design document ID
   * @param {string} versionId - Version ID
   */
  async registerTaskReference(taskId, designDocId, versionId) {
    this.taskReferences.set(taskId, {
      designDocId,
      versionId,
      registeredAt: new Date().toISOString(),
    });

    // Persist reference
    await this._saveTaskReference(taskId, designDocId, versionId);

    logger.debug(`Task ${taskId} registered with design ${designDocId}@${versionId}`);
  }

  /**
   * Get tasks that reference a specific design document version
   * @param {string} designDocId - Design document ID
   * @param {string} versionId - Version ID (optional, defaults to all versions)
   * @returns {Promise<Array>} Affected tasks
   */
  async getTasksByDesignDoc(designDocId, versionId = null) {
    const tasks = [];

    for (const [taskId, ref] of this.taskReferences) {
      if (ref.designDocId === designDocId) {
        if (!versionId || ref.versionId === versionId) {
          tasks.push({
            taskId,
            ...ref,
          });
        }
      }
    }

    return tasks;
  }

  /**
   * Notify affected tasks when design document changes
   * @param {string} designDocId - Design document ID
   * @param {string} oldVersionId - Old version ID
   * @param {string} newVersionId - New version ID
   * @returns {Promise<Array>} Affected tasks with their new status
   */
  async notifyAffectedTasks(designDocId, oldVersionId, newVersionId) {
    const affectedTasks = await this.getTasksByDesignDoc(designDocId, oldVersionId);
    const notifications = [];

    for (const taskRef of affectedTasks) {
      const task = await this._getTask(taskRef.taskId);
      if (!task) continue;

      let notification = {
        taskId: taskRef.taskId,
        designDocId,
        oldVersionId,
        newVersionId,
        action: null,
        message: null,
      };

      switch (task.status) {
        case 'pending':
          // Auto-update task card with new version reference
          await this.registerTaskReference(taskRef.taskId, designDocId, newVersionId);
          notification.action = 'updated';
          notification.message = `Task card updated to reference new design version ${newVersionId}`;
          break;

        case 'in_progress':
          // Add warning to task
          notification.action = 'warning';
          notification.message = `Design document updated to ${newVersionId}. Please review changes.`;
          await this._addTaskWarning(taskRef.taskId, notification.message);
          break;

        case 'completed':
          // Mark for regression testing
          notification.action = 'regression-required';
          notification.message = `Design document changed. Regression testing recommended.`;
          await this._markTaskForRegression(taskRef.taskId);
          break;

        default:
          notification.action = 'notified';
          notification.message = `Design document updated to ${newVersionId}`;
      }

      notifications.push(notification);
      logger.info(`Task ${taskRef.taskId}: ${notification.action} - ${notification.message}`);
    }

    return notifications;
  }

  /**
   * Compare two versions of a design document
   * @param {string} designDocId - Design document ID
   * @param {string} versionId1 - First version ID
   * @param {string} versionId2 - Second version ID
   * @returns {Promise<Object>} Comparison result
   */
  async compareVersions(designDocId, versionId1, versionId2) {
    const versions = await this.getVersionHistory(designDocId);

    const v1 = versions.find(v => v.id === versionId1);
    const v2 = versions.find(v => v.id === versionId2);

    if (!v1 || !v2) {
      throw new Error(`Version not found: ${!v1 ? versionId1 : versionId2}`);
    }

    // Load content for both versions
    const content1 = await this._loadVersionContent(designDocId, versionId1);
    const content2 = await this._loadVersionContent(designDocId, versionId2);

    // Compute diff
    const diff = this._computeDiff(content1, content2);

    return {
      version1: v1,
      version2: v2,
      diff,
      addedLines: diff.added?.length || 0,
      removedLines: diff.removed?.length || 0,
      changedLines: diff.changed?.length || 0,
    };
  }

  /**
   * Compute hash for content
   * @param {string} content - Content to hash
   * @returns {string} Hash
   */
  _computeHash(content) {
    const normalized = typeof content === 'string'
      ? content
      : JSON.stringify(content);
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Generate version ID
   * @param {string} designDocId - Design document ID
   * @returns {string} Version ID
   */
  _generateVersionId(designDocId) {
    const count = (this.versionHistory.get(designDocId)?.length || 0) + 1;
    return `v${count}`;
  }

  /**
   * Save version to storage
   * @param {string} designDocId - Design document ID
   * @param {DesignVersion} version - Version to save
   * @param {string} content - Version content
   */
  async _saveVersion(designDocId, version, content) {
    await this.memoryManager.store('design-versions', `${designDocId}:${version.id}`, {
      version,
      content,
    });
  }

  /**
   * Load version history from storage
   */
  async _loadVersionHistory() {
    try {
      const entries = await this.memoryManager.list('design-versions');

      for (const entry of entries) {
        const [designDocId, versionId] = entry.id.split(':');
        if (!this.versionHistory.has(designDocId)) {
          this.versionHistory.set(designDocId, []);
        }
        const version = new DesignVersion(entry.content?.version || entry.content);
        this.versionHistory.get(designDocId).push(version);
      }

      logger.debug(`Loaded ${this.versionHistory.size} design document histories`);
    } catch (error) {
      logger.debug('No existing version history found');
    }
  }

  /**
   * Load versions for a specific design document
   * @param {string} designDocId - Design document ID
   * @returns {Promise<Array>} Versions
   */
  async _loadVersions(designDocId) {
    const versions = [];
    try {
      const entries = await this.memoryManager.list('design-versions');
      for (const entry of entries) {
        if (entry.id.startsWith(`${designDocId}:`)) {
          const version = new DesignVersion(entry.content?.version || entry.content);
          versions.push(version);
        }
      }
      versions.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
      logger.debug(`No versions found for ${designDocId}`);
    }
    return versions;
  }

  /**
   * Load version content
   * @param {string} designDocId - Design document ID
   * @param {string} versionId - Version ID
   * @returns {Promise<string>} Content
   */
  async _loadVersionContent(designDocId, versionId) {
    const entry = await this.memoryManager.retrieve('design-versions', `${designDocId}:${versionId}`);
    return entry?.content?.content || '';
  }

  /**
   * Save task reference
   */
  async _saveTaskReference(taskId, designDocId, versionId) {
    await this.memoryManager.store('task-design-refs', taskId, {
      designDocId,
      versionId,
      registeredAt: new Date().toISOString(),
    });
  }

  /**
   * Get task by ID
   */
  async _getTask(taskId) {
    const entry = await this.memoryManager.getTaskCard(taskId);
    return entry?.content;
  }

  /**
   * Add warning to task
   */
  async _addTaskWarning(taskId, message) {
    const task = await this._getTask(taskId);
    if (task) {
      task.warnings = task.warnings || [];
      task.warnings.push({
        message,
        timestamp: new Date().toISOString(),
      });
      await this.memoryManager.storeTaskCard(taskId, task);
    }
  }

  /**
   * Mark task for regression
   */
  async _markTaskForRegression(taskId) {
    const task = await this._getTask(taskId);
    if (task) {
      task.needsRegression = true;
      task.regressionReason = 'Design document changed';
      await this.memoryManager.storeTaskCard(taskId, task);
    }
  }

  /**
   * Compute diff between two content strings
   * @param {string} content1 - First content
   * @param {string} content2 - Second content
   * @returns {Object} Diff result
   */
  _computeDiff(content1, content2) {
    const lines1 = (content1 || '').split('\n');
    const lines2 = (content2 || '').split('\n');

    const added = [];
    const removed = [];
    const changed = [];
    const unchanged = [];

    // Simple line-by-line diff
    const maxLen = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLen; i++) {
      const line1 = lines1[i];
      const line2 = lines2[i];

      if (line1 === undefined) {
        added.push({ line: i + 1, content: line2 });
      } else if (line2 === undefined) {
        removed.push({ line: i + 1, content: line1 });
      } else if (line1 !== line2) {
        changed.push({
          line: i + 1,
          old: line1,
          new: line2,
        });
      } else {
        unchanged.push({ line: i + 1, content: line1 });
      }
    }

    return { added, removed, changed, unchanged };
  }
}

/**
 * Create design version tracker instance
 */
export function createDesignVersionTracker(config = {}) {
  return new DesignVersionTracker(config);
}
