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

function ensureClaudeSettings() {
  const claudeDir = path.join(config.github.repoPath, '.claude');
  const settingsFile = path.join(claudeDir, 'settings.json');

  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
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

async function launchCodex(task) {
  const taskId = task.id;
  const taskTitle = task.name;
  const taskDescription = task.description || task.text_content || 'No description provided';

  console.log(jarvis.ai(`Deploying agent for ${colors.bright}${taskId}${colors.reset}: "${taskTitle}"`));
  ensureClaudeSettings();

  const prompt = `I need you to implement a ClickUp task and create a GitHub Pull Request.

**ClickUp Task ID:** ${taskId}
**Title:** ${taskTitle}
**Description:**
${taskDescription}

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
🤖 Automated via Devin" --base main --head task-${taskId}

**CRITICAL:**
- You MUST create the Pull Request at the end
- Do NOT skip the PR creation step
- After PR is created, respond with the PR URL

**Important Instructions:**
- Work AUTONOMOUSLY - make reasonable decisions
- Follow the repository's existing code style and patterns
- If you encounter minor issues, resolve them independently
- Install new packages without asking
- Use claude --dangerously-skip-permissions to bypass security prompts
- Use any git commands you need to complete the task
- MUST complete ALL steps including PR creation

**ClickUp Task URL:** ${task.url || `https://app.clickup.com/t/${taskId}`}

Begin implementation now and make sure to create the PR when done!`;

  try {
    const promptFile = path.join(__dirname, '..', `task-${taskId}-prompt.txt`);
    const scriptFile = path.join(__dirname, '..', `task-${taskId}-launch.sh`);

    fs.writeFileSync(promptFile, prompt);

    const bashScript = `#!/bin/bash
      cd "${config.github.repoPath}"
      export PROMPT_FILE="${promptFile}"

      # Launch Claude Code and pipe the prompt
      (echo "y"; sleep 2; cat "$PROMPT_FILE") | claude --dangerously-skip-permissions

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

    console.log(jarvis.success(`Agent active on ${colors.bright}task-${taskId}${colors.reset}`));

    await clickup.addComment(
      taskId,
      `🤖 **Agent Deployed**\n\n` +
      `Autonomous agent is now executing this task.\n\n` +
      `**Branch:** \`task-${taskId}\`\n` +
      `**Status:** Working autonomously\n\n` +
      `You'll be notified when the Pull Request is ready.`
    );

    tracking.startPRTracking(task);
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { success: true };

  } catch (error) {
    console.log(jarvis.error(`Deployment failed: ${error.message}`));
    console.log(jarvis.info('Task queued for manual processing'));

    await queue.queueTask(task);

    return { success: false, error: error.message };
  }
}

module.exports = {
  ensureClaudeSettings,
  launchCodex,
};
