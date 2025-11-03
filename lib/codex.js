const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const config = require('./config');
const { jarvis, colors } = require('./ui');
const clickup = require('./clickup');
const tracking = require('./tracking');
const queue = require('./queue');

const execAsync = promisify(exec);

function ensureCodexSettings() {
  const codexDir = path.join(config.github.repoPath, '.claude');
  const settingsFile = path.join(codexDir, 'settings.json');

  if (!fs.existsSync(codexDir)) {
    fs.mkdirSync(codexDir, { recursive: true });
  }
  const settings = {
    "permissions": {
      "allow": [
        "Bash(*)",
        "Read(*)",
        "Write(*)",
        "Edit(*)",
        "Glob(*)",
        "Grep(*)",
        "Task(*)",
        "WebFetch(*)",
        "WebSearch(*)",
        "NotebookEdit(*)",
        "mcp__*",
        "*"
      ],
      "deny": []
    },
    "hooks": {
      "user-prompt-submit": "echo 'yes'"
    }
  };

  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

async function launchCodex(task, options = {}) {
  const taskId = task.id;
  const taskTitle = task.name;
  const taskDescription = task.description || task.text_content || 'No description provided';
  const { analysis, subtask, branch } = options;

  console.log(jarvis.ai(`Deploying Codex agent for ${colors.bright}${taskId}${colors.reset}: "${taskTitle}"`));
  ensureCodexSettings();

  // Build prompt with optional Gemini analysis
  let analysisSection = '';
  if (analysis && analysis.content) {
    analysisSection = `

**GEMINI AI ANALYSIS:**
This task has been pre-analyzed by Gemini AI. Please review the analysis below for implementation guidance:

---
${analysis.content}
---

Use this analysis to guide your implementation. Follow the suggested approach and implementation steps.
`;
  }

  const prompt = `I need you to implement a ClickUp task and create a GitHub Pull Request.

**ClickUp Task ID:** ${taskId}
**Title:** ${taskTitle}
**Description:**
${taskDescription}
${analysisSection}

**Repository Information:**
- Path: ${config.github.repoPath}
- Owner: ${config.github.owner}
- Repo: ${config.github.repo}

**Required Steps (MUST COMPLETE ALL):**

1. **Navigate to repository:**
   cd ${config.github.repoPath}

2. **Update main branch:**
   git checkout main
   git pull origin main
   (Ensure we have latest changes)

3. **Create new branch from main:**
   git checkout -b task-${taskId}

4. **Implement the feature:**
   - Read the description carefully
   - Make all necessary code changes
   - Follow existing code style and patterns

5. **Test your changes:**
   - Run any relevant tests
   - Verify the implementation works

6. **Commit your changes:**
   git add .
   git commit -m "feat: ${taskTitle} (#${taskId})"

7. **Push to GitHub:**
   git push -u origin task-${taskId}

8. **Create Pull Request:**
   Use gh CLI to create PR (non-interactive):
   gh pr create --title "[ClickUp #${taskId}] ${taskTitle}" --body "## ClickUp Task

**Task:** ${taskTitle}
**ID:** ${taskId}
**URL:** ${task.url || `https://app.clickup.com/t/${taskId}`}

## Description
${taskDescription}

## Implementation
[Brief summary of what you implemented]

---
🤖 Automated via Devin (Codex)" --base main --head task-${taskId}

**CRITICAL:**
- You MUST create the Pull Request at the end
- Do NOT skip the PR creation step
- After PR is created, respond with the PR URL

**Important Instructions:**
- Work AUTONOMOUSLY - make reasonable decisions
- Follow the repository's existing code style and patterns
- If you encounter minor issues, resolve them independently
- Install new packages without asking
- Use any git commands you need to complete the task
- MUST complete ALL steps including PR creation

**ClickUp Task URL:** ${task.url || `https://app.clickup.com/t/${taskId}`}

Begin implementation now and make sure to create the PR when done!`;

  try {
    const promptFile = path.join(__dirname, '..', `task-${taskId}-codex-prompt.txt`);
    const scriptFile = path.join(__dirname, '..', `task-${taskId}-codex-launch.sh`);

    fs.writeFileSync(promptFile, prompt);

    const bashScript = `#!/bin/bash
      cd "${config.github.repoPath}"
      export PROMPT_FILE="${promptFile}"

      # Launch Codex in fully autonomous mode
      (echo "y"; sleep 2; cat "$PROMPT_FILE") | codex --yolo --sandbox danger-full-access

      # Cleanup
      rm -f "$PROMPT_FILE"
      rm -f "${scriptFile}"
`;

    fs.writeFileSync(scriptFile, bashScript);
    fs.chmodSync(scriptFile, '755');

    const appleScript = `
    tell application "Terminal"
        do script "${scriptFile}"
    end tell
`;

    await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`);

    console.log(jarvis.success(`Codex agent active on ${colors.bright}task-${taskId}${colors.reset}`));

    await clickup.addComment(
      taskId,
      `🤖 **Codex Agent Deployed**\n\n` +
      `Codex autonomous agent is now executing this task.\n\n` +
      `**Branch:** \`task-${taskId}\`\n` +
      `**Status:** Working autonomously\n\n` +
      `You'll be notified when the Pull Request is ready.`
    );

    tracking.startPRTracking(task);
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { success: true };

  } catch (error) {
    console.log(jarvis.error(`Codex deployment failed: ${error.message}`));
    console.log(jarvis.info('Task queued for manual processing'));

    await queue.queueTask(task);

    return { success: false, error: error.message };
  }
}

async function reviewClaudeChanges(task, options = {}) {
  const taskId = task.id;
  const taskTitle = task.name;
  const branch = `task-${taskId}`;

  console.log(jarvis.ai(`Codex reviewing Claude's changes for ${colors.bright}${taskId}${colors.reset}`));
  ensureCodexSettings();

  const prompt = `You are a senior code reviewer. Your job is to review the changes made by Claude and add constructive TODO comments for improvements.

**ClickUp Task ID:** ${taskId}
**Title:** ${taskTitle}
**Branch:** ${branch}

**Repository Information:**
- Path: ${config.github.repoPath}
- Owner: ${config.github.owner}
- Repo: ${config.github.repo}

**Your Review Process:**

1. **Checkout the branch:**
   cd ${config.github.repoPath}
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

3. **Add TODO comments DIRECTLY in the code files:**
   - Open each modified file
   - Add clear, actionable TODO comments where improvements are needed
   - Format: \`// TODO: [Your improvement suggestion]\`
   - Be specific and constructive
   - Focus on:
     * Edge cases not handled
     * Error handling improvements
     * Performance optimizations
     * Code clarity improvements
     * Missing validation
     * Potential bugs

4. **Commit your TODO comments:**
   git add .
   git commit -m "review: Add TODO comments from Codex review (#${taskId})"
   git push origin ${branch}

**Important Guidelines:**
- Add TODO comments INLINE in the code files (not in separate review files)
- Be constructive and specific
- Each TODO should be actionable
- Focus on improvements, not just criticism
- Don't rewrite the code, just add TODO comments
- Typical format: \`// TODO: Handle null case when user is not authenticated\`

**Example TODO comments:**
\`\`\`javascript
// TODO: Add validation for empty email
// TODO: Handle error case when API fails
// TODO: Add unit test for edge case with negative numbers
// TODO: Consider caching this expensive operation
// TODO: Extract this logic into a separate function for reusability
\`\`\`

Begin your review now and add TODO comments to the code!`;

  try {
    const promptFile = path.join(__dirname, '..', `task-${taskId}-codex-review-prompt.txt`);
    const scriptFile = path.join(__dirname, '..', `task-${taskId}-codex-review.sh`);

    fs.writeFileSync(promptFile, prompt);

    const bashScript = `#!/bin/bash
      cd "${config.github.repoPath}"
      export PROMPT_FILE="${promptFile}"

      # Launch Codex for review in fully autonomous mode
      (echo "y"; sleep 2; cat "$PROMPT_FILE") | codex --yolo --sandbox danger-full-access

      # Cleanup
      rm -f "$PROMPT_FILE"
      rm -f "${scriptFile}"
`;

    fs.writeFileSync(scriptFile, bashScript);
    fs.chmodSync(scriptFile, '755');

    const appleScript = `
    tell application "Terminal"
        do script "${scriptFile}"
    end tell
`;

    await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`);

    console.log(jarvis.success(`Codex review started for ${colors.bright}${branch}${colors.reset}`));

    await clickup.addComment(
      taskId,
      `👀 **Codex Code Review Started**\n\n` +
      `Codex is reviewing Claude's implementation and adding TODO comments for improvements.\n\n` +
      `**Branch:** \`${branch}\`\n` +
      `**Next Step:** Claude will address the TODO comments`
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    return { success: true, branch };

  } catch (error) {
    console.log(jarvis.error(`Codex review failed: ${error.message}`));

    return { success: false, error: error.message };
  }
}

module.exports = {
  ensureCodexSettings,
  launchCodex,
  reviewClaudeChanges,
};
