import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec, spawn, ChildProcess } from 'child_process';
import config from '../../shared/config';
import { forky, colors } from '../../shared/ui';
import { loadSmartContext } from '../context/smart-context-loader.service';
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

// Removed execWithPTY() function - was unused (53 lines)

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

// Removed launchCodex() function - was unused (237 lines)
// Codex is only used for reviews via reviewClaudeChanges(), not for implementations

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

  console.log(forky.ai(`${colors.bright}Codex${colors.reset} reviewing Claude's changes for ${colors.bright}${taskId}${colors.reset}`));
  ensureCodexSettings(repoPath);

  // Load smart context for review
  console.log(forky.info('Loading relevant review guidelines...'));
  const smartContext = await loadSmartContext({
    model: 'codex',
    taskDescription: `Code review for: ${taskTitle}\n\nReviewing implementation changes`,
    includeProject: true
  });

  const prompt = `${smartContext ? smartContext + '\n\n' + '='.repeat(80) + '\n\n' : ''}You are a senior code reviewer. Your job is to review the changes made by Claude and add constructive TODO comments for improvements.

**ClickUp Task ID:** ${taskId}
**Title:** ${taskTitle}
**Branch:** ${branch}

**Repository Information:**
- Path: ${repoPath}
- Owner: ${repoOwner}
- Repo: ${repoName}

**Your Review Process:**

1. **Checkout the branch:**
   cd ${repoPath}
   git checkout ${branch}
   git pull origin ${branch}

2. **Review all changes:**
   git diff main...${branch}

   Look at:
   - Code quality and best practices
   - Potential bugs or edge cases
   - Performance improvements
   - Security concerns
   - Missing error handling
   - Code readability and maintainability
   - Missing tests

3. **Add TODO and FIXME comments DIRECTLY in the code files:**
   - Open each modified file
   - Add clear, actionable comments where improvements are needed
   - Use TODO for enhancements/nice-to-haves
   - Use FIXME for bugs/critical issues that must be addressed
   - Format: \`// TODO: [Enhancement suggestion]\` or \`// FIXME: [Critical issue]\`
   - Be specific and constructive
   - Focus on:
     * FIXME: Bugs or critical issues
     * FIXME: Missing error handling
     * FIXME: Security vulnerabilities
     * TODO: Edge cases not handled
     * TODO: Performance optimizations
     * TODO: Code clarity improvements
     * TODO: Missing validation
     * TODO: Additional tests needed

4. **Commit your TODO and FIXME comments:**
   git add .
   git commit -m "review: Add TODO/FIXME comments from Codex review (#${taskId})"
   git push origin ${branch}

**Important Guidelines:**
- Add TODO and FIXME comments INLINE in the code files (not in separate review files)
- Be constructive and specific
- Each comment should be actionable
- Use FIXME for critical issues, TODO for enhancements
- Focus on improvements, not just criticism
- Don't rewrite the code, just add comments
- Priority: FIXME > TODO

**Example comments:**
\`\`\`javascript
// FIXME: This will crash when user is null - add null check
// FIXME: SQL injection vulnerability - use parameterized query
// FIXME: Race condition possible - add mutex lock
// TODO: Add validation for empty email
// TODO: Handle error case when API fails
// TODO: Add unit test for edge case with negative numbers
// TODO: Consider caching this expensive operation
// TODO: Extract this logic into a separate function for reusability
\`\`\`

Begin your review now and add TODO/FIXME comments to the code!`;

  try {
    const promptFile = path.join(__dirname, '..', `task-${taskId}-codex-review-prompt.txt`);
    fs.writeFileSync(promptFile, prompt);

    console.log(forky.info(`${colors.bright}Codex${colors.reset} starting code review...`));

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

      console.log(forky.success(`${colors.bright}Codex${colors.reset} completed code review for ${colors.bright}${branch}${colors.reset}`));

      // Cleanup files
      fs.unlinkSync(promptFile);
      fs.unlinkSync(inputFile);

      // Check if Codex made any changes and auto-commit/push them
      console.log(forky.info('Checking for uncommitted changes from Codex review...'));

      try {
        const { stdout: statusOutput } = await execAsync(`cd "${repoPath}" && git status --porcelain`, {
          env: cleanEnv
        });

        if (statusOutput.trim()) {
          console.log(forky.info('Codex made changes. Committing and pushing...'));

          // Commit and push the changes
          await execAsync(
            `cd "${repoPath}" && git add . && git commit -m "review: Add TODO/FIXME comments from Codex review (#${taskId})" && git push origin ${branch}`,
            {
              env: cleanEnv,
              timeout: 60000 // 1 minute timeout for git operations
            }
          );

          console.log(forky.success('Codex review changes committed and pushed'));
        } else {
          console.log(forky.info('No changes to commit from Codex review'));
        }
      } catch (gitError) {
        const err = gitError as Error;
        console.log(forky.warning(`Failed to auto-commit Codex changes: ${err.message}`));
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
      console.log(forky.error(`${colors.bright}Codex${colors.reset} review execution failed: ${err.message}`));

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
    console.log(forky.error(`Codex review failed: ${err.message}`));
    return { success: false, error: err.message };
  }
}

export {
  ensureCodexSettings,
  reviewClaudeChanges,
  // Removed unused: launchCodex, execWithPTY
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
