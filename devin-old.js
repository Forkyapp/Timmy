require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Colors
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Backgrounds
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
  bgCyan: '\x1b[46m',
};

const jarvis = {
  header: (text) => `${colors.bright}${colors.cyan}╔${'═'.repeat(text.length + 2)}╗\n║ ${text} ║\n╚${'═'.repeat(text.length + 2)}╝${colors.reset}`,
  box: (text) => `${colors.cyan}┌${'─'.repeat(text.length + 2)}┐\n│ ${text} │\n└${'─'.repeat(text.length + 2)}┘${colors.reset}`,
  success: (text) => `${colors.bright}${colors.green}✓${colors.reset} ${colors.green}${text}${colors.reset}`,
  error: (text) => `${colors.bright}${colors.red}✗${colors.reset} ${colors.red}${text}${colors.reset}`,
  warning: (text) => `${colors.bright}${colors.yellow}⚠${colors.reset} ${colors.yellow}${text}${colors.reset}`,
  info: (text) => `${colors.cyan}ℹ${colors.reset} ${colors.white}${text}${colors.reset}`,
  processing: (text) => `${colors.bright}${colors.blue}⚡${colors.reset} ${colors.blue}${text}${colors.reset}`,
  ai: (text) => `${colors.bright}${colors.magenta}🤖 JARVIS${colors.reset} ${colors.gray}»${colors.reset} ${colors.white}${text}${colors.reset}`,
  step: (num, text) => `${colors.bright}${colors.cyan}[${num}]${colors.reset} ${colors.white}${text}${colors.reset}`,
  divider: () => `${colors.dim}${colors.gray}${'─'.repeat(70)}${colors.reset}`,
  label: (key, value) => `${colors.dim}${key}:${colors.reset} ${colors.bright}${colors.white}${value}${colors.reset}`,
  timestamp: () => {
    const now = new Date();
    return `${colors.gray}[${now.toLocaleTimeString()}]${colors.reset}`;
  }
};

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
const CLICKUP_BOT_USER_ID = parseInt(process.env.CLICKUP_BOT_USER_ID || '0');
const CLICKUP_WORKSPACE_ID = process.env.CLICKUP_WORKSPACE_ID || '90181842045';
const GITHUB_REPO_PATH = process.env.GITHUB_REPO_PATH;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '15000');
const CODEX_CLI_PATH = process.env.CODEX_CLI_PATH || 'codex';

const CACHE_FILE = path.join(__dirname, 'processed-tasks.json');
let processedTasksData = [];
let processedTaskIds = new Set();

function loadProcessedTasks() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (data.length > 0 && typeof data[0] === 'string') {
        return data.map(id => ({ id, title: 'Unknown', description: '', detectedAt: new Date().toISOString() }));
      }
      return data;
    }
  } catch (error) {
    console.error('Error loading cache:', error.message);
  }
  return [];
}

function saveProcessedTasks() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(processedTasksData, null, 2));
  } catch (error) {
    console.error('Error saving cache:', error.message);
  }
}

function addToProcessed(task) {
  if (!processedTaskIds.has(task.id)) {
    processedTasksData.push({
      id: task.id,
      title: task.name,
      description: task.description || task.text_content || '',
      detectedAt: new Date().toISOString()
    });
    processedTaskIds.add(task.id);
    saveProcessedTasks();
  }
}

async function getAssignedTasks() {
  try {
    const response = await axios.get(
      `https://api.clickup.com/api/v2/team/${CLICKUP_WORKSPACE_ID}/task`,
      {
        headers: {
          'Authorization': CLICKUP_API_KEY,
          'Content-Type': 'application/json'
        },
        params: {
          assignees: [CLICKUP_BOT_USER_ID],
          subtasks: false,
          order_by: 'updated',
          reverse: true
        }
      }
    );

    const allTasks = response.data.tasks || [];
    const filteredTasks = allTasks.filter(task => task.status?.status === 'bot in progress');

    if (filteredTasks.length > 0) {
      console.log(`${jarvis.timestamp()} ${jarvis.processing(`Scanning workspace... Found ${colors.bright}${allTasks.length}${colors.reset} total tasks, ${colors.bright}${colors.green}${filteredTasks.length}${colors.reset} ready for processing`)}`);
    }
    return filteredTasks;
  } catch (error) {
    console.log(jarvis.error(`Failed to fetch tasks: ${error.message}`));
    return [];
  }
}

async function updateTaskStatus(taskId, statusId) {
  try {
    await axios.put(
      `https://api.clickup.com/api/v2/task/${taskId}`,
      { status: statusId },
      {
        headers: {
          'Authorization': CLICKUP_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`${jarvis.timestamp()} ${jarvis.success(`Task status updated → ${colors.bright}${statusId}${colors.reset}`)}`);
  } catch (error) {
    console.log(jarvis.error(`Status update failed: ${error.message}`));
  }
}

async function addClickUpComment(taskId, commentText) {
  try {
    await axios.post(
      `https://api.clickup.com/api/v2/task/${taskId}/comment`,
      { comment_text: commentText },
      {
        headers: {
          'Authorization': CLICKUP_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`${jarvis.timestamp()} ${jarvis.success('Comment posted to ClickUp task')}`);
  } catch (error) {
    console.log(jarvis.error(`Comment posting failed: ${error.message}`));
  }
}

const QUEUE_FILE = path.join(__dirname, 'task-queue.json');

function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading queue:', error.message);
  }
  return { pending: [], completed: [] };
}

function saveQueue(queue) {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  } catch (error) {
    console.error('Error saving queue:', error.message);
  }
}

async function queueTask(task) {
  const taskId = task.id;
  const taskTitle = task.name;
  const taskDescription = task.description || task.text_content || 'No description provided';

  console.log('\n' + jarvis.divider());
  console.log(`${colors.bright}${colors.yellow}📥 QUEUING TASK${colors.reset}`);
  console.log(jarvis.label('  ID', taskId));
  console.log(jarvis.label('  Title', taskTitle));
  console.log(jarvis.divider());

  // Load current queue
  const queue = loadQueue();

  // Check if already queued
  if (queue.pending.find(t => t.id === taskId)) {
    console.log(jarvis.warning(`Task ${taskId} already exists in queue`));
    console.log(jarvis.divider() + '\n');
    return { alreadyQueued: true };
  }

  // Add to queue
  queue.pending.push({
    id: taskId,
    title: taskTitle,
    description: taskDescription,
    url: task.url,
    queuedAt: new Date().toISOString(),
    repoPath: GITHUB_REPO_PATH,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: `task-${taskId}`,
    commitMessage: `feat: ${taskTitle} (#${taskId})`,
    prTitle: `[ClickUp #${taskId}] ${taskTitle}`,
    prBody: `## ClickUp Task\n\n**Task:** ${taskTitle}\n**ID:** ${taskId}\n**URL:** ${task.url}\n\n## Description\n\n${taskDescription}\n\n---\n\n🤖 Queued by Devin for Codex processing`
  });

  // Save queue
  saveQueue(queue);

  console.log(jarvis.success('Task added to processing queue'));
  console.log(jarvis.info(`Queue status: ${colors.bright}${queue.pending.length}${colors.reset} pending, ${colors.bright}${queue.completed.length}${colors.reset} completed`));
  console.log(jarvis.divider() + '\n');

  return { success: true };
}

const PR_TRACKING_FILE = path.join(__dirname, 'pr-tracking.json');
const PR_CHECK_INTERVAL_MS = 30000;
const PR_TIMEOUT_MS = 30 * 60 * 1000;

function loadPRTracking() {
  try {
    if (fs.existsSync(PR_TRACKING_FILE)) {
      return JSON.parse(fs.readFileSync(PR_TRACKING_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading PR tracking:', error.message);
  }
  return [];
}

function savePRTracking(tracking) {
  try {
    fs.writeFileSync(PR_TRACKING_FILE, JSON.stringify(tracking, null, 2));
  } catch (error) {
    console.error('Error saving PR tracking:', error.message);
  }
}

let prTracking = [];

function startPRTracking(task) {
  const tracking = {
    taskId: task.id,
    taskName: task.name,
    branch: `task-${task.id}`,
    startedAt: new Date().toISOString(),
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO
  };

  prTracking.push(tracking);
  savePRTracking(prTracking);

  console.log(jarvis.info(`Monitoring for PR creation on branch ${colors.bright}task-${task.id}${colors.reset}`));
}

async function checkForPR(tracking) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${tracking.owner}/${tracking.repo}/pulls`,
      {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        params: {
          head: `${tracking.owner}:${tracking.branch}`,
          state: 'all'
        }
      }
    );

    if (response.data && response.data.length > 0) {
      const pr = response.data[0];
      return {
        found: true,
        url: pr.html_url,
        number: pr.number,
        state: pr.state
      };
    }
  } catch (error) {
    console.error(`Error checking PR for ${tracking.taskId}:`, error.message);
  }

  return { found: false };
}

async function pollForPRs() {
  const now = new Date();

  for (let i = prTracking.length - 1; i >= 0; i--) {
    const tracking = prTracking[i];
    const startedAt = new Date(tracking.startedAt);
    const elapsed = now - startedAt;

    if (elapsed > PR_TIMEOUT_MS) {
      console.log('\n' + jarvis.divider());
      console.log(jarvis.warning(`Mission ${colors.bright}${tracking.taskId}${colors.reset} timeout`));
      console.log(jarvis.info('30 minute threshold exceeded'));
      console.log(jarvis.divider() + '\n');

      await addClickUpComment(
        tracking.taskId,
        `⚠️ **Timeout Warning**\n\n` +
        `No Pull Request detected after 30 minutes.\n\n` +
        `Check terminal for agent status.`
      );

      prTracking.splice(i, 1);
      savePRTracking(prTracking);
      continue;
    }

    const result = await checkForPR(tracking);

    if (result.found) {
      console.log('\n' + jarvis.divider());
      console.log(`${colors.bright}${colors.green}🎉 MISSION COMPLETE${colors.reset}`);
      console.log(jarvis.label('  Task', tracking.taskId));
      console.log(jarvis.label('  PR', `#${result.number}`));
      console.log(jarvis.label('  URL', result.url));
      console.log(jarvis.success('Ready for review'));
      console.log(jarvis.divider() + '\n');

      await addClickUpComment(
        tracking.taskId,
        `✅ **Pull Request Created**\n\n` +
        `**PR #${result.number}:** ${result.url}\n\n` +
        `Implementation complete and ready for review.`
      );

      await updateTaskStatus(tracking.taskId, 'can be checked');

      prTracking.splice(i, 1);
      savePRTracking(prTracking);
    }
  }
}

function ensureClaudeSettings() {
  const claudeDir = path.join(GITHUB_REPO_PATH, '.claude');
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

  console.log('\n' + jarvis.divider());
  console.log(jarvis.ai(`Deploying autonomous agent for task ${colors.bright}${taskId}${colors.reset}`));
  console.log(jarvis.info(`"${taskTitle}"`));
  console.log(jarvis.divider() + '\n');

  console.log(jarvis.processing('Configuring security protocols...'));
  ensureClaudeSettings();

  // Create comprehensive prompt
  const prompt = `I need you to implement a ClickUp task and create a GitHub Pull Request.

**ClickUp Task ID:** ${taskId}
**Title:** ${taskTitle}
**Description:**
${taskDescription}

**Repository Information:**
- Path: ${GITHUB_REPO_PATH}
- Owner: ${GITHUB_OWNER}
- Repo: ${GITHUB_REPO}

**Required Steps (MUST COMPLETE ALL):**

1. **Navigate to repository:**
   cd ${GITHUB_REPO_PATH}

2. **Check git status:**
   git status
   (Ensure working tree is clean)

3. **Create new branch:**
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
    console.log(jarvis.processing('Preparing task briefing...'));
    const promptFile = path.join(__dirname, `task-${taskId}-prompt.txt`);
    const scriptFile = path.join(__dirname, `task-${taskId}-launch.sh`);

    fs.writeFileSync(promptFile, prompt);

    const bashScript = `#!/bin/bash
cd "${GITHUB_REPO_PATH}"
export PROMPT_FILE="${promptFile}"

# Launch Claude Code and pipe the prompt
(echo "y"; sleep 2; cat "$PROMPT_FILE") | claude --dangerously-skip-permissions

# Cleanup
rm -f "$PROMPT_FILE"
rm -f "${scriptFile}"
`;

    fs.writeFileSync(scriptFile, bashScript);
    fs.chmodSync(scriptFile, '755');

    console.log(jarvis.processing('Deploying background agent...'));

    const appleScript = `
tell application "Terminal"
    do script "${scriptFile}"
end tell
`;

    await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`);

    console.log('\n' + jarvis.divider());
    console.log(jarvis.success('Agent deployed successfully'));
    console.log(jarvis.ai(`Now executing task ${colors.bright}${taskId}${colors.reset} autonomously`));
    console.log(jarvis.info(`Branch: ${colors.bright}task-${taskId}${colors.reset}`));
    console.log(jarvis.divider() + '\n');

    await addClickUpComment(
      taskId,
      `🤖 **Agent Deployed**\n\n` +
      `Autonomous agent is now executing this task.\n\n` +
      `**Branch:** \`task-${taskId}\`\n` +
      `**Status:** Working autonomously\n\n` +
      `You'll be notified when the Pull Request is ready.`
    );

    startPRTracking(task);
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { success: true };

  } catch (error) {
    console.log('\n' + jarvis.divider());
    console.log(jarvis.error(`Agent deployment failed: ${error.message}`));
    console.log(jarvis.warning('Task queued for manual intervention'));
    console.log(jarvis.divider() + '\n');

    await queueTask(task);

    return { success: false, error: error.message };
  }
}

async function pollAndProcess() {
  try {
    const tasks = await getAssignedTasks();

    for (const task of tasks) {
      if (processedTaskIds.has(task.id)) continue;

      console.log('\n' + jarvis.divider());
      console.log(`${colors.bright}${colors.green}🎯 TARGET ACQUIRED${colors.reset}`);
      console.log(jarvis.label('  ID', task.id));
      console.log(jarvis.label('  Task', task.name));
      console.log(jarvis.divider());

      addToProcessed(task);

      try {
        const result = await launchCodex(task);

        if (result.success) {
          console.log(jarvis.ai(`Mission ${colors.bright}${task.id}${colors.reset} assigned to autonomous agent\n`));
        } else {
          console.log(jarvis.warning(`Mission ${colors.bright}${task.id}${colors.reset} requires manual intervention\n`));
        }

      } catch (error) {
        console.log(jarvis.error(`Task processing failed: ${error.message}`));
      }
    }

  } catch (error) {
    console.log(jarvis.error(`Polling error: ${error.message}`));
  }
}

// Only run if this file is executed directly (not imported for testing)
if (require.main === module) {
  // Initialize data on startup
  processedTasksData = loadProcessedTasks();
  processedTaskIds = new Set(processedTasksData.map(t => t.id));
  prTracking = loadPRTracking();

  console.clear();
  console.log('\n');
  console.log(jarvis.header('J.A.R.V.I.S - AUTONOMOUS TASK SYSTEM'));
  console.log('\n');
  console.log(jarvis.ai('Initializing neural networks...'));
  console.log('\n' + jarvis.divider());

  console.log(`\n${colors.bright}${colors.cyan}⚙️  CONFIGURATION${colors.reset}`);
  console.log(jarvis.label('  Workspace', CLICKUP_WORKSPACE_ID));
  console.log(jarvis.label('  Bot ID', CLICKUP_BOT_USER_ID));
  console.log(jarvis.label('  Repository', GITHUB_REPO_PATH));
  console.log(jarvis.label('  Scan Interval', `${POLL_INTERVAL_MS / 1000}s`));
  console.log(jarvis.label('  Cache Size', processedTasksData.length));

  const queue = loadQueue();
  console.log(jarvis.label('  Queue', `${queue.pending.length} pending / ${queue.completed.length} completed`));

  console.log('\n' + jarvis.divider());

  if (!GITHUB_REPO_PATH || !fs.existsSync(GITHUB_REPO_PATH)) {
    console.log('\n' + jarvis.error('Repository path not configured'));
    console.log(jarvis.error('Set GITHUB_REPO_PATH in .env file\n'));
    process.exit(1);
  }

  console.log('\n' + jarvis.success('Systems validated'));
  console.log(jarvis.processing('Configuring security protocols...'));
  ensureClaudeSettings();
  console.log(jarvis.success('Autonomous mode enabled'));

  console.log('\n' + jarvis.divider());
  console.log(`\n${colors.bright}${colors.green}🚀 ONLINE${colors.reset}`);
  console.log(jarvis.ai('Scanning workspace for mission-ready tasks...'));
  console.log(jarvis.info(`Active missions: ${colors.bright}${prTracking.length}${colors.reset}`));
  console.log('\n' + jarvis.divider() + '\n');

  pollAndProcess();
  setInterval(pollAndProcess, POLL_INTERVAL_MS);
  setInterval(pollForPRs, PR_CHECK_INTERVAL_MS);

  // Set up shutdown handlers
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

function gracefulShutdown() {
  console.log('\n\n' + jarvis.divider());
  console.log(jarvis.ai('Shutdown sequence initiated...'));
  console.log(jarvis.processing('Saving system state...'));
  saveProcessedTasks();
  savePRTracking(prTracking);
  console.log(jarvis.success('State preserved'));
  console.log(jarvis.ai('Going offline. Standby mode activated.'));
  console.log(jarvis.divider() + '\n');
  process.exit(0);
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadProcessedTasks,
    saveProcessedTasks,
    addToProcessed,
    getAssignedTasks,
    updateTaskStatus,
    addClickUpComment,
    loadQueue,
    saveQueue,
    queueTask,
    loadPRTracking,
    savePRTracking,
    startPRTracking,
    checkForPR,
    pollForPRs,
    ensureClaudeSettings,
    launchCodex,
    pollAndProcess,
    get processedTasksData() { return processedTasksData; },
    set processedTasksData(val) { processedTasksData = val; },
    get processedTaskIds() { return processedTaskIds; },
    set processedTaskIds(val) { processedTaskIds = val; },
    get prTracking() { return prTracking; },
    set prTracking(val) { prTracking = val; },
    CACHE_FILE,
    QUEUE_FILE,
    PR_TRACKING_FILE
  };
}
