/**
 * Analyze Command
 * Analyzes project structure, conventions, and generates project profile
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { resolve } from 'path';
import { ConfigManager } from '../../core/config.js';
import { MemoryManager } from '../../memory/manager.js';
import { ProjectTypeDetector } from '../../analyzer/project-detector.js';
import { FrontendAnalyzer } from '../../analyzer/frontend-analyzer.js';
import { BackendAnalyzer } from '../../analyzer/backend-analyzer.js';
import { ConventionExtractor } from '../../analyzer/convention-extractor.js';
import { Logger } from '../../utils/logger.js';
import { handleCliError } from '../../utils/errors.js';
import fs from 'fs-extra';

const logger = new Logger('AnalyzeCommand');

/**
 * Execute analyze command
 * @param {Object} options - Command options
 */
export async function executeAnalyze(options = {}) {
  const spinner = ora('Analyzing project...').start();

  try {
    const projectRoot = resolve(options.projectRoot || process.cwd());
    const outputPath = options.output ? resolve(options.output) : null;

    logger.debug(`Analyzing project in: ${projectRoot}`);

    // Load config
    const configManager = new ConfigManager(projectRoot);
    const config = await configManager.load();

    // Initialize memory manager
    const memoryManager = new MemoryManager({ projectRoot, config });
    await memoryManager.initialize();

    // Detect project type
    spinner.text = 'Detecting project type...';
    const typeDetector = new ProjectTypeDetector(projectRoot);
    const typeResult = await typeDetector.detect();

    // Analyze based on project type
    let frontendAnalysis = null;
    let backendAnalysis = null;

    if (typeResult.type === 'frontend' || typeResult.type === 'fullstack') {
      spinner.text = 'Analyzing frontend...';
      try {
        const analyzer = new FrontendAnalyzer(projectRoot);
        frontendAnalysis = await analyzer.analyze();
      } catch (error) {
        logger.warn(`Frontend analysis failed: ${error.message}`);
      }
    }

    if (typeResult.type === 'backend' || typeResult.type === 'fullstack' || typeResult.type === 'microservice') {
      spinner.text = 'Analyzing backend...';
      try {
        const analyzer = new BackendAnalyzer(projectRoot);
        backendAnalysis = await analyzer.analyze();
      } catch (error) {
        logger.warn(`Backend analysis failed: ${error.message}`);
      }
    }

    // Extract conventions
    spinner.text = 'Extracting conventions...';
    const conventionExtractor = new ConventionExtractor(projectRoot);
    const conventions = await conventionExtractor.extract();

    // Build project profile
    const projectProfile = {
      type: typeResult.type,
      typeConfidence: typeResult.confidence,
      typeScores: typeResult.scores,
      frontend: frontendAnalysis,
      backend: backendAnalysis,
      conventions,
      analyzedAt: new Date().toISOString(),
    };

    // Store in memory
    await memoryManager.storeProjectProfile(projectProfile);

    spinner.succeed('Project analysis complete!');

    // Display results
    console.log(chalk.blue('\n📊 Project Analysis Results\n'));
    console.log(chalk.gray('Type:'), chalk.green(typeResult.type), chalk.gray(`(${typeResult.confidence} confidence)`));
    
    if (frontendAnalysis?.framework) {
      console.log(chalk.gray('Frontend:'), chalk.green(frontendAnalysis.framework.name));
    }
    
    if (backendAnalysis?.framework) {
      console.log(chalk.gray('Backend:'), chalk.green(backendAnalysis.framework.name));
    }

    console.log(chalk.gray('Conventions:'), conventions.naming.componentPattern, 'components,', conventions.naming.functionPattern, 'functions');

    // Save to file if output path provided
    if (outputPath) {
      await fs.writeJson(outputPath, projectProfile, { spaces: 2 });
      console.log(chalk.blue(`\n✓ Analysis saved to ${outputPath}`));
    }

    // Optionally update AGENTS.md
    if (options.updateAgents) {
      const agentsMdContent = await conventionExtractor.generateAgentsMd({
        name: config.project?.name || 'Project',
        type: typeResult.type,
        framework: frontendAnalysis?.framework?.name || backendAnalysis?.framework?.name,
      });

      const agentsMdPath = resolve(projectRoot, 'AGENTS.md');
      await fs.writeFile(agentsMdPath, agentsMdContent);
      console.log(chalk.blue(`✓ AGENTS.md updated at ${agentsMdPath}`));
    }

    return projectProfile;

  } catch (error) {
    spinner.fail('Analysis failed');
    handleCliError(error, process.env.DEVFLOW_DEBUG === 'true');
  }
}

/**
 * Execute research command
 * @param {Object} options - Command options
 */
export async function executeResearch(options = {}) {
  const spinner = ora('Researching project...').start();

  try {
    const projectRoot = resolve(options.projectRoot || process.cwd());
    const forceRefresh = options.refresh || false;
    const incremental = options.incremental || false;
    const scope = options.scope || 'all';

    logger.debug(`Researching project in: ${projectRoot}`);
    logger.debug(`Options: incremental=${incremental}, scope=${scope}`);

    // Load config
    const configManager = new ConfigManager(projectRoot);
    const config = await configManager.load();

    // Initialize memory manager
    const memoryManager = new MemoryManager({ projectRoot, config });
    await memoryManager.initialize();

    // Check if research already exists
    if (!forceRefresh) {
      const existingProfile = await memoryManager.getProjectProfile();
      if (existingProfile) {
        spinner.stop();
        console.log(chalk.yellow('Project profile already exists. Use --refresh to force update.'));
        console.log(chalk.gray('Last analyzed:'), existingProfile.analyzedAt);
        return existingProfile;
      }
    }

    // Run full analysis
    spinner.text = 'Running project analysis...';
    const typeDetector = new ProjectTypeDetector(projectRoot);
    const typeResult = await typeDetector.detect();

    let frontendAnalysis = null;
    let backendAnalysis = null;

    // Scope-based analysis
    const shouldAnalyzeFrontend = scope === 'all' || scope === 'frontend';
    const shouldAnalyzeBackend = scope === 'all' || scope === 'backend' || scope === 'database';

    if ((typeResult.type === 'frontend' || typeResult.type === 'fullstack') && shouldAnalyzeFrontend) {
      spinner.text = 'Analyzing frontend structure...';
      try {
        const analyzer = new FrontendAnalyzer(projectRoot);
        frontendAnalysis = await analyzer.analyze();
      } catch (error) {
        logger.warn(`Frontend analysis failed: ${error.message}`);
      }
    }

    if ((typeResult.type === 'backend' || typeResult.type === 'fullstack' || typeResult.type === 'microservice') && shouldAnalyzeBackend) {
      spinner.text = 'Analyzing backend structure...';
      try {
        const analyzer = new BackendAnalyzer(projectRoot);
        backendAnalysis = await analyzer.analyze();
      } catch (error) {
        logger.warn(`Backend analysis failed: ${error.message}`);
      }
    }

    spinner.text = 'Extracting code conventions...';
    const conventionExtractor = new ConventionExtractor(projectRoot);
    const conventions = await conventionExtractor.extract();

    // Build comprehensive project profile
    // If incremental, merge with existing profile
    let baseProfile = {};
    if (incremental) {
      const existing = await memoryManager.getProjectProfile();
      if (existing) {
        baseProfile = existing;
      }
    }

    const projectProfile = {
      ...baseProfile,
      type: typeResult.type,
      typeConfidence: typeResult.confidence,
      typeScores: typeResult.scores,
      frontend: frontendAnalysis || baseProfile.frontend,
      backend: backendAnalysis || baseProfile.backend,
      conventions,
      analyzedAt: new Date().toISOString(),
    };

    // Store in memory
    await memoryManager.storeProjectProfile(projectProfile);

    // Generate and save AGENTS.md
    spinner.text = 'Generating AGENTS.md...';
    const agentsMdContent = await conventionExtractor.generateAgentsMd({
      name: config.project?.name || 'Project',
      type: typeResult.type,
      framework: frontendAnalysis?.framework?.name || backendAnalysis?.framework?.name,
    });

    const agentsMdPath = resolve(projectRoot, 'AGENTS.md');
    await fs.writeFile(agentsMdPath, agentsMdContent);

    spinner.succeed(forceRefresh ? 'Project research refreshed!' : 'Project research complete!');

    // Display summary
    console.log(chalk.blue('\n📋 Project Profile Summary\n'));
    console.log(chalk.gray('Type:'), chalk.green(typeResult.type));
    console.log(chalk.gray('Confidence:'), chalk.green(typeResult.confidence));
    
    if (frontendAnalysis?.framework) {
      console.log(chalk.gray('Frontend Framework:'), chalk.green(`${frontendAnalysis.framework.name} (${frontendAnalysis.uiLibrary?.name || 'No UI library'})`));
    }
    
    if (backendAnalysis?.framework) {
      console.log(chalk.gray('Backend Framework:'), chalk.green(`${backendAnalysis.framework.name} (${backendAnalysis.language})`));
    }

    console.log(chalk.blue(`\n✓ Project profile saved to memory`));
    console.log(chalk.blue(`✓ AGENTS.md generated at ${agentsMdPath}`));

    return projectProfile;

  } catch (error) {
    spinner.fail('Research failed');
    handleCliError(error, process.env.DEVFLOW_DEBUG === 'true');
  }
}

// Create Commander commands
export const analyzeCommand = new Command('analyze')
  .description('Analyze current project structure and conventions')
  .option('-p, --project-root <path>', 'Project root directory', process.cwd())
  .option('-o, --output <path>', 'Output path for analysis report')
  .option('--update-agents', 'Update AGENTS.md with extracted conventions', false)
  .action(executeAnalyze);

export const researchCommand = new Command('research')
  .description('Research project and refresh project profile')
  .option('-p, --project-root <path>', 'Project root directory', process.cwd())
  .option('--refresh', 'Force refresh of project research', false)
  .option('--incremental', 'Only update changed parts', false)
  .option('--scope <scope>', 'Scope of research (frontend|backend|database|all)', 'all')
  .action(executeResearch);
