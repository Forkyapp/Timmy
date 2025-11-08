const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { jarvis, colors } = require('./ui');

const execAsync = promisify(exec);

/**
 * Check if a process is running
 * @param {number} pid - Process ID
 * @returns {Promise<boolean>} True if running
 */
async function isProcessRunning(pid) {
  if (!pid) return false;

  try {
    // Check if process exists
    await execAsync(`ps -p ${pid}`, { timeout: 2000 });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Read progress file
 * @param {string} taskId - Task ID
 * @param {string} agent - Agent name (gemini, claude, codex)
 * @returns {object|null} Progress data or null
 */
function readProgress(taskId, agent) {
  const progressFile = path.join(__dirname, '..', 'progress', `${taskId}-${agent}.json`);

  if (!fs.existsSync(progressFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(progressFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Read last N lines from log file
 * @param {string} logFile - Path to log file
 * @param {number} lines - Number of lines to read
 * @returns {Promise<string[]>} Array of log lines
 */
async function tailLogFile(logFile, lines = 5) {
  if (!fs.existsSync(logFile)) {
    return [];
  }

  try {
    const { stdout } = await execAsync(`tail -n ${lines} "${logFile}"`, { timeout: 2000 });
    return stdout.trim().split('\n').filter(line => line.trim());
  } catch (error) {
    return [];
  }
}

/**
 * Get status of an agent
 * @param {string} taskId - Task ID
 * @param {string} agent - Agent name (gemini, claude, codex)
 * @param {string|null} pidFile - Path to PID file
 * @param {string|null} logFile - Path to log file
 * @returns {Promise<object>} Status object
 */
async function getAgentStatus(taskId, agent, pidFile, logFile) {
  const status = {
    agent,
    taskId,
    running: false,
    pid: null,
    progress: null,
    lastLogs: [],
    error: null
  };

  // Read PID
  if (pidFile && fs.existsSync(pidFile)) {
    try {
      status.pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
      status.running = await isProcessRunning(status.pid);
    } catch (error) {
      status.error = 'Failed to read PID file';
    }
  }

  // Read progress
  status.progress = readProgress(taskId, agent);

  // Read last log lines
  if (logFile) {
    status.lastLogs = await tailLogFile(logFile, 3);
  }

  return status;
}

/**
 * Format progress bar
 * @param {number} completed - Completed steps
 * @param {number} total - Total steps
 * @param {number} width - Bar width (default 16)
 * @returns {string} Progress bar string
 */
function formatProgressBar(completed, total, width = 16) {
  if (!total || total === 0) return '░'.repeat(width);

  const percentage = Math.min(100, Math.max(0, (completed / total) * 100));
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${Math.round(percentage)}%`;
}

/**
 * Format time duration
 * @param {string} startTime - ISO timestamp
 * @returns {string} Formatted duration
 */
function formatDuration(startTime) {
  const start = new Date(startTime);
  const now = new Date();
  const diff = now - start;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Display agent status in console
 * @param {object} status - Status object from getAgentStatus
 */
function displayAgentStatus(status) {
  const { agent, taskId, running, pid, progress, lastLogs } = status;

  // Agent name with color
  const agentName = agent.charAt(0).toUpperCase() + agent.slice(1);
  const agentColor = agent === 'gemini' ? colors.cyan : agent === 'claude' ? colors.blue : colors.magenta;

  console.log(`\n${'━'.repeat(60)}`);
  console.log(`${agentColor}${agentName}${colors.reset} ${colors.bright}${taskId}${colors.reset}`);

  // Status
  if (running) {
    console.log(`${colors.green}●${colors.reset} Running ${pid ? `(PID: ${pid})` : ''}`);
  } else if (pid) {
    console.log(`${colors.red}●${colors.reset} Stopped ${pid ? `(PID: ${pid})` : ''}`);
  } else {
    console.log(`${colors.yellow}●${colors.reset} Starting...`);
  }

  // Progress
  if (progress) {
    const { currentStep, completedSteps, totalSteps, lastUpdate } = progress;

    console.log(`\n📝 ${currentStep}`);

    if (totalSteps) {
      console.log(`📊 ${formatProgressBar(completedSteps, totalSteps)}`);
    }

    if (lastUpdate) {
      console.log(`⏱️  ${formatDuration(lastUpdate)}`);
    }
  }

  // Recent logs
  if (lastLogs && lastLogs.length > 0) {
    console.log(`\n📋 Recent activity:`);
    lastLogs.forEach(line => {
      const truncated = line.length > 80 ? line.substring(0, 77) + '...' : line;
      console.log(`   ${colors.dim}${truncated}${colors.reset}`);
    });
  }

  console.log(`${'━'.repeat(60)}`);
}

/**
 * Monitor all active agents for a task
 * @param {string} taskId - Task ID
 * @param {object} agentInfo - Info about running agents {agent: {pidFile, logFile}}
 */
async function monitorTask(taskId, agentInfo) {
  const statuses = [];

  for (const [agent, info] of Object.entries(agentInfo)) {
    const status = await getAgentStatus(taskId, agent, info.pidFile, info.logFile);
    statuses.push(status);
    displayAgentStatus(status);
  }

  return statuses;
}

module.exports = {
  isProcessRunning,
  readProgress,
  tailLogFile,
  getAgentStatus,
  formatProgressBar,
  formatDuration,
  displayAgentStatus,
  monitorTask
};
