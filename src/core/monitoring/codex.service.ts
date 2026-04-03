import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec, spawn, ChildProcess } from 'child_process';
import config from '../../shared/config';
import { timmy, colors } from '../../shared/ui';
import { logger } from '../../shared/utils/logger.util';
import { loadContextForModel } from '../context/context-orchestrator';
import { loadAndApplySkill } from '../skills';
import * as clickup from '../../../lib/clickup';
import * as storage from '../../../lib/storage';
import type { ClickUpTask } from '../../../src/types/clickup';
import type {
  ExecWithPTYOptions,
  LaunchOptions,
  ReviewOptions,
  LaunchResult,
  ReviewResult,
  Settings,
  ErrorWithCode
} from '../../../src/types/ai';
import type { ExecResult } from '../../../src/types/common';

const execAsync = promisify(exec);

/**
 * Execute a command with a pseudo-TTY using spawn
 */
function execWithPTY(command: string, options: ExecWithPTYOptions = {}): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const shell: ChildProcess = spawn('bash', ['-c', command], {
      ...options,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    if (shell.stdout) {
      shell.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        process.stdout.write(data); // Show live output
      });
    }

    if (shell.stderr) {
      shell.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        process.stderr.write(data); // Show live errors
      });
    }

    shell.on('error', (error: Error) => {
      reject(error);
    });

    shell.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Command failed with exit code ${code}`) as ErrorWithCode;
        error.code = code ?? undefined;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });

    // Send input to stdin if we're piping a file
    if (options.stdinFile && shell.stdin) {
      const inputContent = fs.readFileSync(options.stdinFile, 'utf8');
      shell.stdin.write('y\n');
      setTimeout(() => {
        if (shell.stdin) {
          shell.stdin.write(inputContent);
          shell.stdin.end();
        }
      }, 2000);
    }
  });
}

function ensureCodexSettings(repoPath: string | null = null): void {
  const targetRepoPath = repoPath || config.github.repoPath;
  if (!targetRepoPath) {
    throw new Error('Repository path is not configured');
  }

  const codexDir = path.join(targetRepoPath, '.claude');
  const settingsFile = path.join(codexDir, 'settings.json');

  if (!fs.existsSync(codexDir)) {
    fs.mkdirSync(codexDir, { recursive: true });
  }

  const settings: Settings = {
    permissions: {
      allow: [
        'Bash(*)',
        'Read(*)',
        'Write(*)',
        'Edit(*)',
        'Glob(*)',
        'Grep(*)',
        'Task(*)',
        'WebFetch(*)',
        'WebSearch(*)',
        'NotebookEdit(*)',
        'mcp__*',
        '*'
      ],
      deny: []
    },
    hooks: {
      'user-prompt-submit': 'echo \'yes\''
    }
  };

  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

async function launchCodex(task: ClickUpTask, options: LaunchOptions = {}): Promise<LaunchResult> {
  const taskId = task.id;
  const taskTitle = task.name;
  const taskDescription = task.description || task.text_content || 'No description provided';
  const { analysis, repoConfig } = options;

  // Use provided repoConfig or fall back to legacy config
  const repoPath = repoConfig?.path || config.github.repoPath;
  const repoOwner = repoConfig?.owner || config.github.owner;
  const repoName = repoConfig?.repo || config.github.repo;

  if (!repoPath) {
    throw new Error('Repository path is not configured');
  }

  console.log(timmy.ai(`Deploying ${colors.bright}Codex${colors.reset} for ${colors.bright}${taskId}${colors.reset}: "${taskTitle}"`));
  ensureCodexSettings(repoPath);

  // Load context based on task (uses RAG if available, falls back to Smart Loader)
  console.log(timmy.info('Loading relevant coding guidelines...'));
  const smartContext = await loadContextForModel({
    model: 'codex',
    taskDescription: `${taskTitle}\n\n${taskDescription}`,
    topK: 5,
    minRelevance: 0.7
  });

  // Build prompt with optional Gemini analysis
  let analysisSection = '';
  if (analysis && analysis.content) {
    let featureDocsPath = '';
    if (analysis.featureDir) {
      featureDocsPath = `\n\n**FEATURE DOCUMENTATION:**\nThe detailed feature specification is located at:\n\`${analysis.featureDir}/feature-spec.md\`\n\nYou can read this file to understand the implementation requirements, files to modify, and acceptance criteria.`;
    }
    analysisSection = `\n\n**GEMINI AI ANALYSIS:**\nThis task has been pre-analyzed by Gemini AI. Please review the analysis below for implementation guidance:\n\n---\n${analysis.content}\n---\n\nUse this analysis to guide your implementation. Follow the suggested approach and implementation steps.${featureDocsPath}`;
  }

  const setupInstructions = `1. **Navigate to repository:**\n   cd ${repoPath}\n\n2. **Update main branch:**\n   git checkout main\n   git pull origin main\n   (Ensure we have latest changes)\n\n3. **Create new branch from main:**\n   git checkout -b task-${taskId}`;

  // Load implementation skill from markdown file
  const implementationSkill = await loadAndApplySkill('implementation', {
    taskId,
    taskTitle,
    taskDescription,
    taskUrl: task.url || `https://app.clickup.com/t/${taskId}`,
    setupInstructions,
  });

  const readSpecStep = analysis && analysis.featureDir
    ? `0. **Read the feature specification:**\n   Read the file: ${analysis.featureDir}/feature-spec.md\n   This contains detailed requirements, files to modify, and implementation guidance.\n\n`
    : '';

  const prompt = `${smartContext ? smartContext + '\n\n' + '='.repeat(80) + '\n\n' : ''}${implementationSkill}
${analysisSection}

**Repository Information:**
- Path: ${repoPath}
- Owner: ${repoOwner}
- Repo: ${repoName}

${readSpecStep}**ClickUp Task URL:** ${task.url || `https://app.clickup.com/t/${taskId}`}

Begin implementation now and make sure to create the PR when done!`;

  try {
    const promptFile = path.join(__dirname, '..', `task-${taskId}-codex-prompt.txt`);
    fs.writeFileSync(promptFile, prompt);

    console.log(timmy.info(`${colors.bright}Codex${colors.reset} starting implementation...`));

    // Unset GITHUB_TOKEN to let gh use keyring auth
    const cleanEnv = { ...process.env };
    delete cleanEnv.GITHUB_TOKEN;
    delete cleanEnv.GH_TOKEN;

    // Create input file with 'y' confirmation and prompt
    const inputFile = path.join(__dirname, '..', `task-${taskId}-codex-input.txt`);
    const promptContent = fs.readFileSync(promptFile, 'utf8');
    fs.writeFileSync(inputFile, `y\n${promptContent}`);

    // Execute Codex SYNCHRONOUSLY - wait for it to complete
    // Use codex exec with full-auto for non-interactive execution
    const codexCommand = `cd "${repoPath}" && codex exec --full-auto --sandbox danger-full-access < "${inputFile}"`;

    try {
      await execAsync(codexCommand, {
        env: cleanEnv,
        shell: '/bin/bash',
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer
        timeout: 1800000 // 30 minute timeout
      });

      console.log(timmy.success(`${colors.bright}Codex${colors.reset} completed implementation for ${colors.bright}task-${taskId}${colors.reset}`));

      // Cleanup files
      fs.unlinkSync(promptFile);
      fs.unlinkSync(inputFile);

      // Check if Codex made any changes and auto-commit/push them
      console.log(timmy.info('Checking for uncommitted changes from Codex implementation...'));

      try {
        const { stdout: statusOutput } = await execAsync(`cd "${repoPath}" && git status --porcelain`, {
          env: cleanEnv
        });

        if (statusOutput.trim()) {
          console.log(timmy.info('Codex made changes. Committing and pushing...'));

          // Commit and push the changes
          await execAsync(
            `cd "${repoPath}" && git add . && git commit -m "feat: ${taskTitle} (#${taskId})" && git push -u origin task-${taskId}`,
            {
              env: cleanEnv,
              timeout: 60000 // 1 minute timeout for git operations
            }
          );

          console.log(timmy.success('Codex implementation committed and pushed'));
        } else {
          console.log(timmy.info('No changes to commit from Codex implementation'));
        }
      } catch (gitError) {
        const err = gitError as Error;
        console.log(timmy.warning(`Failed to auto-commit Codex changes: ${err.message}`));
        // Don't fail the whole implementation if git operations fail
      }

      await clickup.addComment(
        taskId,
        `✅ **Codex Implementation Complete**\n\n` +
        `Codex has finished implementing the feature.\n\n` +
        `**Branch:** \`task-${taskId}\`\n` +
        `**Status:** Complete\n\n` +
        `Next: Pull Request should be created`
      );

      return {
        success: true,
        branch: `task-${taskId}`
      };

    } catch (codexError) {
      const err = codexError as Error;
      console.log(timmy.error(`${colors.bright}Codex${colors.reset} execution failed: ${err.message}`));

      // Cleanup files
      if (fs.existsSync(promptFile)) {
        fs.unlinkSync(promptFile);
      }
      if (fs.existsSync(inputFile)) {
        fs.unlinkSync(inputFile);
      }

      throw codexError;
    }

  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Codex deployment failed: ${err.message}`));
    console.log(timmy.info('Task queued for manual processing'));

    await storage.queue.add(task);
    return { success: false, error: err.message };
  }
}

async function reviewClaudeChanges(task: ClickUpTask, options: ReviewOptions = {}): Promise<ReviewResult> {
  const taskId = task.id;
  const taskTitle = task.name;
  const branch = `task-${taskId}`;
  const { repoConfig } = options;

  // Use provided repoConfig or fall back to legacy config
  const repoPath = repoConfig?.path || config.github.repoPath;
  const repoOwner = repoConfig?.owner || config.github.owner;
  const repoName = repoConfig?.repo || config.github.repo;

  if (!repoPath) {
    throw new Error('Repository path is not configured');
  }

  console.log(timmy.ai(`${colors.bright}Codex${colors.reset} reviewing Claude's changes for ${colors.bright}${taskId}${colors.reset}`));
  ensureCodexSettings(repoPath);

  // Load context for review (uses RAG if available, falls back to Smart Loader)
  console.log(timmy.info('Loading relevant review guidelines...'));
  const smartContext = await loadContextForModel({
    model: 'codex',
    taskDescription: `Code review for: ${taskTitle}\n\nReviewing implementation changes`,
    topK: 5,
    minRelevance: 0.7
  });

  // Load review skill from markdown file
  const reviewSkill = await loadAndApplySkill('review', {
    taskId,
    taskTitle,
    branch,
    repoPath: repoPath || '',
  });

  const prompt = `${smartContext ? smartContext + '\n\n' + '='.repeat(80) + '\n\n' : ''}${reviewSkill}

**ClickUp Task ID:** ${taskId}
**Title:** ${taskTitle}
**Branch:** ${branch}

**Repository Information:**
- Path: ${repoPath}
- Owner: ${repoOwner}
- Repo: ${repoName}

Begin your review now and add TODO/FIXME comments to the code!`;

  try {
    const promptFile = path.join(__dirname, '..', `task-${taskId}-codex-review-prompt.txt`);
    const logsDir = path.join(__dirname, '..', 'logs');
    const logFile = path.join(logsDir, `${taskId}-codex.log`);

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    fs.writeFileSync(promptFile, prompt);

    console.log(timmy.info(`${colors.bright}Codex${colors.reset} starting code review...`));
    console.log(timmy.info(`Log file: ${colors.dim}${logFile}${colors.reset}`));

    // Unset GITHUB_TOKEN to let gh use keyring auth
    const cleanEnv = { ...process.env };
    delete cleanEnv.GITHUB_TOKEN;
    delete cleanEnv.GH_TOKEN;

    // Create input file with 'y' confirmation and prompt
    const inputFile = path.join(__dirname, '..', `task-${taskId}-codex-input.txt`);
    const promptContent = fs.readFileSync(promptFile, 'utf8');
    fs.writeFileSync(inputFile, `y\n${promptContent}`);

    // Execute Codex SYNCHRONOUSLY - wait for it to complete
    // Use codex exec with full-auto for non-interactive execution
    const codexCommand = `cd "${repoPath}" && codex exec --full-auto --sandbox danger-full-access < "${inputFile}"`;

    try {
      const { stdout, stderr } = await execAsync(codexCommand, {
        env: cleanEnv,
        shell: '/bin/bash',
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer
        timeout: 1800000 // 30 minute timeout
      });

      // Save Codex output to log file for debugging
      const logOutput = `=== CODEX REVIEW OUTPUT ===\n\n` +
        `STDOUT:\n${stdout || '(empty)'}\n\n` +
        `STDERR:\n${stderr || '(empty)'}\n`;
      fs.writeFileSync(logFile, logOutput);

      // Log summary to logger
      if (stdout) {
        logger.info('Codex stdout', { output: stdout.substring(0, 1000) }); // First 1000 chars
      }
      if (stderr) {
        logger.warn('Codex stderr', { output: stderr.substring(0, 1000) });
      }

      console.log(timmy.success(`${colors.bright}Codex${colors.reset} completed code review for ${colors.bright}${branch}${colors.reset}`));
      console.log(timmy.info(`Review output saved to: ${colors.dim}${logFile}${colors.reset}`));

      // Cleanup files
      fs.unlinkSync(promptFile);
      fs.unlinkSync(inputFile);

      // Check if Codex made any changes and auto-commit/push them
      console.log(timmy.info('Checking for uncommitted changes from Codex review...'));

      try {
        const { stdout: statusOutput } = await execAsync(`cd "${repoPath}" && git status --porcelain`, {
          env: cleanEnv
        });

        if (statusOutput.trim()) {
          console.log(timmy.info('Codex made changes. Committing and pushing...'));

          // Commit and push the changes
          await execAsync(
            `cd "${repoPath}" && git add . && git commit -m "review: Add TODO/FIXME comments from Codex review (#${taskId})" && git push origin ${branch}`,
            {
              env: cleanEnv,
              timeout: 60000 // 1 minute timeout for git operations
            }
          );

          console.log(timmy.success('Codex review changes committed and pushed'));
        } else {
          console.log(timmy.info('No changes to commit from Codex review'));
        }
      } catch (gitError) {
        const err = gitError as Error;
        console.log(timmy.warning(`Failed to auto-commit Codex changes: ${err.message}`));
        // Don't fail the whole review if git operations fail
      }

      // Determine if changes were auto-committed
      let commitStatus = 'Changes auto-committed and pushed';
      try {
        const { stdout: finalStatus } = await execAsync(`cd "${repoPath}" && git status --porcelain`, {
          env: cleanEnv
        });
        if (finalStatus.trim()) {
          commitStatus = 'Warning: Some changes may not have been committed';
        }
      } catch {
        // Ignore status check errors
      }

      await clickup.addComment(
        taskId,
        `✅ **Codex Code Review Complete**\n\n` +
        `Codex has finished reviewing Claude's implementation and added TODO/FIXME comments.\n\n` +
        `**Branch:** \`${branch}\`\n` +
        `**Status:** ${commitStatus}\n\n` +
        `Next: Claude will address the TODO comments`
      );

      return {
        success: true,
        branch
      };

    } catch (codexError) {
      const err = codexError as Error;
      console.log(timmy.error(`${colors.bright}Codex${colors.reset} review execution failed: ${err.message}`));

      // Cleanup files
      if (fs.existsSync(promptFile)) {
        fs.unlinkSync(promptFile);
      }
      if (fs.existsSync(inputFile)) {
        fs.unlinkSync(inputFile);
      }

      throw codexError;
    }

  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Codex review failed: ${err.message}`));
    return { success: false, error: err.message };
  }
}

export {
  ensureCodexSettings,
  launchCodex,
  reviewClaudeChanges,
  execWithPTY,
  // Types
  ClickUpTask,
  ExecWithPTYOptions,
  ExecResult,
  LaunchOptions,
  ReviewOptions,
  LaunchResult,
  ReviewResult,
  Settings,
  ErrorWithCode
};
