const config = require('./config');
const { jarvis, colors } = require('./ui');
const pipeline = require('./pipeline');
const gemini = require('./gemini');
const claude = require('./claude');
const codex = require('./codex');
const queue = require('./queue');
const tracking = require('./tracking');

/**
 * Process a task with multi-AI workflow (MVP: Sequential)
 *
 * Flow: Gemini Analysis → AI Implementation (Claude or Codex) → PR Creation
 */
async function processTask(task) {
  const taskId = task.id;
  const taskName = task.name;

  console.log(jarvis.ai(`Starting multi-AI workflow for ${colors.bright}${taskId}${colors.reset}`));

  // Initialize pipeline
  const pipelineState = pipeline.initPipeline(taskId, { name: taskName });

  try {
    // Stage 1: Gemini Analysis
    pipeline.updateStage(taskId, pipeline.STAGES.ANALYZING, { name: 'Gemini Analysis' });

    let analysis = null;
    let usedFallback = false;

    try {
      analysis = await gemini.analyzeTask(task);

      if (analysis.fallback) {
        usedFallback = true;
        console.log(jarvis.warning('Using fallback analysis'));
      }

      pipeline.completeStage(taskId, pipeline.STAGES.ANALYZING, {
        featureSpecFile: analysis.featureSpecFile,
        fallback: usedFallback
      });

      pipeline.updateMetadata(taskId, {
        geminiAnalysis: {
          file: analysis.featureSpecFile,
          fallback: usedFallback
        }
      });

    } catch (error) {
      console.log(jarvis.error(`Gemini analysis failed: ${error.message}`));
      pipeline.failStage(taskId, pipeline.STAGES.ANALYZING, error);

      // Continue without analysis
      console.log(jarvis.info('Continuing without Gemini analysis'));
    }

    // Stage 2: AI Implementation (Claude or Codex based on config)
    const aiProvider = config.system.aiProvider;
    const aiName = aiProvider === 'codex' ? 'Codex' : 'Claude';

    pipeline.updateStage(taskId, pipeline.STAGES.IMPLEMENTING, { name: `${aiName} Implementation` });

    try {
      // Choose AI provider based on config
      const aiModule = aiProvider === 'codex' ? codex : claude;
      const launchFunction = aiProvider === 'codex' ? aiModule.launchCodex : aiModule.launchClaude;

      const result = await launchFunction(task, { analysis });

      if (result.success) {
        pipeline.completeStage(taskId, pipeline.STAGES.IMPLEMENTING, {
          pid: result.pid,
          branch: `task-${taskId}`
        });

        pipeline.updateMetadata(taskId, {
          aiProvider: aiProvider,
          aiInstances: [{
            provider: aiProvider,
            type: 'main',
            branch: `task-${taskId}`,
            pid: result.pid,
            startedAt: new Date().toISOString()
          }]
        });

        // Stage 3: PR Creation (handled by existing tracking system)
        pipeline.updateStage(taskId, pipeline.STAGES.PR_CREATING, { name: 'PR Creation' });
        tracking.startPRTracking(task);

        console.log(jarvis.success(`Multi-AI workflow initiated for ${colors.bright}${taskId}${colors.reset}`));

        return {
          success: true,
          pipeline: pipelineState,
          analysis: analysis || null
        };

      } else {
        // AI launch failed
        pipeline.failStage(taskId, pipeline.STAGES.IMPLEMENTING, new Error(result.error || `${aiName} launch failed`));
        pipeline.failPipeline(taskId, new Error('Implementation stage failed'));

        // Queue for manual processing
        await queue.queueTask(task);

        return {
          success: false,
          pipeline: pipelineState,
          error: result.error
        };
      }

    } catch (error) {
      console.log(jarvis.error(`${aiName} launch error: ${error.message}`));
      pipeline.failStage(taskId, pipeline.STAGES.IMPLEMENTING, error);
      pipeline.failPipeline(taskId, error);

      // Queue for manual processing
      await queue.queueTask(task);

      return {
        success: false,
        pipeline: pipelineState,
        error: error.message
      };
    }

  } catch (error) {
    console.log(jarvis.error(`Orchestration error: ${error.message}`));
    pipeline.failPipeline(taskId, error);

    // Queue for manual processing
    await queue.queueTask(task);

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
  return pipeline.getPipelineSummary(taskId);
}

/**
 * Get all active tasks
 */
function getActiveTasks() {
  return pipeline.getActivePipelines();
}

module.exports = {
  processTask,
  getTaskStatus,
  getActiveTasks
};
