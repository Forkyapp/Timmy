const fs = require('fs');
const config = require('./config');
const { jarvis, colors } = require('./ui');

function loadQueue() {
  try {
    if (fs.existsSync(config.files.queueFile)) {
      return JSON.parse(fs.readFileSync(config.files.queueFile, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading queue:', error.message);
  }
  return { pending: [], completed: [] };
}

function saveQueue(queue) {
  try {
    fs.writeFileSync(config.files.queueFile, JSON.stringify(queue, null, 2));
  } catch (error) {
    console.error('Error saving queue:', error.message);
  }
}

async function queueTask(task) {
  const taskId = task.id;
  const taskTitle = task.name;
  const taskDescription = task.description || task.text_content || 'No description provided';

  const queue = loadQueue();

  if (queue.pending.find(t => t.id === taskId)) {
    console.log(jarvis.warning(`Task ${taskId} already queued`));
    return { alreadyQueued: true };
  }

  console.log(jarvis.info(`Queued task ${colors.bright}${taskId}${colors.reset}`))

  queue.pending.push({
    id: taskId,
    title: taskTitle,
    description: taskDescription,
    url: task.url,
    queuedAt: new Date().toISOString(),
    repoPath: config.github.repoPath,
    owner: config.github.owner,
    repo: config.github.repo,
    branch: `task-${taskId}`,
    commitMessage: `feat: ${taskTitle} (#${taskId})`,
    prTitle: `[ClickUp #${taskId}] ${taskTitle}`,
    prBody: `## ClickUp Task\n\n**Task:** ${taskTitle}\n**ID:** ${taskId}\n**URL:** ${task.url}\n\n## Description\n\n${taskDescription}\n\n---\n\n🤖 Queued by Devin for Codex processing`
  });

  saveQueue(queue);
  return { success: true };
}

module.exports = {
  loadQueue,
  saveQueue,
  queueTask,
};
