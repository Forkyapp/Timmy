import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import config from '../../shared/config';
import { timmy, colors } from '../../shared/ui';
import { getProcessManager } from '../../shared/utils/process-manager.util';
import * as clickup from '../../../lib/clickup';
import * as storage from '../../../lib/storage';
import { loadContextForModel } from '../context/context-orchestrator';
import { loadAndApplySkill } from '../skills';
import type { ClickUpTask } from '../../../src/types/clickup';
import type { LaunchOptions, FixTodoOptions, LaunchResult, FixTodoResult, Settings } from '../../../src/types/ai';

const execAsync = promisify(exec);
const processManager = getProcessManager();

/**
 * Extended LaunchOptions with worktree support
 */
interface WorktreeLaunchOptions extends LaunchOptions {
  worktreePath?: string; // Use this path instead of main repo path
}

interface WorktreeFixTodoOptions extends FixTodoOptions {
  worktreePath?: string; // Use this path instead of main repo path
}

function ensureClaudeSettings(repoPath: string | null = null): void {
  const targetRepoPath = repoPath || config.github.repoPath;
  if (!targetRepoPath) {
    throw new Error('Repository path is not configured');
  }

  const claudeDir = path.join(targetRepoPath, '.claude');
  const settingsFile = path.join(claudeDir, 'settings.json');

  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
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

async function launchClaude(task: ClickUpTask, options: WorktreeLaunchOptions = {}): Promise<LaunchResult> {
  const taskId = task.id;
  const taskTitle = task.name;
  const taskDescription = task.description || task.text_content || 'No description provided';
  const { analysis, repoConfig, worktreePath } = options;

  // Use provided repoConfig or fall back to legacy config
  const mainRepoPath = repoConfig?.path || config.github.repoPath;
  const repoOwner = repoConfig?.owner || config.github.owner;
  const repoName = repoConfig?.repo || config.github.repo;

  if (!mainRepoPath) {
    throw new Error('Repository path is not configured');
  }

  // Use worktree path if provided (for isolation), otherwise use main repo path
  const workingPath = worktreePath || mainRepoPath;
  const isWorktree = !!worktreePath;

  if (isWorktree) {
    console.log(timmy.info(`Using isolated worktree: ${colors.dim}${workingPath}${colors.reset}`));
  }

  console.log(timmy.ai(`Deploying ${colors.bright}Claude${colors.reset} for ${colors.bright}${taskId}${colors.reset}: "${taskTitle}"`));
  ensureClaudeSettings(workingPath);

  // Load context based on task (uses RAG if available, falls back to Smart Loader)
  console.log(timmy.info('Loading relevant coding guidelines...'));
  const smartContext = await loadContextForModel({
    model: 'claude',
    taskDescription: `${taskTitle}\n\n${taskDescription}`,
    topK: 5,
    minRelevance: 0.7
  });

  // Build prompt with optional Gemini analysis
  let analysisSection = '';
  let featureDocsPath = '';

  if (analysis && analysis.content) {
    if (analysis.featureDir) {
      featureDocsPath = `\n\n**FEATURE DOCUMENTATION:**\nThe detailed feature specification is located at:\n\`${analysis.featureDir}/feature-spec.md\`\n\nYou can read this file to understand the implementation requirements, files to modify, and acceptance criteria.`;
    }

    analysisSection = `\n\n**GEMINI AI ANALYSIS:**\nThis task has been pre-analyzed by Gemini AI. Please review the analysis below for implementation guidance:\n\n---\n${analysis.content}\n---\n\nUse this analysis to guide your implementation. Follow the suggested approach and implementation steps.${featureDocsPath}`;
  }

  // Adjust instructions based on whether we're using a worktree
  const setupInstructions = isWorktree
    ? `1. **Navigate to worktree:**\n   cd ${workingPath}\n\n   Note: You are working in an isolated worktree. The branch 'task-${taskId}' is already checked out.\n   Your changes will not affect the main repository working directory.\n\n2. **Verify you're on the correct branch:**\n   git branch --show-current\n   (Should show: task-${taskId})\n\n3. **Ensure latest changes:**\n   git pull origin main --rebase\n   (Rebase your work on latest main)`
    : `1. **Navigate to repository:**\n   cd ${workingPath}\n\n2. **Update main branch:**\n   git checkout main\n   git pull origin main\n   (Ensure we have latest changes)\n\n3. **Create new branch from main:**\n   git checkout -b task-${taskId}`;

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
- Working Path: ${workingPath}${isWorktree ? ' (isolated worktree)' : ''}
- Owner: ${repoOwner}
- Repo: ${repoName}
- Branch: task-${taskId}

${readSpecStep}**ClickUp Task URL:** ${task.url || `https://app.clickup.com/t/${taskId}`}

Begin implementation now and make sure to create the PR when done!`;

  try {
    const promptFile = path.join(__dirname, '..', `task-${taskId}-prompt.txt`);
    const logsDir = path.join(__dirname, '..', 'logs');
    const logFile = path.join(logsDir, `${taskId}-claude.log`);
    const progressFile = path.join(__dirname, '..', 'progress', `${taskId}-claude.json`);

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    fs.writeFileSync(promptFile, prompt);

    console.log(timmy.info(`${colors.bright}Claude${colors.reset} starting implementation in background...`));
    console.log(timmy.info(`Log file: ${colors.dim}${logFile}${colors.reset}`));

    // Unset GITHUB_TOKEN to let gh use keyring auth
    const cleanEnv = { ...process.env };
    delete cleanEnv.GITHUB_TOKEN;
    delete cleanEnv.GH_TOKEN;

    // Execute Claude with process tracking
    // Process will be properly killed if Timmy shuts down
    const claudeCommand = `(echo "y"; sleep 2; cat "${promptFile}") | claude --dangerously-skip-permissions`;

    try {
      await new Promise<void>((resolve, reject) => {
        const processId = `claude-${taskId}`;

        console.log(timmy.info('Starting Claude process in background (tracked for proper shutdown)...'));

        // Open log file and get file descriptor for stdio redirection
        const logFd = fs.openSync(logFile, 'a');

        const child = processManager.spawn(
          processId,
          claudeCommand,
          [],
          {
            cwd: workingPath,
            env: cleanEnv,
            shell: '/bin/bash',
            stdio: ['ignore', logFd, logFd], // Run in background, redirect output to log file
            detached: false // Keep attached so process manager can track it
          }
        );

        let hasExited = false;
        const timeout = setTimeout(() => {
          if (!hasExited) {
            console.log(timmy.error('Claude process timed out (30 minutes)'));
            try {
              fs.closeSync(logFd);
            } catch (_e) {
              // Ignore close errors
            }
            processManager.kill(processId, 'SIGKILL');
            reject(new Error('Claude execution timed out after 30 minutes'));
          }
        }, 1800000); // 30 minute timeout

        child.on('exit', (code, signal) => {
          hasExited = true;
          clearTimeout(timeout);
          processManager.unregister(processId);

          // Close log file descriptor
          try {
            fs.closeSync(logFd);
          } catch (_e) {
            // Ignore close errors
          }

          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Claude process exited with code ${code}, signal ${signal}`));
          }
        });

        child.on('error', (error) => {
          hasExited = true;
          clearTimeout(timeout);
          processManager.unregister(processId);

          // Close log file descriptor
          try {
            fs.closeSync(logFd);
          } catch (_e) {
            // Ignore close errors
          }

          reject(error);
        });
      });

      console.log(timmy.success(`${colors.bright}Claude${colors.reset} completed implementation for ${colors.bright}task-${taskId}${colors.reset}`));

      // Cleanup prompt file
      fs.unlinkSync(promptFile);

      await clickup.addComment(
        taskId,
        `✅ **Claude Implementation Complete**\n\n` +
        `Claude has finished implementing the feature.\n\n` +
        `**Branch:** \`task-${taskId}\`\n` +
        `**Status:** Complete\n\n` +
        `Next: Pull Request should be created`
      );

      return {
        success: true,
        branch: `task-${taskId}`,
        logFile,
        progressFile
      };

    } catch (claudeError) {
      const err = claudeError as Error;
      console.log(timmy.error(`${colors.bright}Claude${colors.reset} execution failed: ${err.message}`));

      // Cleanup prompt file
      if (fs.existsSync(promptFile)) {
        fs.unlinkSync(promptFile);
      }

      throw claudeError;
    }

  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Deployment failed: ${err.message}`));
    console.log(timmy.info('Task queued for manual processing'));

    await storage.queue.add(task);

    return { success: false, error: err.message };
  }
}

async function fixTodoComments(task: ClickUpTask, options: WorktreeFixTodoOptions = {}): Promise<FixTodoResult> {
  const taskId = task.id;
  const taskTitle = task.name;
  const branch = `task-${taskId}`;
  const { repoConfig, worktreePath } = options;

  // Use provided repoConfig or fall back to legacy config
  const mainRepoPath = repoConfig?.path || config.github.repoPath;
  const repoOwner = repoConfig?.owner || config.github.owner;
  const repoName = repoConfig?.repo || config.github.repo;

  if (!mainRepoPath) {
    throw new Error('Repository path is not configured');
  }

  // Use worktree path if provided (for isolation), otherwise use main repo path
  const workingPath = worktreePath || mainRepoPath;
  const isWorktree = !!worktreePath;

  if (isWorktree) {
    console.log(timmy.info(`Using isolated worktree: ${colors.dim}${workingPath}${colors.reset}`));
  }

  console.log(timmy.ai(`${colors.bright}Claude${colors.reset} addressing TODO/FIXME comments for ${colors.bright}${taskId}${colors.reset}`));
  ensureClaudeSettings(workingPath);

  // Adjust instructions based on whether we're using a worktree
  const checkoutInstructions = isWorktree
    ? `1. **Navigate to worktree:**\n   cd ${workingPath}\n\n   Note: You are in an isolated worktree with branch '${branch}' already checked out.\n\n   git pull origin ${branch}`
    : `1. **Checkout the branch:**\n   cd ${workingPath}\n   git checkout ${branch}\n   git pull origin ${branch}`;

  // Load fixes skill from markdown file
  const fixesSkill = await loadAndApplySkill('fixes', {
    taskId,
    taskTitle,
    branch,
    checkoutInstructions,
  });

  const prompt = `${fixesSkill}

**ClickUp Task ID:** ${taskId}
**Title:** ${taskTitle}
**Branch:** ${branch}

**Repository Information:**
- Working Path: ${workingPath}${isWorktree ? ' (isolated worktree)' : ''}
- Owner: ${repoOwner}
- Repo: ${repoName}

Begin addressing the comments now - FIXME comments first, then TODO!`;

  try {
    const promptFile = path.join(__dirname, '..', `task-${taskId}-fix-todos-prompt.txt`);
    const logsDir = path.join(__dirname, '..', 'logs');
    const logFile = path.join(logsDir, `${taskId}-claude-fixes.log`);

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    fs.writeFileSync(promptFile, prompt);

    console.log(timmy.info(`${colors.bright}Claude${colors.reset} starting TODO/FIXME fixes in background...`));
    console.log(timmy.info(`Log file: ${colors.dim}${logFile}${colors.reset}`));

    // Unset GITHUB_TOKEN to let gh use keyring auth
    const cleanEnv = { ...process.env };
    delete cleanEnv.GITHUB_TOKEN;
    delete cleanEnv.GH_TOKEN;

    // Execute Claude with process tracking for TODO fixes
    const claudeCommand = `(echo "y"; sleep 2; cat "${promptFile}") | claude --dangerously-skip-permissions`;

    try {
      await new Promise<void>((resolve, reject) => {
        const processId = `claude-fix-${taskId}`;

        console.log(timmy.info('Starting Claude fix process in background (tracked for proper shutdown)...'));

        // Open log file and get file descriptor for stdio redirection
        const logFd = fs.openSync(logFile, 'a');

        const child = processManager.spawn(
          processId,
          claudeCommand,
          [],
          {
            cwd: workingPath,
            env: cleanEnv,
            shell: '/bin/bash',
            stdio: ['ignore', logFd, logFd], // Run in background, redirect output to log file
            detached: false // Keep attached so process manager can track it
          }
        );

        let hasExited = false;
        const timeout = setTimeout(() => {
          if (!hasExited) {
            console.log(timmy.error('Claude fix process timed out (30 minutes)'));
            try {
              fs.closeSync(logFd);
            } catch (_e) {
              // Ignore close errors
            }
            processManager.kill(processId, 'SIGKILL');
            reject(new Error('Claude fix execution timed out after 30 minutes'));
          }
        }, 1800000); // 30 minute timeout

        child.on('exit', (code, signal) => {
          hasExited = true;
          clearTimeout(timeout);
          processManager.unregister(processId);

          // Close log file descriptor
          try {
            fs.closeSync(logFd);
          } catch (_e) {
            // Ignore close errors
          }

          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Claude fix process exited with code ${code}, signal ${signal}`));
          }
        });

        child.on('error', (error) => {
          hasExited = true;
          clearTimeout(timeout);
          processManager.unregister(processId);

          // Close log file descriptor
          try {
            fs.closeSync(logFd);
          } catch (_e) {
            // Ignore close errors
          }

          reject(error);
        });
      });

      console.log(timmy.success(`${colors.bright}Claude${colors.reset} completed TODO/FIXME fixes for ${colors.bright}${branch}${colors.reset}`));

      // Cleanup prompt file
      fs.unlinkSync(promptFile);

      // Check if Claude made any changes and auto-commit/push them
      console.log(timmy.info('Checking for uncommitted changes from Claude fixes...'));

      try {
        const { stdout: statusOutput } = await execAsync(`cd "${workingPath}" && git status --porcelain`, {
          env: cleanEnv
        });

        if (statusOutput.trim()) {
          console.log(timmy.info('Claude made changes. Committing and pushing...'));

          // Commit and push the changes
          await execAsync(
            `cd "${workingPath}" && git add . && git commit -m "fix: Address TODO/FIXME comments from code review (#${taskId})" && git push origin ${branch}`,
            {
              env: cleanEnv,
              timeout: 60000 // 1 minute timeout for git operations
            }
          );

          console.log(timmy.success('Claude fixes committed and pushed'));
        } else {
          console.log(timmy.info('No changes to commit from Claude fixes'));
        }
      } catch (gitError) {
        const err = gitError as Error;
        console.log(timmy.warning(`Failed to auto-commit Claude fixes: ${err.message}`));
        // Don't fail the whole fix process if git operations fail
      }

      // Determine if changes were auto-committed
      let commitStatus = 'Changes auto-committed and pushed';
      try {
        const { stdout: finalStatus } = await execAsync(`cd "${workingPath}" && git status --porcelain`, {
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
        `✅ **TODO/FIXME Fixes Complete**\n\n` +
        `Claude has addressed all TODO/FIXME comments from Codex's review.\n\n` +
        `**Branch:** \`${branch}\`\n` +
        `**Status:** ${commitStatus}\n\n` +
        `PR has been updated with all improvements`
      );

      return {
        success: true,
        branch
      };

    } catch (claudeError) {
      const err = claudeError as Error;
      console.log(timmy.error(`${colors.bright}Claude${colors.reset} fix execution failed: ${err.message}`));

      // Cleanup prompt file
      if (fs.existsSync(promptFile)) {
        fs.unlinkSync(promptFile);
      }

      throw claudeError;
    }

  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`TODO fix failed: ${err.message}`));
    return { success: false, error: err.message };
  }
}

export {
  ensureClaudeSettings,
  launchClaude,
  fixTodoComments,
  // Types
  ClickUpTask,
  LaunchOptions,
  FixTodoOptions,
  LaunchResult,
  FixTodoResult,
  Settings
};
