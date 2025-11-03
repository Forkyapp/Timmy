const fs = require('fs');
const path = require('path');

const PIPELINE_FILE = path.join(__dirname, '..', 'pipeline-state.json');

// Pipeline stage definitions
const STAGES = {
  DETECTED: 'detected',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  IMPLEMENTING: 'implementing',
  IMPLEMENTED: 'implemented',
  CODEX_REVIEWING: 'codex_reviewing',
  CODEX_REVIEWED: 'codex_reviewed',
  CLAUDE_FIXING: 'claude_fixing',
  CLAUDE_FIXED: 'claude_fixed',
  MERGING: 'merging',
  MERGED: 'merged',
  PR_CREATING: 'pr_creating',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

/**
 * Load all pipelines from disk
 */
function loadPipelines() {
  try {
    if (fs.existsSync(PIPELINE_FILE)) {
      return JSON.parse(fs.readFileSync(PIPELINE_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading pipelines:', error.message);
  }
  return {};
}

/**
 * Save all pipelines to disk
 */
function savePipelines(pipelines) {
  try {
    fs.writeFileSync(PIPELINE_FILE, JSON.stringify(pipelines, null, 2));
  } catch (error) {
    console.error('Error saving pipelines:', error.message);
  }
}

/**
 * Initialize a new pipeline for a task
 */
function initPipeline(taskId, taskData = {}) {
  const pipelines = loadPipelines();

  const pipeline = {
    taskId,
    taskName: taskData.name || '',
    currentStage: STAGES.DETECTED,
    status: STATUS.IN_PROGRESS,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stages: [
      {
        name: 'detection',
        stage: STAGES.DETECTED,
        status: STATUS.COMPLETED,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      }
    ],
    metadata: {
      geminiAnalysis: null,
      claudeInstances: [],
      branches: [],
      prNumber: null,
      reviewIterations: 0,
      maxReviewIterations: 3
    },
    errors: []
  };

  pipelines[taskId] = pipeline;
  savePipelines(pipelines);

  return pipeline;
}

/**
 * Get pipeline for a task
 */
function getPipeline(taskId) {
  const pipelines = loadPipelines();
  return pipelines[taskId] || null;
}

/**
 * Update pipeline stage
 */
function updateStage(taskId, stage, stageData = {}) {
  const pipelines = loadPipelines();
  const pipeline = pipelines[taskId];

  if (!pipeline) {
    throw new Error(`Pipeline not found for task ${taskId}`);
  }

  // Find existing stage or create new one
  let stageEntry = pipeline.stages.find(s => s.stage === stage);

  if (!stageEntry) {
    stageEntry = {
      name: stageData.name || stage,
      stage,
      status: STATUS.IN_PROGRESS,
      startedAt: new Date().toISOString()
    };
    pipeline.stages.push(stageEntry);
  } else {
    stageEntry.status = STATUS.IN_PROGRESS;
    stageEntry.startedAt = new Date().toISOString();
  }

  // Merge additional data
  Object.assign(stageEntry, stageData);

  pipeline.currentStage = stage;
  pipeline.updatedAt = new Date().toISOString();

  savePipelines(pipelines);
  return pipeline;
}

/**
 * Complete a pipeline stage
 */
function completeStage(taskId, stage, result = {}) {
  const pipelines = loadPipelines();
  const pipeline = pipelines[taskId];

  if (!pipeline) {
    throw new Error(`Pipeline not found for task ${taskId}`);
  }

  const stageEntry = pipeline.stages.find(s => s.stage === stage);

  if (stageEntry) {
    stageEntry.status = STATUS.COMPLETED;
    stageEntry.completedAt = new Date().toISOString();
    stageEntry.duration = Date.parse(stageEntry.completedAt) - Date.parse(stageEntry.startedAt);
    Object.assign(stageEntry, result);
  }

  pipeline.updatedAt = new Date().toISOString();

  savePipelines(pipelines);
  return pipeline;
}

/**
 * Fail a pipeline stage
 */
function failStage(taskId, stage, error) {
  const pipelines = loadPipelines();
  const pipeline = pipelines[taskId];

  if (!pipeline) {
    throw new Error(`Pipeline not found for task ${taskId}`);
  }

  const stageEntry = pipeline.stages.find(s => s.stage === stage);

  if (stageEntry) {
    stageEntry.status = STATUS.FAILED;
    stageEntry.completedAt = new Date().toISOString();
    stageEntry.error = error.message || String(error);
  }

  pipeline.errors.push({
    stage,
    error: error.message || String(error),
    timestamp: new Date().toISOString()
  });

  pipeline.updatedAt = new Date().toISOString();

  savePipelines(pipelines);
  return pipeline;
}

/**
 * Update pipeline metadata
 */
function updateMetadata(taskId, metadata) {
  const pipelines = loadPipelines();
  const pipeline = pipelines[taskId];

  if (!pipeline) {
    throw new Error(`Pipeline not found for task ${taskId}`);
  }

  pipeline.metadata = {
    ...pipeline.metadata,
    ...metadata
  };

  pipeline.updatedAt = new Date().toISOString();

  savePipelines(pipelines);
  return pipeline;
}

/**
 * Complete entire pipeline
 */
function completePipeline(taskId, result = {}) {
  const pipelines = loadPipelines();
  const pipeline = pipelines[taskId];

  if (!pipeline) {
    throw new Error(`Pipeline not found for task ${taskId}`);
  }

  pipeline.status = STATUS.COMPLETED;
  pipeline.currentStage = STAGES.COMPLETED;
  pipeline.completedAt = new Date().toISOString();
  pipeline.totalDuration = Date.parse(pipeline.completedAt) - Date.parse(pipeline.createdAt);

  Object.assign(pipeline.metadata, result);

  savePipelines(pipelines);
  return pipeline;
}

/**
 * Fail entire pipeline
 */
function failPipeline(taskId, error) {
  const pipelines = loadPipelines();
  const pipeline = pipelines[taskId];

  if (!pipeline) {
    throw new Error(`Pipeline not found for task ${taskId}`);
  }

  pipeline.status = STATUS.FAILED;
  pipeline.currentStage = STAGES.FAILED;
  pipeline.failedAt = new Date().toISOString();
  pipeline.errors.push({
    stage: pipeline.currentStage,
    error: error.message || String(error),
    timestamp: new Date().toISOString()
  });

  savePipelines(pipelines);
  return pipeline;
}

/**
 * Get all active pipelines
 */
function getActivePipelines() {
  const pipelines = loadPipelines();
  return Object.values(pipelines).filter(
    p => p.status === STATUS.IN_PROGRESS
  );
}

/**
 * Clean up old completed pipelines
 */
function cleanupOldPipelines(olderThanMs = 7 * 24 * 60 * 60 * 1000) {
  const pipelines = loadPipelines();
  const cutoffTime = Date.now() - olderThanMs;
  let cleaned = 0;

  for (const [taskId, pipeline] of Object.entries(pipelines)) {
    const completedAt = pipeline.completedAt || pipeline.failedAt;
    if (completedAt && Date.parse(completedAt) < cutoffTime) {
      delete pipelines[taskId];
      cleaned++;
    }
  }

  if (cleaned > 0) {
    savePipelines(pipelines);
  }

  return cleaned;
}

/**
 * Get pipeline summary
 */
function getPipelineSummary(taskId) {
  const pipeline = getPipeline(taskId);

  if (!pipeline) {
    return null;
  }

  return {
    taskId: pipeline.taskId,
    taskName: pipeline.taskName,
    currentStage: pipeline.currentStage,
    status: pipeline.status,
    progress: calculateProgress(pipeline),
    duration: calculateDuration(pipeline),
    reviewIterations: pipeline.metadata.reviewIterations || 0,
    hasErrors: pipeline.errors.length > 0
  };
}

/**
 * Calculate pipeline progress (0-100%)
 */
function calculateProgress(pipeline) {
  const totalStages = 10; // Total possible stages
  const completedStages = pipeline.stages.filter(
    s => s.status === STATUS.COMPLETED
  ).length;

  return Math.round((completedStages / totalStages) * 100);
}

/**
 * Calculate pipeline duration
 */
function calculateDuration(pipeline) {
  const endTime = pipeline.completedAt || pipeline.failedAt || new Date().toISOString();
  return Date.parse(endTime) - Date.parse(pipeline.createdAt);
}

module.exports = {
  STAGES,
  STATUS,
  initPipeline,
  getPipeline,
  updateStage,
  completeStage,
  failStage,
  updateMetadata,
  completePipeline,
  failPipeline,
  getActivePipelines,
  cleanupOldPipelines,
  getPipelineSummary
};
