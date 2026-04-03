import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import config, { RepositoryConfig } from '../../shared/config';
import { timmy, colors } from '../../shared/ui';
import { withRetry, RetryOptions } from '../../shared/utils/retry.util';
import { loadContextForModel } from '../context/context-orchestrator';
import { loadAndApplySkill, loadTemplate } from '../skills';
import type { ClickUpTask } from '../../../src/types/clickup';
import type { AnalysisResult, FeatureSpec, Progress } from '../../../src/types/ai';
import type { ExecResult } from '../../../src/types/common';

const execAsync = promisify(exec);

interface AnalyzeTaskOptions {
  repoConfig?: RepositoryConfig;
}

/**
 * Analyze task using Gemini CLI
 * @param task - ClickUp task object
 * @param options - Options object
 */
async function analyzeTask(task: ClickUpTask, options: AnalyzeTaskOptions = {}): Promise<AnalysisResult> {
  const taskId = task.id;
  const taskTitle = task.name;
  const taskDescription = task.description || task.text_content || '';
  const { repoConfig } = options;

  // Use provided repoConfig or fall back to legacy config
  const repoPath = repoConfig?.path || config.github.repoPath;
  const repoOwner = repoConfig?.owner || config.github.owner;
  const repoName = repoConfig?.repo || config.github.repo;

  console.log(timmy.processing(`${colors.bright}Gemini${colors.reset} analyzing task ${colors.bright}${taskId}${colors.reset}...`));

  // Load context based on task (uses RAG if available, falls back to Smart Loader)
  console.log(timmy.info('Loading relevant documentation guidelines...'));
  const smartContext = await loadContextForModel({
    model: 'gemini',
    taskDescription: `${taskTitle}\n\n${taskDescription}`,
    topK: 5,
    minRelevance: 0.7
  });

  // Create feature directory
  const featureDir = path.join(config.files.featuresDir, taskId);
  if (!fs.existsSync(featureDir)) {
    fs.mkdirSync(featureDir, { recursive: true });
  }

  // Create log file and progress file paths
  const timestamp = Date.now();
  const logFile = path.join(__dirname, '..', 'logs', `${taskId}-gemini-${timestamp}.log`);
  const progressFile = path.join(__dirname, '..', 'progress', `${taskId}-gemini.json`);

  // Initialize progress
  const updateProgress = (step: number, total: number, currentStep: string): void => {
    const progress: Progress = {
      agent: 'gemini',
      taskId,
      stage: 'analyzing',
      currentStep,
      completedSteps: step,
      totalSteps: total,
      lastUpdate: new Date().toISOString()
    };
    try {
      fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    } catch (_err) {
      // Silent fail - don't break execution
    }
  };

  updateProgress(0, 3, 'Starting analysis...');

  // Load analysis skill from markdown file
  const analysisSkill = await loadAndApplySkill('analysis', {});

  const analysisPrompt = `${smartContext ? smartContext + '\n\n' + '='.repeat(80) + '\n\n' : ''}${analysisSkill}

## Task

**Task ID:** ${taskId}
**Title:** ${taskTitle}
**Description:**
${taskDescription}

**Repository:** ${repoPath}
**Owner/Org:** ${repoOwner}
**Repo Name:** ${repoName}`;

  try {
    // Save prompt to file
    const promptFile = path.join(featureDir, 'prompt.txt');
    fs.writeFileSync(promptFile, analysisPrompt);

    updateProgress(1, 3, 'Calling Gemini AI...');

    // Call Gemini CLI with retry and log output
    const result = await withRetry(
      async (): Promise<string> => {
        const { stdout }: ExecResult = await execAsync(
          `cat "${promptFile}" | ${config.system.geminiCliPath} --yolo 2>&1 | tee -a "${logFile}"`,
          {
            timeout: 120000, // 2 minute timeout
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            shell: '/bin/bash'
          }
        );
        return stdout;
      },
      {
        maxAttempts: 3,
        timeoutMs: 120000,
        onRetry: (attempt: number): Promise<void> => {
          console.log(timmy.info(`${colors.bright}Gemini${colors.reset} retry attempt ${attempt}/3...`));
          updateProgress(1, 3, `Retrying analysis (attempt ${attempt}/3)...`);
          return Promise.resolve();
        }
      } as RetryOptions
    );

    updateProgress(2, 3, 'Writing feature specification...');

    // Save feature specification to file
    const featureSpecFile = path.join(featureDir, 'feature-spec.md');
    fs.writeFileSync(featureSpecFile, result.trim());

    updateProgress(3, 3, 'Analysis complete');

    console.log(timmy.success(`Feature spec created: ${featureSpecFile}`));

    return {
      success: true,
      featureSpecFile,
      featureDir,
      content: result.trim(),
      logFile,
      progressFile
    };

  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Gemini analysis failed: ${err.message}`));

    // Load fallback spec from skill template
    let fallbackSpec: string;
    try {
      fallbackSpec = await loadTemplate('analysis/fallback.md', {
        taskTitle,
        taskDescription: taskDescription || 'No description provided',
      });
    } catch {
      // Inline fallback if template also fails to load
      fallbackSpec = `# Feature Specification - ${taskTitle}\n\n${taskDescription || 'No description provided'}\n\n**Note:** Fallback specification.`;
    }

    const featureSpecFile = path.join(featureDir, 'feature-spec.md');
    fs.writeFileSync(featureSpecFile, fallbackSpec);

    return {
      success: false,
      featureSpecFile,
      featureDir,
      content: fallbackSpec,
      fallback: true,
      error: err.message
    };
  }
}

/**
 * Read feature specification file
 */
function readFeatureSpec(taskId: string): FeatureSpec | null {
  const featureSpecFile = path.join(config.files.featuresDir, taskId, 'feature-spec.md');

  if (!fs.existsSync(featureSpecFile)) {
    return null;
  }

  return {
    file: featureSpecFile,
    content: fs.readFileSync(featureSpecFile, 'utf8')
  };
}

/**
 * Check if feature spec exists for task
 */
function hasFeatureSpec(taskId: string): boolean {
  const featureSpecFile = path.join(config.files.featuresDir, taskId, 'feature-spec.md');
  return fs.existsSync(featureSpecFile);
}

export {
  analyzeTask,
  readFeatureSpec,
  hasFeatureSpec,
  // Backwards compatibility
  readFeatureSpec as readAnalysis,
  hasFeatureSpec as hasAnalysis,
  // Types
  ClickUpTask,
  AnalyzeTaskOptions,
  AnalysisResult,
  FeatureSpec,
  Progress
};
