require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
const TASK_QUEUE_FILE = path.join(__dirname, 'task-queue.json');

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
    console.log(`✅ Updated task ${taskId} status to ${statusId}`);
  } catch (error) {
    console.error(`❌ Error updating task status:`, error.message);
  }
}

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

async function markTaskComplete(taskId) {
  console.log(`\n📝 Marking task ${taskId} as complete...`);

  const queue = loadTaskQueue();

  // Remove from pending/inProgress
  const taskInPending = queue.pending.find(t => t.taskId === taskId);
  const taskInProgress = queue.inProgress.find(t => t.taskId === taskId);

  if (!taskInPending && !taskInProgress) {
    console.log(`❌ Task ${taskId} not found in queue`);
    return;
  }

  queue.pending = queue.pending.filter(t => t.taskId !== taskId);
  queue.inProgress = queue.inProgress.filter(t => t.taskId !== taskId);

  // Add to completed
  queue.completed.push({
    taskId: taskId,
    taskName: (taskInPending || taskInProgress).taskName,
    completedAt: new Date().toISOString()
  });

  saveTaskQueue(queue);

  // Update ClickUp status to "can be checked"
  const canBeCheckedStatus = 'p90070039602_8Mqcg4pn';
  await updateTaskStatus(taskId, canBeCheckedStatus);

  console.log(`✅ Task ${taskId} marked as complete!\n`);
}

// Get task ID from command line
const taskId = process.argv[2];

if (!taskId) {
  console.error('❌ Usage: node mark-task-complete.js <taskId>');
  process.exit(1);
}

markTaskComplete(taskId);
