/**
 * DevFlow Core - Main Entry Point
 * Exports all public APIs
 */

// Core modules
export { ConfigManager, getConfigManager, DEFAULT_CONFIG } from './core/config.js';
export { ToolDetector, detectTool, SupportedTools, TOOL_CAPABILITIES } from './core/tool-detector.js';
export { ContextManager, createContextManager, ContextLayer, CONTEXT_BUDGET } from './core/context-manager.js';
export { ComplexityEvaluator, createComplexityEvaluator, ComplexityLevel } from './core/complexity-evaluator.js';
export { ParallelRunner, createParallelRunner, ExecutionStatus } from './core/parallel-runner.js';
export { DesignVersionTracker, createDesignVersionTracker, DesignVersion, VersionChangeType } from './core/design-version-tracker.js';
export { DesignConsistencyChecker, createDesignConsistencyChecker, ConsistencyResultType, FingerprintType, ImplementationFingerprint } from './core/design-consistency-checker.js';

// Memory modules
export { MemoryProtocol, MemoryCategories, MemoryEntry, MemorySearchResult } from './memory/protocol.js';
export { FileMemoryProvider } from './memory/file-provider.js';
export { 
  BaseEmbeddingProvider, 
  KeywordEmbeddingProvider, 
  LocalEmbeddingProvider, 
  OpenAIEmbeddingProvider,
  SmartEmbeddingProvider,
  createEmbeddingProvider,
  EmbeddingModelType 
} from './memory/embedding.js';
export { VectorIndex, PersistentVectorIndex } from './memory/vector-index.js';
export { MemoryManager, getMemoryManager } from './memory/manager.js';

// Analyzer modules
export { ProjectTypeDetector, detectProjectType, ProjectType } from './analyzer/project-detector.js';
export { FrontendAnalyzer, analyzeFrontend } from './analyzer/frontend-analyzer.js';
export { BackendAnalyzer, analyzeBackend } from './analyzer/backend-analyzer.js';
export { ConventionExtractor, extractConventions } from './analyzer/convention-extractor.js';

// Orchestrator modules
export { TaskGraph, createTaskGraph, TaskStatus } from './orchestrator/task-graph.js';
export { 
  createTaskCard, 
  validateTaskCard, 
  taskCardToMarkdown, 
  parseTaskCardsFromMarkdown,
  TaskPriority, 
  TaskType 
} from './orchestrator/task-card.js';
export { 
  BaseToolAdapter, 
  CursorAdapter, 
  TraeAdapter, 
  WindsurfAdapter, 
  ClineAdapter, 
  RooAdapter, 
  CopilotAdapter,
  createToolAdapter,
  getAdapterForTool,
  PromptStyle 
} from './orchestrator/tool-adapter.js';
// Tool adapters (new modular structure)
export {
  getAdapter,
  getAllAdapters,
  getAdapterNames,
  ToolCapability,
} from './tool-adapter/index.js';
export { 
  TokenBudgetManager, 
  checkBudget, 
  CompressionStrategy, 
  CompressionResult 
} from './orchestrator/token-budget.js';
export { 
  Orchestrator, 
  createOrchestrator,
  WorkflowPhase 
} from './orchestrator/orchestrator.js';
export { 
  LearningEngine, 
  createLearningEngine,
  PatternCategory 
} from './orchestrator/learning-engine.js';
export { 
  WorkflowRunner, 
  createWorkflowRunner 
} from './orchestrator/workflow-runner.js';

// Testing modules
export { 
  TestGenerator, 
  createTestGenerator,
  TestType, 
  TestFramework 
} from './testing/test-generator.js';
export { 
  TestRunner, 
  createTestRunner,
  TestStatus 
} from './testing/test-runner.js';
export { 
  BrowserRunner, 
  createBrowserRunner,
  BrowserType 
} from './testing/browser-runner.js';
export {
  TestReporter,
  createTestReporter,
  TestReport,
  TestSuite,
  TestCase,
  ReportFormat,
  TestStatus as TestReportStatus,
} from './testing/reporter.js';

// Templates
export {
  templates,
  getTemplate,
  fillTemplate,
  createAgentsMd,
  createConfig,
  createDesignDoc,
  createTaskCard,
} from './templates/index.js';

// Utils
export { 
  DevFlowError, 
  ConfigError, 
  MemoryError, 
  AnalysisError, 
  OrchestrationError, 
  TestingError,
  ToolAdapterError,
  ErrorCodes,
  handleCliError,
  withErrorHandling 
} from './utils/errors.js';
export { Logger, LogLevel, createLogger, logger } from './utils/logger.js';

// Version
export const VERSION = '0.1.0';
