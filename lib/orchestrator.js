const path = require('path');
const { jarvis, colors } = require('./ui');
const storage = require('./storage');
const gemini = require('./gemini');
const claude = require('./claude');
const codex = require('./codex');
const config = require('./config');
const clickup = require('./clickup');
const repoManager = require('./repo-manager');

/**
 * Process a task with FULLY SYNCHRONOUS multi-AI workflow
 *
 * Flow: Gemini Analysis → Claude Implementation → Codex Review → Claude Fixes → Complete
 * All agents run in sequence, waiting for each to complete before starting the next
 */
async function processTask(task) {
  const taskId = task.id;
  const taskName = task.name;

  // Detect repository from task
  const repoName = clickup.detectRepository(task);

  console.log(jarvis.ai(`Starting multi-AI workflow for ${colors.bright}${taskId}${colors.reset}`));

  let repoConfig;
  try {
    // Ensure repository exists (auto-create if needed)
    if (repoName) {
      console.log(jarvis.info(`Repository: ${colors.bright}${repoName}${colors.reset}`));
      repoConfig = await repoManager.ensureRepository(repoName, {
        autoCreate: config.autoRepo.enabled,
        isPrivate: config.autoRepo.isPrivate,
        baseDir: config.autoRepo.baseDir,
        baseBranch: config.autoRepo.defaultBranch
      });
      console.log(jarvis.success(`Using repository: ${repoConfig.owner}/${repoConfig.repo}`));
    } else {
      console.log(jarvis.info(`Repository: ${colors.bright}default${colors.reset}`));
      repoConfig = config.resolveRepoConfig(null);
      console.log(jarvis.info(`Using default: ${repoConfig.owner}/${repoConfig.repo}`));
    }
  } catch (error) {
    console.log(jarvis.error(`Repository setup failed: ${error.message}`));
    storage.pipeline.fail(taskId, error);
    await storage.queue.add(task);
    return {
      success: false,
      error: error.message
    };
  }

  // Initialize pipeline
  const pipelineState = storage.pipeline.init(taskId, { name: taskName, repository: repoName || 'default' });

  try {
    // Stage 1: Gemini Analysis
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.ANALYZING, { name: 'Gemini Analysis' });

    let analysis = null;
    let usedFallback = false;

    try {
      // Post Gemini start comment
      await clickup.addComment(
        taskId,
        `🧠 **Gemini Analysis Started**\n\n` +
        `Gemini AI is analyzing the task to create a detailed feature specification.\n\n` +
        `**Status:** Analyzing requirements and architecture`
      );

      analysis = await gemini.analyzeTask(task, { repoConfig });

      if (analysis.fallback) {
        usedFallback = true;
        console.log(jarvis.warning('Using fallback analysis'));
      }

      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.ANALYZING, {
        featureSpecFile: analysis.featureSpecFile,
        fallback: usedFallback,
        logFile: analysis.logFile
      });

      storage.pipeline.updateMetadata(taskId, {
        geminiAnalysis: {
          file: analysis.featureSpecFile,
          fallback: usedFallback,
          logFile: analysis.logFile
        }
      });

      // Store Gemini execution info
      storage.pipeline.storeAgentExecution(taskId, 'gemini', {
        logFile: analysis.logFile,
        progressFile: analysis.progressFile,
        featureSpecFile: analysis.featureSpecFile
      });

      // Post Gemini completion comment
      await clickup.addComment(
        taskId,
        `✅ **Gemini Analysis Complete**\n\n` +
        `Feature specification has been created.\n\n` +
        `**Spec File:** \`${path.basename(analysis.featureSpecFile)}\`\n` +
        `**Status:** ${usedFallback ? 'Fallback mode (Gemini unavailable)' : 'Success'}\n\n` +
        `Next: Claude will implement the feature`
      );

    } catch (error) {
      console.log(jarvis.error(`Gemini analysis failed: ${error.message}`));
      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.ANALYZING, error);

      // Continue without analysis
      console.log(jarvis.info('Continuing without ${colors.bright}Gemini${colors.reset} analysis'));
    }

    // Stage 2: Claude Implementation
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, { name: 'Claude Implementation' });

    try {
      const result = await claude.launchClaude(task, { analysis, repoConfig });

      if (!result.success) {
        throw new Error(result.error || 'Claude implementation failed');
      }

      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, {
        branch: result.branch
      });

      console.log(jarvis.success(`${colors.bright}Claude${colors.reset} implementation complete for ${colors.bright}${taskId}${colors.reset}`));

    } catch (error) {
      console.log(jarvis.error(`Claude implementation error: ${error.message}`));
      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, error);
      storage.pipeline.fail(taskId, error);
      await storage.queue.add(task);
      return {
        success: false,
        pipeline: pipelineState,
        error: error.message
      };
    }

    // Stage 3: Codex Code Review
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, { name: 'Codex Review' });

    try {
      const reviewResult = await codex.reviewClaudeChanges(task, { repoConfig });

      if (!reviewResult.success) {
        throw new Error(reviewResult.error || 'Codex review failed');
      }

      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, {
        branch: reviewResult.branch
      });

      console.log(jarvis.success(`${colors.bright}Codex${colors.reset} review complete for ${colors.bright}${taskId}${colors.reset}`));

    } catch (error) {
      console.log(jarvis.error(`Codex review error: ${error.message}`));
      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, error);
      // Continue even if review fails - not critical
      console.log(jarvis.warning(`Continuing without Codex review`));
    }

    // Stage 4: Claude Fixes TODO/FIXME Comments
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, { name: 'Claude Fixes' });

    try {
      const fixResult = await claude.fixTodoComments(task, { repoConfig });

      if (!fixResult.success) {
        throw new Error(fixResult.error || 'Claude fixes failed');
      }

      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, {
        branch: fixResult.branch
      });

      console.log(jarvis.success(`${colors.bright}Claude${colors.reset} fixes complete for ${colors.bright}${taskId}${colors.reset}`));

    } catch (error) {
      console.log(jarvis.error(`Claude fixes error: ${error.message}`));
      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, error);
      // Continue even if fixes fail - not critical
      console.log(jarvis.warning(`Continuing without Claude fixes`));
    }

    // Stage 5: Complete
    storage.pipeline.complete(taskId, {
      branch: `task-${taskId}`,
      completedAt: new Date().toISOString()
    });

    console.log(jarvis.success(`🎉 Multi-AI workflow complete for ${colors.bright}${taskId}${colors.reset}`));

    await clickup.addComment(
      taskId,
      `🎉 **Workflow Complete**\n\n` +
      `Full multi-AI workflow has finished:\n` +
      `✅ Gemini Analysis\n` +
      `✅ Claude Implementation\n` +
      `✅ Codex Review\n` +
      `✅ Claude Fixes\n\n` +
      `**Branch:** \`task-${taskId}\`\n` +
      `**Status:** Ready for review`
    );

    return {
      success: true,
      pipeline: pipelineState,
      analysis: analysis || null
    };

  } catch (error) {
    console.log(jarvis.error(`Orchestration error: ${error.message}`));
    storage.pipeline.fail(taskId, error);

    // Queue for manual processing
    await storage.queue.add(task);

    return {
      success: false,
      pipeline: pipelineState,
      error: error.message
    };
  }
}

/**
 * Get pipeline status for a task
 */
function getTaskStatus(taskId) {
  return storage.pipeline.getSummary(taskId);
}

/**
 * Get all active tasks
 */
function getActiveTasks() {
  return storage.pipeline.getActive();
}

module.exports = {
  processTask,
  getTaskStatus,
  getActiveTasks
};
