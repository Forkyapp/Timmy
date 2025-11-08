#!/usr/bin/env node
require('dotenv').config();

const { jarvis, colors } = require('./lib/ui');
const storage = require('./lib/storage');
const codex = require('./lib/codex');
const clickup = require('./lib/clickup');
const config = require('./lib/config');

/**
 * Retry only the Codex review stage for a specific task
 */
async function retryCodexReview(taskId) {
  console.log(jarvis.ai(`Retrying Codex review for ${colors.bright}${taskId}${colors.reset}`));

  // Get pipeline state
  const pipelineState = storage.pipeline.get(taskId);

  if (!pipelineState) {
    console.log(jarvis.error(`Task ${taskId} not found in pipeline state`));
    process.exit(1);
  }

  console.log(jarvis.info(`Task: ${pipelineState.taskName}`));
  console.log(jarvis.info(`Current stage: ${pipelineState.currentStage}`));
  console.log(jarvis.info(`Status: ${pipelineState.status}`));

  // Check if Claude implementation was completed
  const implementingStage = pipelineState.stages.find(s => s.stage === 'implementing');
  if (!implementingStage || implementingStage.status !== 'completed') {
    console.log(jarvis.error('Claude implementation stage not completed. Cannot run Codex review.'));
    process.exit(1);
  }

  const branch = implementingStage.branch || `task-${taskId}`;
  console.log(jarvis.info(`Branch: ${branch}`));

  // Detect repository from task metadata or use default
  const repoName = pipelineState.metadata?.repository;
  let repoConfig;

  if (repoName && repoName !== 'default') {
    console.log(jarvis.info(`Repository: ${colors.bright}${repoName}${colors.reset}`));
    repoConfig = config.resolveRepoConfig(repoName);
  } else {
    console.log(jarvis.info(`Repository: ${colors.bright}default${colors.reset}`));
    repoConfig = config.resolveRepoConfig(null);
  }

  // Create minimal task object for codex.reviewClaudeChanges
  const task = {
    id: taskId,
    name: pipelineState.taskName,
    url: `https://app.clickup.com/t/${taskId}`
  };

  // Update pipeline stage
  storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, { name: 'Codex Review (Retry)' });

  try {
    const reviewResult = await codex.reviewClaudeChanges(task, { repoConfig });

    if (!reviewResult.success) {
      throw new Error(reviewResult.error || 'Codex review failed');
    }

    storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, {
      branch: reviewResult.branch
    });

    console.log(jarvis.success(`${colors.bright}Codex${colors.reset} review complete for ${colors.bright}${taskId}${colors.reset}`));
    console.log(jarvis.success('✅ Done! You can now continue with Claude fixes if needed.'));

  } catch (error) {
    console.log(jarvis.error(`Codex review error: ${error.message}`));
    storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, error);
    console.log(jarvis.warning('Review failed. Check the error above.'));
    process.exit(1);
  }
}

// Get task ID from command line
const taskId = process.argv[2];

if (!taskId) {
  console.log(jarvis.error('Usage: node retry-codex-review.js <task-id>'));
  console.log(jarvis.info('Example: node retry-codex-review.js 86eveugud'));
  process.exit(1);
}

// Run the retry
retryCodexReview(taskId).catch(error => {
  console.log(jarvis.error(`Fatal error: ${error.message}`));
  process.exit(1);
});
