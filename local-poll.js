require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ============================================
// CONFIGURATION
// ============================================

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
const CLICKUP_BOT_USER_ID = parseInt(process.env.CLICKUP_BOT_USER_ID || '0');
const CLICKUP_WORKSPACE_ID = process.env.CLICKUP_WORKSPACE_ID || '90181842045';
const GITHUB_REPO_PATH = process.env.GITHUB_REPO_PATH || '/Users/user/Documents/Personal Projects/collabifi-back';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '60000'); // 1 minute default

// Task queue file
const TASK_QUEUE_FILE = path.join(__dirname, 'task-queue.json');

// Track processed tasks
const processedTasks = new Set();

// ============================================
// TASK QUEUE MANAGEMENT
// ============================================

function loadTaskQueue() {
  try {
    if (fs.existsSync(TASK_QUEUE_FILE)) {
      const data = fs.readFileSync(TASK_QUEUE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading task queue:', error.message);
  }
  return { pending: [], inProgress: [], completed: [] };
}

function saveTaskQueue(queue) {
  try {
    fs.writeFileSync(TASK_QUEUE_FILE, JSON.stringify(queue, null, 2));
  } catch (error) {
    console.error('Error saving task queue:', error.message);
  }
}

// ============================================
// CLICKUP API
// ============================================

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

    console.log(`[${new Date().toISOString()}] Found ${allTasks.length} total tasks, ${filteredTasks.length} with status 'bot in progress'`);
    return filteredTasks;
  } catch (error) {
    console.error('Error fetching tasks:', error.message);
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
    console.log(`Updated task ${taskId} status to ${statusId}`);
  } catch (error) {
    console.error(`Error updating task status:`, error.message);
  }
}

// ============================================
// CLAUDE CODE INTEGRATION
// ============================================

function invokeClaude(task) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🤖 INVOKING CLAUDE CODE FOR TASK: ${task.name}`);
    console.log(`${'='.repeat(60)}\n`);

    const prompt = `I need you to implement a feature from ClickUp.

**ClickUp Task ID:** ${task.id}
**Title:** ${task.name}
**Description:**
${task.description || task.text_content || 'No description provided'}

**Instructions:**
1. Change directory to: ${GITHUB_REPO_PATH}
2. Create a new branch: task-${task.id}
3. Implement the feature described above
4. Commit your changes with message: "feat: ${task.name} (#${task.id})"
5. Push the branch to GitHub
6. Create a Pull Request with title: "[ClickUp #${task.id}] ${task.name}"

After you're done, respond with "TASK_COMPLETE" so I know to update ClickUp.`;

    // Create a prompt file that can be manually copied if needed
    const promptFile = path.join(__dirname, `task-${task.id}-prompt.txt`);
    fs.writeFileSync(promptFile, prompt);
    console.log(`📝 Prompt saved to: ${promptFile}\n`);

    // Try to spawn Claude Code CLI
    // Note: Adjust the command based on how Claude Code is installed
    // Options: 'claude', 'claude-code', or the full path
    const claude = spawn('claude', [], {
      cwd: GITHUB_REPO_PATH,
      stdio: ['pipe', 'inherit', 'inherit']
    });

    claude.stdin.write(prompt + '\n');

    claude.on('error', (error) => {
      console.error(`\n❌ Could not spawn Claude Code automatically: ${error.message}`);
      console.log(`\n📋 MANUAL ACTION REQUIRED:`);
      console.log(`1. Open Claude Code in: ${GITHUB_REPO_PATH}`);
      console.log(`2. Copy and paste the prompt from: ${promptFile}`);
      console.log(`3. After completing the task, run: node mark-task-complete.js ${task.id}\n`);

      // Save task to pending queue for manual processing
      const queue = loadTaskQueue();
      queue.pending.push({
        taskId: task.id,
        taskName: task.name,
        promptFile: promptFile,
        addedAt: new Date().toISOString()
      });
      saveTaskQueue(queue);

      reject(error);
    });

    claude.on('close', (code) => {
      console.log(`\n✅ Claude Code session ended (exit code: ${code})`);

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Claude Code exited with code ${code}`));
      }
    });
  });
}

// ============================================
// MAIN POLLING LOOP
// ============================================

async function pollAndProcess() {
  try {
    const tasks = await getAssignedTasks();
    const queue = loadTaskQueue();

    for (const task of tasks) {
      // Skip if already processed or in queue
      if (processedTasks.has(task.id)) {
        continue;
      }

      // Check if already in queue
      const inQueue = queue.pending.some(t => t.taskId === task.id) ||
                     queue.inProgress.some(t => t.taskId === task.id);

      if (inQueue) {
        continue;
      }

      console.log(`\n🆕 NEW TASK DETECTED: ${task.id} - ${task.name}`);

      // Add to in-progress queue
      queue.inProgress.push({
        taskId: task.id,
        taskName: task.name,
        startedAt: new Date().toISOString(),
        task: task
      });
      saveTaskQueue(queue);

      try {
        // Invoke Claude Code
        await invokeClaude(task);

        // If successful, update ClickUp status to "can be checked"
        const canBeCheckedStatus = 'p90070039602_8Mqcg4pn';
        await updateTaskStatus(task.id, canBeCheckedStatus);

        // Move to completed
        queue.inProgress = queue.inProgress.filter(t => t.taskId !== task.id);
        queue.completed.push({
          taskId: task.id,
          taskName: task.name,
          completedAt: new Date().toISOString()
        });
        saveTaskQueue(queue);

        processedTasks.add(task.id);
        console.log(`✅ Task ${task.id} completed and moved to "can be checked"\n`);

      } catch (error) {
        console.error(`❌ Error processing task ${task.id}:`, error.message);
        // Keep in pending for manual processing
        queue.inProgress = queue.inProgress.filter(t => t.taskId !== task.id);
        queue.pending.push({
          taskId: task.id,
          taskName: task.name,
          error: error.message,
          addedAt: new Date().toISOString()
        });
        saveTaskQueue(queue);
      }
    }

  } catch (error) {
    console.error('Error in polling loop:', error.message);
  }
}

// ============================================
// START POLLING
// ============================================

console.log('🚀 Starting local ClickUp polling...');
console.log(`📍 Workspace: ${CLICKUP_WORKSPACE_ID}`);
console.log(`👤 Bot User ID: ${CLICKUP_BOT_USER_ID}`);
console.log(`📁 GitHub Repo: ${GITHUB_REPO_PATH}`);
console.log(`⏱️  Poll Interval: ${POLL_INTERVAL_MS / 1000}s\n`);

// Initial poll
pollAndProcess();

// Set up interval
setInterval(pollAndProcess, POLL_INTERVAL_MS);

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping polling...');
  process.exit(0);
});
