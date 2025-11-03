require('dotenv').config();

const config = require('./lib/config');
const { jarvis, colors } = require('./lib/ui');
const cache = require('./lib/cache');
const queue = require('./lib/queue');
const tracking = require('./lib/tracking');
const clickup = require('./lib/clickup');
const claude = require('./lib/claude');
const orchestrator = require('./lib/orchestrator');

async function pollAndProcess() {
  try {
    const tasks = await clickup.getAssignedTasks();

    for (const task of tasks) {
      if (cache.processedTaskIds.has(task.id)) continue;

      console.log(`\n${colors.bright}${colors.green}🎯 ${task.id}${colors.reset} • ${task.name}`);
      cache.addToProcessed(task);

      try {
        if (config.system.useMultiAI) {
          // Multi-AI workflow: Gemini → Claude → PR
          const result = await orchestrator.processTask(task);

          if (!result.success) {
            console.log(jarvis.warning(`Task ${task.id} queued for manual processing`));
          }
        } else {
          // Legacy workflow: Claude only
          await claude.launchCodex(task);
        }
      } catch (error) {
        console.log(jarvis.error(`Failed: ${error.message}`));
      }
    }

  } catch (error) {
    console.log(jarvis.error(`Polling error: ${error.message}`));
  }
}

// Only run if this file is executed directly (not imported for testing)
if (require.main === module) {
  // Initialize data on startup
  cache.initializeCache();
  tracking.initializeTracking();

  console.clear();
  console.log('\n' + jarvis.header('J.A.R.V.I.S'));
  console.log(jarvis.ai('Autonomous Task System'));
  console.log(jarvis.divider());

  if (!config.github.repoPath || !require('fs').existsSync(config.github.repoPath)) {
    console.log(jarvis.error('Repository path not configured in .env'));
    process.exit(1);
  }

  claude.ensureClaudeSettings();
  console.log(jarvis.success('Systems online'));
  console.log(jarvis.info(`Monitoring workspace • ${config.system.pollIntervalMs / 1000}s intervals`));

  if (config.system.useMultiAI) {
    console.log(jarvis.ai('Multi-AI mode enabled (Gemini → Claude → PR)'));
  } else {
    console.log(jarvis.info('Legacy mode (Claude only)'));
  }

  console.log(jarvis.divider() + '\n');

  pollAndProcess();
  setInterval(pollAndProcess, config.system.pollIntervalMs);
  setInterval(tracking.pollForPRs, config.prTracking.checkIntervalMs);

  // Set up shutdown handlers
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

function gracefulShutdown() {
  console.log('\n' + jarvis.ai('Shutting down...'));
  cache.saveProcessedTasks();
  tracking.savePRTracking(tracking.prTracking);
  console.log(jarvis.success('State saved. Goodbye!') + '\n');
  process.exit(0);
}

// Export for testing
module.exports = {
  pollAndProcess,
  gracefulShutdown,
  // Re-export from modules for backward compatibility with tests
  ...cache,
  ...queue,
  ...tracking,
  ...clickup,
  ...claude,
  config,
};
