/**
 * Test Generation Stage - Claude-powered test generation
 *
 * This stage uses Claude Code to generate tests for the implemented feature.
 * It loads existing test patterns from the codebase to ensure consistency
 * and follows the project's testing conventions.
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as storage from '../../../lib/storage';
import { BaseStage } from './base-stage';
import { timmy, colors } from '@/shared/ui';
import { getProcessManager } from '@/shared/utils/process-manager.util';
import type { StageContext, TestGenerationResult } from './types';

const execAsync = promisify(exec);
const processManager = getProcessManager();

/**
 * Test pattern example loaded from the codebase
 */
interface TestPattern {
  filePath: string;
  content: string;
  relativePath: string;
}

/**
 * Test Generation Stage
 *
 * Generates tests for implemented features using Claude Code CLI
 */
export class TestGenerationStage extends BaseStage<TestGenerationResult> {
  protected readonly stageName = 'Test Generation';

  /**
   * Execute test generation
   *
   * @param context The stage execution context
   * @returns Test generation result
   */
  async execute(context: StageContext): Promise<TestGenerationResult> {
    const { task, taskId, repoConfig, worktreePath } = context;

    // Update pipeline stage
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.GENERATING_TESTS, {
      name: 'Test Generation',
    });

    const workingPath = worktreePath || repoConfig.path;

    try {
      this.logAI('Starting test generation...', 'Claude');

      // Load existing test patterns from the codebase
      const testPatterns = await this.loadTestPatterns(workingPath);
      await this.updateProgress(`Loaded ${testPatterns.length} test pattern examples`);

      // Get list of changed files to understand what needs tests
      const changedFiles = await this.getChangedFiles(workingPath, taskId);
      await this.updateProgress(`Found ${changedFiles.length} changed files`);

      if (changedFiles.length === 0) {
        this.logWarning('No changed files found, skipping test generation');
        storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.GENERATING_TESTS, {
          testsCreated: 0,
        });
        return {
          success: true,
          testsCreated: 0,
          testFiles: [],
        };
      }

      // Build the prompt for Claude
      const prompt = this.buildTestGenerationPrompt(task, changedFiles, testPatterns, workingPath, taskId);

      // Write prompt to file
      const promptFile = path.join(workingPath, `.claude-test-gen-${taskId}.txt`);
      fs.writeFileSync(promptFile, prompt);

      // Create logs directory
      const logsDir = path.join(workingPath, '.timmy-logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const logFile = path.join(logsDir, `${taskId}-test-gen.log`);

      // Ensure Claude settings exist
      this.ensureClaudeSettings(workingPath);

      // Execute Claude for test generation
      console.log(timmy.ai(`${colors.bright}Claude${colors.reset} generating tests...`));

      const claudePath = process.env.CLAUDE_CLI_PATH || 'claude';
      const claudeCommand = `(echo "y"; sleep 2; cat "${promptFile}") | ${claudePath} --dangerously-skip-permissions`;

      await new Promise<void>((resolve, reject) => {
        const processId = `claude-test-gen-${taskId}`;

        // Open log file for output
        const logFd = fs.openSync(logFile, 'a');

        const child = processManager.spawn(
          processId,
          claudeCommand,
          [],
          {
            cwd: workingPath,
            shell: '/bin/bash',
            stdio: ['ignore', logFd, logFd],
            detached: false,
          }
        );

        let hasExited = false;
        const timeout = setTimeout(() => {
          if (!hasExited) {
            console.log(timmy.error('Test generation timed out (10 minutes)'));
            try {
              fs.closeSync(logFd);
            } catch {
              // Ignore
            }
            processManager.kill(processId, 'SIGKILL');
            reject(new Error('Test generation timed out after 10 minutes'));
          }
        }, 600000); // 10 minute timeout

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
            reject(new Error(`Test generation exited with code ${code}, signal ${signal}`));
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

      // Clean up prompt file
      try {
        fs.unlinkSync(promptFile);
      } catch {
        // Ignore cleanup errors
      }

      // Count generated test files
      const testFiles = await this.findGeneratedTests(workingPath, taskId);

      // Update pipeline with success
      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.GENERATING_TESTS, {
        testsCreated: testFiles.length,
        testFiles,
      });

      this.logSuccess(`Generated ${testFiles.length} test file(s)`, {
        testFiles,
        logFile,
      });

      return {
        success: true,
        testsCreated: testFiles.length,
        testFiles,
        logFile,
      };
    } catch (error) {
      const err = error as Error;
      this.logError(`Test generation failed: ${err.message}`, err);

      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.GENERATING_TESTS, err);

      // Test generation failure is not critical - we can continue without tests
      return {
        success: false,
        error: err.message,
        testsCreated: 0,
        testFiles: [],
      };
    }
  }

  /**
   * Load test pattern examples from the codebase
   */
  private async loadTestPatterns(repoPath: string): Promise<TestPattern[]> {
    const patterns: TestPattern[] = [];
    const testDirs = ['__tests__', 'test', 'tests', 'spec'];
    const testFilePatterns = ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx', '.test.js', '.spec.js'];

    try {
      // Find test files recursively
      const testFiles = await this.findTestFiles(repoPath, testDirs, testFilePatterns);

      // Load up to 5 most recent test files as examples
      const recentTests = testFiles.slice(0, 5);

      for (const filePath of recentTests) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const relativePath = path.relative(repoPath, filePath);

          // Only include if file is not too large (under 500 lines)
          const lineCount = content.split('\n').length;
          if (lineCount <= 500) {
            patterns.push({
              filePath,
              content,
              relativePath,
            });
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      this.logWarning(`Could not load test patterns: ${(error as Error).message}`);
    }

    return patterns;
  }

  /**
   * Find test files in the repository
   */
  private async findTestFiles(
    dir: string,
    testDirs: string[],
    testFilePatterns: string[]
  ): Promise<string[]> {
    const testFiles: string[] = [];

    const searchDir = async (currentDir: string): Promise<void> => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          // Skip node_modules, dist, and hidden directories
          if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
            continue;
          }

          if (entry.isDirectory()) {
            // If this is a test directory, search it
            if (testDirs.includes(entry.name)) {
              await searchDir(fullPath);
            } else {
              // Check if directory contains test subdirs
              await searchDir(fullPath);
            }
          } else if (entry.isFile()) {
            // Check if file matches test patterns
            if (testFilePatterns.some(pattern => entry.name.endsWith(pattern))) {
              testFiles.push(fullPath);
            }
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    };

    await searchDir(dir);

    // Sort by modification time (newest first)
    testFiles.sort((a, b) => {
      try {
        const statA = fs.statSync(a);
        const statB = fs.statSync(b);
        return statB.mtime.getTime() - statA.mtime.getTime();
      } catch {
        return 0;
      }
    });

    return testFiles;
  }

  /**
   * Get list of files changed in this task's branch
   */
  private async getChangedFiles(repoPath: string, taskId: string): Promise<string[]> {
    try {
      // Get files changed compared to main/master
      const { stdout } = await execAsync(
        `cd "${repoPath}" && git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only origin/master...HEAD 2>/dev/null || git diff --name-only HEAD~5...HEAD`,
        { maxBuffer: 1024 * 1024 }
      );

      return stdout
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0)
        // Filter to only source files (not tests, configs, etc.)
        .filter(f => {
          const ext = path.extname(f);
          const isSourceFile = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'].includes(ext);
          const isNotTest = !f.includes('.test.') && !f.includes('.spec.') && !f.includes('__tests__');
          const isNotConfig = !f.includes('config') && !f.includes('.json') && !f.includes('.md');
          return isSourceFile && isNotTest && isNotConfig;
        });
    } catch (error) {
      this.logWarning(`Could not get changed files: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Find test files that were generated in this session
   */
  private async findGeneratedTests(repoPath: string, taskId: string): Promise<string[]> {
    try {
      // Get test files that were added in recent commits
      const { stdout } = await execAsync(
        `cd "${repoPath}" && git diff --name-only --cached && git diff --name-only HEAD`,
        { maxBuffer: 1024 * 1024 }
      );

      return stdout
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0)
        .filter(f => f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__'));
    } catch {
      return [];
    }
  }

  /**
   * Build the test generation prompt for Claude
   */
  private buildTestGenerationPrompt(
    task: { id: string; name: string; description?: string; text_content?: string },
    changedFiles: string[],
    testPatterns: TestPattern[],
    workingPath: string,
    taskId: string
  ): string {
    const taskDescription = task.description || task.text_content || 'No description provided';

    // Build test patterns section
    let patternsSection = '';
    if (testPatterns.length > 0) {
      patternsSection = `

## EXISTING TEST PATTERNS (FOLLOW THESE EXACTLY)

You MUST follow the testing patterns used in this codebase. Here are examples of existing tests:

${testPatterns
  .map(
    (p, i) => `
### Example ${i + 1}: ${p.relativePath}

\`\`\`typescript
${p.content.slice(0, 3000)}${p.content.length > 3000 ? '\n// ... (truncated)' : ''}
\`\`\`
`
  )
  .join('\n')}

**IMPORTANT:** Your generated tests MUST:
- Use the same testing framework (Jest, Mocha, etc.) as the examples
- Follow the same file naming conventions
- Use the same import patterns
- Match the same describe/it structure
- Use the same mocking patterns
- Place test files in the same location relative to source files
`;
    }

    return `# Test Generation Task

## Task Information
**Task ID:** ${taskId}
**Task Title:** ${task.name}
**Description:** ${taskDescription}

## Files Changed (Need Tests)
${changedFiles.map(f => `- ${f}`).join('\n')}
${patternsSection}

## Instructions

You need to generate comprehensive tests for the changed files listed above.

**Steps:**

1. **Read each changed file** to understand what was implemented

2. **Determine the appropriate test location:**
   - If the project uses \`__tests__\` folders, create tests there
   - If tests are co-located with source files, create \`.test.ts\` files next to source files
   - Follow the existing pattern from the examples

3. **Generate tests that cover:**
   - Happy path scenarios
   - Edge cases
   - Error handling
   - Any public functions/methods in the changed files

4. **Follow the project's testing conventions:**
   - Use the same assertion style
   - Mock dependencies the same way
   - Use the same setup/teardown patterns

5. **Commit the tests:**
   \`\`\`bash
   git add .
   git commit -m "test: add tests for ${task.name} (#${taskId})"
   \`\`\`

**CRITICAL REQUIREMENTS:**
- DO NOT modify the implementation code, only add tests
- Tests MUST pass (run \`npm test\` to verify)
- Follow EXACTLY the patterns from the existing test examples
- Do not add unnecessary dependencies
- Keep tests focused and readable

**Working Directory:** ${workingPath}

Begin generating tests now!`;
  }

  /**
   * Ensure Claude settings exist in the working directory
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
          '*',
        ],
        deny: [],
      },
    };

    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  }

  /**
   * Validate dependencies for test generation
   */
  protected async validateDependencies(context: StageContext): Promise<void> {
    await super.validateDependencies(context);

    if (!context.repoConfig.path) {
      throw new Error('Repository path is required for test generation');
    }
  }
}
