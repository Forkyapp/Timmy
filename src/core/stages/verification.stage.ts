/**
 * Verification Stage - Build and Test Verification
 *
 * This stage runs build and tests after implementation (and after fixes).
 * If verification fails, it calls Claude to fix the issues and retries.
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as storage from '../../../lib/storage';
import * as clickup from '../../../lib/clickup';
import config from '../../shared/config';
import { timmy, colors } from '../../shared/ui';
import { getProcessManager } from '../../shared/utils/process-manager.util';
import { BaseStage } from './base-stage';
import { loadTestPatterns, formatTestPatternsForPrompt } from './utils/test-pattern-loader';
import type { StageContext, VerificationResult } from './types';
import type { ClickUpTask } from '../../types/clickup';
import type { RepositoryConfig } from '../../shared/config';

const execAsync = promisify(exec);
const processManager = getProcessManager();

/**
 * Options for verification execution
 */
interface VerificationOptions {
  /** Maximum fix attempts before giving up */
  maxFixAttempts?: number;
  /** Timeout for each command in milliseconds */
  commandTimeout?: number;
  /** Skip lint check */
  skipLint?: boolean;
}

/**
 * Result of running a verification command
 */
interface CommandResult {
  success: boolean;
  output: string;
  exitCode: number | null;
}

/**
 * Verification Stage
 *
 * Runs build, tests, and optionally lint after implementation.
 * If failures occur, calls Claude to fix and retries.
 */
export class VerificationStage extends BaseStage<VerificationResult> {
  protected readonly stageName = 'Verification';

  private readonly maxFixAttempts: number;
  private readonly commandTimeout: number;
  private readonly skipLint: boolean;

  constructor(options: VerificationOptions = {}) {
    super();
    this.maxFixAttempts = options.maxFixAttempts ?? 3;
    this.commandTimeout = options.commandTimeout ?? 300000; // 5 minutes
    this.skipLint = options.skipLint ?? true; // Skip lint by default to focus on build/test
  }

  /**
   * Execute verification stage
   *
   * @param context The stage execution context
   * @returns Verification result
   */
  async execute(context: StageContext): Promise<VerificationResult> {
    const { task, taskId, repoConfig, worktreePath } = context;

    // Use worktree path if provided, otherwise use main repo path
    const workingPath = worktreePath || repoConfig.path;

    // Update pipeline stage
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.VERIFYING, {
      name: 'Build & Test Verification',
    });

    let fixAttempts = 0;
    let lastBuildError: string | undefined;
    let lastTestError: string | undefined;

    // Main verification loop
    while (fixAttempts <= this.maxFixAttempts) {
      this.logAI(
        fixAttempts === 0
          ? 'Running build and tests...'
          : `Verification attempt ${fixAttempts + 1}/${this.maxFixAttempts + 1}...`,
        'Verification'
      );

      // Run build
      const buildResult = await this.runBuild(workingPath);
      if (!buildResult.success) {
        lastBuildError = buildResult.output;
        this.logWarning(`Build failed:\n${this.truncateOutput(buildResult.output)}`);

        if (fixAttempts >= this.maxFixAttempts) {
          return this.createFailureResult(taskId, {
            buildPassed: false,
            buildError: lastBuildError,
            fixAttempts,
          });
        }

        // Call Claude to fix build errors
        await this.callClaudeToFix(task, {
          repoConfig,
          worktreePath,
          buildError: buildResult.output,
          testPatterns: await this.getTestPatterns(workingPath),
        });

        fixAttempts++;
        continue;
      }

      this.logSuccess('Build passed');

      // Run tests
      const testResult = await this.runTests(workingPath);
      if (!testResult.success) {
        lastTestError = testResult.output;
        this.logWarning(`Tests failed:\n${this.truncateOutput(testResult.output)}`);

        if (fixAttempts >= this.maxFixAttempts) {
          return this.createFailureResult(taskId, {
            buildPassed: true,
            testsPassed: false,
            testError: lastTestError,
            fixAttempts,
          });
        }

        // Call Claude to fix test errors
        await this.callClaudeToFix(task, {
          repoConfig,
          worktreePath,
          testError: testResult.output,
          testPatterns: await this.getTestPatterns(workingPath),
        });

        fixAttempts++;
        continue;
      }

      this.logSuccess('All tests passed');

      // Parse test results
      const testStats = this.parseTestOutput(testResult.output);

      // All verification passed!
      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.VERIFYING, {
        buildPassed: true,
        testsPassed: true,
        testsRun: testStats.total,
        fixAttempts,
      });

      await this.postSuccessComment(taskId, testStats, fixAttempts);

      return {
        success: true,
        buildPassed: true,
        testsPassed: true,
        testsRun: testStats.total,
        testsFailed: testStats.failed,
        fixAttempts,
      };
    }

    // Should not reach here, but handle it
    return this.createFailureResult(taskId, {
      buildPassed: false,
      testsPassed: false,
      buildError: lastBuildError,
      testError: lastTestError,
      fixAttempts,
    });
  }

  /**
   * Run the build command
   */
  private async runBuild(workingPath: string): Promise<CommandResult> {
    try {
      // First try type-check, then build
      const commands = ['npm run type-check', 'npm run build'];

      for (const cmd of commands) {
        try {
          const { stdout, stderr } = await execAsync(cmd, {
            cwd: workingPath,
            timeout: this.commandTimeout,
            env: { ...process.env, CI: 'true' },
          });
          // If command succeeds, continue to next
          if (stdout.includes('error') || stderr.includes('error')) {
            return {
              success: false,
              output: stdout + '\n' + stderr,
              exitCode: 1,
            };
          }
        } catch (error) {
          const err = error as { stdout?: string; stderr?: string; code?: number };
          // type-check might not exist, try build
          if (cmd === 'npm run type-check' && err.stderr?.includes('Missing script')) {
            continue;
          }
          return {
            success: false,
            output: (err.stdout || '') + '\n' + (err.stderr || ''),
            exitCode: err.code ?? 1,
          };
        }
      }

      return { success: true, output: 'Build successful', exitCode: 0 };
    } catch (error) {
      const err = error as Error;
      return {
        success: false,
        output: err.message,
        exitCode: 1,
      };
    }
  }

  /**
   * Run the test command
   */
  private async runTests(workingPath: string): Promise<CommandResult> {
    try {
      const { stdout, stderr } = await execAsync('npm test -- --passWithNoTests', {
        cwd: workingPath,
        timeout: this.commandTimeout,
        env: { ...process.env, CI: 'true' },
      });

      const output = stdout + '\n' + stderr;

      // Check if tests actually failed
      if (
        output.includes('FAIL') ||
        output.includes('Test Suites: 0 passed') ||
        output.includes('Tests:       0 passed')
      ) {
        // Actually check if there were failures
        const hasFailures =
          output.includes('Test Suites:') &&
          !output.includes('Test Suites: 0 failed') &&
          output.includes('failed');

        if (hasFailures) {
          return {
            success: false,
            output,
            exitCode: 1,
          };
        }
      }

      return { success: true, output, exitCode: 0 };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; code?: number };
      return {
        success: false,
        output: (err.stdout || '') + '\n' + (err.stderr || ''),
        exitCode: err.code ?? 1,
      };
    }
  }

  /**
   * Get test patterns from the codebase
   */
  private async getTestPatterns(workingPath: string): Promise<string> {
    try {
      const patterns = await loadTestPatterns({
        repoPath: workingPath,
        maxExamples: 3,
        maxLinesPerFile: 100,
      });
      return formatTestPatternsForPrompt(patterns);
    } catch {
      return '';
    }
  }

  /**
   * Call Claude to fix verification errors
   */
  private async callClaudeToFix(
    task: ClickUpTask,
    options: {
      repoConfig: RepositoryConfig;
      worktreePath?: string;
      buildError?: string;
      testError?: string;
      testPatterns?: string;
    }
  ): Promise<void> {
    const { repoConfig, worktreePath, buildError, testError, testPatterns } = options;
    const taskId = task.id;
    const branch = `task-${taskId}`;

    const workingPath = worktreePath || repoConfig.path;
    const isWorktree = !!worktreePath;

    this.logAI('Calling Claude to fix verification errors...', 'Claude');

    // Build error description
    let errorDescription = '';
    if (buildError) {
      errorDescription += `**BUILD ERRORS:**\n\`\`\`\n${this.truncateOutput(buildError, 2000)}\n\`\`\`\n\n`;
    }
    if (testError) {
      errorDescription += `**TEST ERRORS:**\n\`\`\`\n${this.truncateOutput(testError, 2000)}\n\`\`\`\n\n`;
    }

    const prompt = `You need to fix build and/or test errors in the codebase.

**ClickUp Task ID:** ${taskId}
**Branch:** ${branch}

**Repository Information:**
- Working Path: ${workingPath}${isWorktree ? ' (isolated worktree)' : ''}
- Owner: ${repoConfig.owner}
- Repo: ${repoConfig.repo}

${errorDescription}

${testPatterns || ''}

**Your Task:**

1. **Navigate to repository:**
   cd ${workingPath}
   ${isWorktree ? `Note: You are in an isolated worktree with branch '${branch}' already checked out.` : ''}

2. **Analyze the errors above carefully**
   - Read and understand each error message
   - Identify the root cause

3. **Fix the errors:**
   - For build/type errors: Fix type mismatches, missing imports, syntax errors
   - For test errors: Fix the test OR the code being tested
   - If tests are missing: Write NEW tests following the patterns above

4. **IMPORTANT - When writing tests:**
   - Follow the EXACT patterns from the test examples above
   - Use the same mocking style (jest.mock, jest.fn)
   - Use the same describe/it structure
   - Place tests in __tests__ folders
   - Name files with .test.ts extension

5. **Verify your fixes:**
   npm run build
   npm test

6. **Commit and push:**
   git add .
   git commit -m "fix: Fix build/test errors (#${taskId})"
   git push origin ${branch}

**CRITICAL:**
- Fix ALL errors shown above
- Ensure build passes after your changes
- Ensure ALL tests pass after your changes
- Follow existing code patterns
- Do NOT skip any errors

Begin fixing the errors now!`;

    try {
      const promptFile = path.join(__dirname, '..', `task-${taskId}-verify-fix-prompt.txt`);
      const logsDir = path.join(__dirname, '..', 'logs');
      const logFile = path.join(logsDir, `${taskId}-claude-verify-fix.log`);

      // Ensure logs directory exists
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      fs.writeFileSync(promptFile, prompt);

      console.log(
        timmy.info(`${colors.bright}Claude${colors.reset} fixing verification errors in background...`)
      );
      console.log(timmy.info(`Log file: ${colors.dim}${logFile}${colors.reset}`));

      // Unset GITHUB_TOKEN to let gh use keyring auth
      const cleanEnv = { ...process.env };
      delete cleanEnv.GITHUB_TOKEN;
      delete cleanEnv.GH_TOKEN;

      // Ensure Claude settings exist
      this.ensureClaudeSettings(workingPath);

      // Execute Claude
      const claudeCommand = `(echo "y"; sleep 2; cat "${promptFile}") | claude --dangerously-skip-permissions`;

      await new Promise<void>((resolve, reject) => {
        const processId = `claude-verify-fix-${taskId}`;

        // Open log file
        const logFd = fs.openSync(logFile, 'a');

        const child = processManager.spawn(processId, claudeCommand, [], {
          cwd: workingPath,
          env: cleanEnv,
          shell: '/bin/bash',
          stdio: ['ignore', logFd, logFd],
          detached: false,
        });

        let hasExited = false;
        const timeout = setTimeout(() => {
          if (!hasExited) {
            this.logError('Claude verify-fix process timed out (20 minutes)');
            try {
              fs.closeSync(logFd);
            } catch {
              // Ignore
            }
            processManager.kill(processId, 'SIGKILL');
            reject(new Error('Claude verify-fix timed out after 20 minutes'));
          }
        }, 1200000); // 20 minute timeout

        child.on('exit', (code, signal) => {
          hasExited = true;
          clearTimeout(timeout);
          processManager.unregister(processId);

          try {
            fs.closeSync(logFd);
          } catch {
            // Ignore
          }

          if (code === 0) {
            resolve();
          } else {
            // Don't reject on non-zero exit - Claude might have made partial progress
            this.logWarning(`Claude exited with code ${code}, signal ${signal}`);
            resolve();
          }
        });

        child.on('error', (error) => {
          hasExited = true;
          clearTimeout(timeout);
          processManager.unregister(processId);

          try {
            fs.closeSync(logFd);
          } catch {
            // Ignore
          }

          reject(error);
        });
      });

      // Cleanup prompt file
      if (fs.existsSync(promptFile)) {
        fs.unlinkSync(promptFile);
      }

      this.logSuccess('Claude finished fixing attempt');

      // Auto-commit any changes Claude made
      await this.autoCommitChanges(workingPath, taskId, branch, cleanEnv);
    } catch (error) {
      const err = error as Error;
      this.logError(`Claude fix attempt failed: ${err.message}`, err);
      // Don't throw - let the verification loop continue
    }
  }

  /**
   * Auto-commit any uncommitted changes
   */
  private async autoCommitChanges(
    workingPath: string,
    taskId: string,
    branch: string,
    env: NodeJS.ProcessEnv
  ): Promise<void> {
    try {
      const { stdout: statusOutput } = await execAsync(`git status --porcelain`, {
        cwd: workingPath,
        env,
      });

      if (statusOutput.trim()) {
        console.log(timmy.info('Auto-committing Claude fixes...'));

        await execAsync(
          `git add . && git commit -m "fix: Fix build/test errors (#${taskId})" && git push origin ${branch}`,
          {
            cwd: workingPath,
            env,
            timeout: 60000,
          }
        );

        console.log(timmy.success('Claude fixes committed and pushed'));
      }
    } catch (error) {
      const err = error as Error;
      this.logWarning(`Failed to auto-commit: ${err.message}`);
    }
  }

  /**
   * Ensure Claude settings exist in the repo
   */
  private ensureClaudeSettings(repoPath: string): void {
    const claudeDir = path.join(repoPath, '.claude');
    const settingsFile = path.join(claudeDir, 'settings.json');

    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    const settings = {
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
          '*',
        ],
        deny: [],
      },
      hooks: {
        'user-prompt-submit': "echo 'yes'",
      },
    };

    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  }

  /**
   * Parse test output for statistics
   */
  private parseTestOutput(output: string): { total: number; passed: number; failed: number } {
    const stats = { total: 0, passed: 0, failed: 0 };

    // Try to parse Jest output
    const testsMatch = output.match(/Tests:\s+(\d+)\s+passed/);
    const failedMatch = output.match(/Tests:\s+(\d+)\s+failed/);
    const totalMatch = output.match(/Tests:\s+(\d+)\s+total/);

    if (totalMatch) {
      stats.total = parseInt(totalMatch[1], 10);
    }
    if (testsMatch) {
      stats.passed = parseInt(testsMatch[1], 10);
    }
    if (failedMatch) {
      stats.failed = parseInt(failedMatch[1], 10);
    }

    return stats;
  }

  /**
   * Truncate output to a reasonable length
   */
  private truncateOutput(output: string, maxLength: number = 1000): string {
    if (output.length <= maxLength) {
      return output;
    }
    return output.substring(0, maxLength) + '\n... (truncated)';
  }

  /**
   * Create a failure result and update pipeline
   */
  private createFailureResult(
    taskId: string,
    data: Partial<VerificationResult>
  ): VerificationResult {
    const error = data.buildError
      ? 'Build verification failed'
      : data.testError
        ? 'Test verification failed'
        : 'Verification failed';

    storage.pipeline.failStage(taskId, storage.pipeline.STAGES.VERIFYING, new Error(error));

    this.logError(error);

    return {
      success: false,
      error,
      ...data,
    };
  }

  /**
   * Post success comment to ClickUp
   */
  private async postSuccessComment(
    taskId: string,
    testStats: { total: number; passed: number; failed: number },
    fixAttempts: number
  ): Promise<void> {
    try {
      const attemptsNote =
        fixAttempts > 0 ? `\n**Fix Attempts:** ${fixAttempts} (auto-fixed by Claude)` : '';

      await clickup.addComment(
        taskId,
        `✅ **Verification Passed**\n\n` +
          `Build and tests completed successfully.\n\n` +
          `**Tests Run:** ${testStats.total}\n` +
          `**Tests Passed:** ${testStats.passed}\n` +
          `**Tests Failed:** ${testStats.failed}${attemptsNote}`
      );
    } catch {
      // Don't fail if comment posting fails
    }
  }

  /**
   * Validate dependencies before execution
   */
  protected async validateDependencies(context: StageContext): Promise<void> {
    await super.validateDependencies(context);

    if (!context.repoConfig.path) {
      throw new Error('Repository path is required for verification');
    }

    // Check that implementation stage completed
    const pipeline = storage.pipeline.get(context.taskId);
    if (pipeline) {
      const implStage = pipeline.stages.find((s) => s.stage === storage.pipeline.STAGES.IMPLEMENTING);
      if (!implStage || implStage.status !== 'completed') {
        throw new Error('Implementation stage must be completed before verification');
      }
    }
  }
}
