require('dotenv').config();

const config = require('./lib/config');
const { jarvis, colors } = require('./lib/ui');
const storage = require('./lib/storage');
const clickup = require('./lib/clickup');
const claude = require('./lib/claude');
const orchestrator = require('./lib/orchestrator');

async function pollAndProcess() {
  try {
    const tasks = await clickup.getAssignedTasks();

    for (const task of tasks) {
      if (storage.cache.has(task.id)) continue;

      console.log(`\n${colors.bright}${colors.green}🎯 ${task.id}${colors.reset} • ${task.name}`);
      storage.cache.add(task);

      try {
        // Multi-AI workflow: Gemini → Claude → PR
        const result = await orchestrator.processTask(task);

        if (!result.success) {
          console.log(jarvis.warning(`Task ${task.id} queued for manual processing`));
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
  storage.cache.init();

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
  console.log(jarvis.ai('✨ Synchronous Multi-AI Workflow:'));
  console.log(jarvis.info('   1. Gemini Analysis'));
  console.log(jarvis.info('   2. Claude Implementation'));
  console.log(jarvis.info('   3. Codex Code Review'));
  console.log(jarvis.info('   4. Claude Fixes'));
  console.log(jarvis.info('   All in ONE terminal, sequential execution'));
  console.log(jarvis.divider() + '\n');

  // Start polling for new tasks
  pollAndProcess();
  setInterval(pollAndProcess, config.system.pollIntervalMs);

  // Set up shutdown handlers
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

function gracefulShutdown() {
  console.log('\n' + jarvis.ai('Shutting down...'));
  storage.cache.save();
  console.log(jarvis.success('State saved. Goodbye!') + '\n');
  process.exit(0);
}

// Export for testing
module.exports = {
  pollAndProcess,
  gracefulShutdown,
  // Re-export from modules for backward compatibility with tests
  ...storage.queue,
  ...clickup,
  ...claude,
  config,
};
