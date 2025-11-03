const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// In-memory process registry
const processes = new Map();

/**
 * Register a process
 */
function registerProcess(taskId, processInfo) {
  if (!processes.has(taskId)) {
    processes.set(taskId, []);
  }

  const entry = {
    ...processInfo,
    registeredAt: new Date().toISOString(),
    status: 'running'
  };

  processes.get(taskId).push(entry);

  return entry;
}

/**
 * Get all processes for a task
 */
function getProcesses(taskId) {
  return processes.get(taskId) || [];
}

/**
 * Check if a process is running (macOS)
 */
async function isProcessRunning(pid) {
  try {
    const { stdout } = await execAsync(`ps -p ${pid}`);
    return stdout.includes(String(pid));
  } catch (error) {
    return false;
  }
}

/**
 * Kill a process
 */
async function killProcess(pid) {
  try {
    await execAsync(`kill ${pid}`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for a process to complete
 */
async function waitForProcess(pid, timeoutMs = 30 * 60 * 1000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const running = await isProcessRunning(pid);

    if (!running) {
      return { completed: true, timedOut: false };
    }

    // Check every 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return { completed: false, timedOut: true };
}

/**
 * Wait for all processes of a task to complete
 */
async function waitForAllProcesses(taskId, timeoutMs = 30 * 60 * 1000) {
  const taskProcesses = getProcesses(taskId);

  if (taskProcesses.length === 0) {
    return { allCompleted: true, results: [] };
  }

  const results = await Promise.all(
    taskProcesses.map(async (proc) => {
      if (!proc.pid) {
        return { process: proc, completed: true, timedOut: false };
      }

      const result = await waitForProcess(proc.pid, timeoutMs);

      return {
        process: proc,
        ...result
      };
    })
  );

  const allCompleted = results.every(r => r.completed);
  const anyTimedOut = results.some(r => r.timedOut);

  return {
    allCompleted,
    anyTimedOut,
    results
  };
}

/**
 * Mark process as completed
 */
function markCompleted(taskId, processIndex) {
  const taskProcesses = processes.get(taskId);

  if (taskProcesses && taskProcesses[processIndex]) {
    taskProcesses[processIndex].status = 'completed';
    taskProcesses[processIndex].completedAt = new Date().toISOString();
  }
}

/**
 * Mark process as failed
 */
function markFailed(taskId, processIndex, error) {
  const taskProcesses = processes.get(taskId);

  if (taskProcesses && taskProcesses[processIndex]) {
    taskProcesses[processIndex].status = 'failed';
    taskProcesses[processIndex].failedAt = new Date().toISOString();
    taskProcesses[processIndex].error = error;
  }
}

/**
 * Clean up process registry for completed task
 */
function cleanup(taskId) {
  processes.delete(taskId);
}

/**
 * Clean up all dead processes
 */
async function cleanupDeadProcesses() {
  let cleaned = 0;

  for (const [taskId, taskProcesses] of processes.entries()) {
    for (let i = taskProcesses.length - 1; i >= 0; i--) {
      const proc = taskProcesses[i];

      if (proc.pid && proc.status === 'running') {
        const running = await isProcessRunning(proc.pid);

        if (!running) {
          taskProcesses[i].status = 'completed';
          taskProcesses[i].completedAt = new Date().toISOString();
          cleaned++;
        }
      }
    }
  }

  return cleaned;
}

module.exports = {
  registerProcess,
  getProcesses,
  isProcessRunning,
  killProcess,
  waitForProcess,
  waitForAllProcesses,
  markCompleted,
  markFailed,
  cleanup,
  cleanupDeadProcesses
};
