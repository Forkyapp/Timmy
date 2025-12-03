/**
 * Dashboard Service - Pipeline Analytics and Monitoring
 *
 * Provides insights into pipeline health, success rates, and bottlenecks.
 */

import * as storage from '../../../lib/storage';
import { timmy, colors } from '../../shared/ui';
import type { PipelineData, StageEntry } from '../../types/storage';

/**
 * Stage statistics
 */
interface StageStats {
  name: string;
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  successRate: number;
  avgDuration: number;
  totalDuration: number;
}

/**
 * Pipeline run summary
 */
interface PipelineRun {
  taskId: string;
  taskName: string;
  status: string;
  currentStage: string;
  duration: number;
  createdAt: Date;
  completedAt?: Date;
  failedStage?: string;
  errorMessage?: string;
}

/**
 * Common error pattern
 */
interface ErrorPattern {
  stage: string;
  message: string;
  count: number;
  lastOccurred: Date;
}

/**
 * Dashboard data
 */
export interface DashboardData {
  recentRuns: PipelineRun[];
  stageStats: StageStats[];
  errorPatterns: ErrorPattern[];
  summary: {
    totalPipelines: number;
    successfulPipelines: number;
    failedPipelines: number;
    inProgressPipelines: number;
    overallSuccessRate: number;
    avgPipelineDuration: number;
  };
}

/**
 * Stage display order
 */
const STAGE_ORDER = [
  'investigating',
  'analyzing',
  'implementing',
  'verifying',
  'codex_reviewing',
  'claude_fixing',
  'pr_creating',
];

/**
 * Get human-readable stage name
 */
function getStageName(stage: string): string {
  const names: Record<string, string> = {
    detected: 'Detection',
    investigating: 'Investigation',
    investigated: 'Investigated',
    analyzing: 'Analysis',
    analyzed: 'Analyzed',
    implementing: 'Implementation',
    implemented: 'Implemented',
    verifying: 'Verification',
    verified: 'Verified',
    codex_reviewing: 'Code Review',
    codex_reviewed: 'Reviewed',
    claude_fixing: 'Fixes',
    claude_fixed: 'Fixed',
    pr_creating: 'PR Creation',
    completed: 'Completed',
    failed: 'Failed',
  };
  return names[stage] || stage;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`;
}

/**
 * Get relative time string
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Load and analyze pipeline data
 */
export function analyzePipelines(daysBack: number = 7): DashboardData {
  const pipelines = storage.pipeline.load();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const recentRuns: PipelineRun[] = [];
  const stageStatsMap = new Map<string, StageStats>();
  const errorMap = new Map<string, ErrorPattern>();

  let totalPipelines = 0;
  let successfulPipelines = 0;
  let failedPipelines = 0;
  let inProgressPipelines = 0;
  let totalDuration = 0;
  let completedWithDuration = 0;

  // Initialize stage stats
  for (const stage of STAGE_ORDER) {
    stageStatsMap.set(stage, {
      name: getStageName(stage),
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      successRate: 0,
      avgDuration: 0,
      totalDuration: 0,
    });
  }

  // Process each pipeline
  for (const [, pipeline] of Object.entries(pipelines)) {
    const pipelineData = pipeline as PipelineData;
    const createdAt = new Date(pipelineData.createdAt);

    // Skip old pipelines
    if (createdAt < cutoffDate) continue;

    totalPipelines++;

    // Determine status
    if (pipelineData.status === 'completed') {
      successfulPipelines++;
    } else if (pipelineData.status === 'failed') {
      failedPipelines++;
    } else if (pipelineData.status === 'in_progress') {
      inProgressPipelines++;
    }

    // Calculate duration
    const completedAt = pipelineData.completedAt
      ? new Date(pipelineData.completedAt)
      : pipelineData.failedAt
        ? new Date(pipelineData.failedAt)
        : undefined;

    const duration = completedAt
      ? completedAt.getTime() - createdAt.getTime()
      : Date.now() - createdAt.getTime();

    if (completedAt) {
      totalDuration += duration;
      completedWithDuration++;
    }

    // Find failed stage if any
    let failedStage: string | undefined;
    let errorMessage: string | undefined;

    if (pipelineData.errors && pipelineData.errors.length > 0) {
      const lastError = pipelineData.errors[pipelineData.errors.length - 1];
      failedStage = lastError.stage;
      errorMessage = lastError.error;

      // Track error patterns
      const errorKey = `${lastError.stage}:${lastError.error.substring(0, 50)}`;
      const existing = errorMap.get(errorKey);
      if (existing) {
        existing.count++;
        existing.lastOccurred = new Date(lastError.timestamp);
      } else {
        errorMap.set(errorKey, {
          stage: getStageName(lastError.stage),
          message: lastError.error,
          count: 1,
          lastOccurred: new Date(lastError.timestamp),
        });
      }
    }

    // Add to recent runs
    recentRuns.push({
      taskId: pipelineData.taskId,
      taskName: pipelineData.taskName || pipelineData.taskId,
      status: pipelineData.status,
      currentStage: pipelineData.currentStage,
      duration,
      createdAt,
      completedAt,
      failedStage,
      errorMessage,
    });

    // Process stage statistics
    for (const stageEntry of pipelineData.stages) {
      const stats = stageStatsMap.get(stageEntry.stage);
      if (stats) {
        stats.total++;
        if (stageEntry.status === 'completed') {
          stats.completed++;
          if (stageEntry.duration) {
            stats.totalDuration += stageEntry.duration;
          }
        } else if (stageEntry.status === 'failed') {
          stats.failed++;
        } else if (stageEntry.status === 'skipped') {
          stats.skipped++;
        }
      }
    }
  }

  // Calculate stage success rates and averages
  const stageStats: StageStats[] = [];
  for (const stage of STAGE_ORDER) {
    const stats = stageStatsMap.get(stage)!;
    if (stats.total > 0) {
      stats.successRate = Math.round((stats.completed / stats.total) * 100);
      stats.avgDuration = stats.completed > 0 ? Math.round(stats.totalDuration / stats.completed) : 0;
    }
    stageStats.push(stats);
  }

  // Sort recent runs by date (newest first)
  recentRuns.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Get top error patterns
  const errorPatterns = Array.from(errorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    recentRuns: recentRuns.slice(0, 10),
    stageStats,
    errorPatterns,
    summary: {
      totalPipelines,
      successfulPipelines,
      failedPipelines,
      inProgressPipelines,
      overallSuccessRate:
        totalPipelines > 0 ? Math.round((successfulPipelines / totalPipelines) * 100) : 0,
      avgPipelineDuration: completedWithDuration > 0 ? Math.round(totalDuration / completedWithDuration) : 0,
    },
  };
}

/**
 * Render progress bar
 */
function renderProgressBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  let barColor = colors.green;
  if (percentage < 50) barColor = colors.red;
  else if (percentage < 75) barColor = colors.yellow;

  return `${barColor}${bar}${colors.reset}`;
}

/**
 * Render the dashboard to console
 */
export function renderDashboard(data: DashboardData): void {
  const { recentRuns, stageStats, errorPatterns, summary } = data;

  // Header
  console.log('\n');
  console.log(
    `${colors.bright}${colors.cyan}┌${'─'.repeat(70)}┐${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.cyan}│${colors.reset}  🤖 ${colors.bright}TIMMY PIPELINE DASHBOARD${colors.reset}${' '.repeat(43)}${colors.bright}${colors.cyan}│${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.cyan}└${'─'.repeat(70)}┘${colors.reset}`
  );

  // Summary Section
  console.log('\n');
  console.log(`${colors.bright}  📊 SUMMARY${colors.reset}`);
  console.log(`${colors.dim}  ${'─'.repeat(68)}${colors.reset}`);

  const successColor = summary.overallSuccessRate >= 75 ? colors.green : summary.overallSuccessRate >= 50 ? colors.yellow : colors.red;

  console.log(
    `  Total Pipelines: ${colors.bright}${summary.totalPipelines}${colors.reset}  │  ` +
    `${colors.green}✓ ${summary.successfulPipelines}${colors.reset}  │  ` +
    `${colors.red}✗ ${summary.failedPipelines}${colors.reset}  │  ` +
    `${colors.yellow}⟳ ${summary.inProgressPipelines}${colors.reset}  │  ` +
    `Success: ${successColor}${summary.overallSuccessRate}%${colors.reset}`
  );

  if (summary.avgPipelineDuration > 0) {
    console.log(
      `  Avg Pipeline Duration: ${colors.cyan}${formatDuration(summary.avgPipelineDuration)}${colors.reset}`
    );
  }

  // Stage Health Section
  console.log('\n');
  console.log(`${colors.bright}  🔧 STAGE HEALTH${colors.reset}`);
  console.log(`${colors.dim}  ${'─'.repeat(68)}${colors.reset}`);

  for (const stage of stageStats) {
    if (stage.total === 0) continue;

    const nameWidth = 15;
    const paddedName = stage.name.padEnd(nameWidth);
    const bar = renderProgressBar(stage.successRate);
    const rateStr = `${stage.successRate}%`.padStart(4);
    const durationStr = stage.avgDuration > 0 ? formatDuration(stage.avgDuration).padStart(8) : '    N/A ';

    let statusIcon = '✓';
    if (stage.successRate < 50) statusIcon = '⚠';
    if (stage.successRate < 25) statusIcon = '✗';

    console.log(
      `  ${paddedName} │ ${bar} │ ${rateStr} │ ${colors.dim}~${durationStr}${colors.reset} ${stage.successRate < 75 ? colors.yellow + '← Bottleneck' + colors.reset : ''}`
    );
  }

  // Recent Runs Section
  console.log('\n');
  console.log(`${colors.bright}  📋 RECENT PIPELINES${colors.reset}`);
  console.log(`${colors.dim}  ${'─'.repeat(68)}${colors.reset}`);

  if (recentRuns.length === 0) {
    console.log(`  ${colors.dim}No recent pipeline runs${colors.reset}`);
  } else {
    for (const run of recentRuns.slice(0, 8)) {
      let statusIcon: string;
      let statusColor: string;

      switch (run.status) {
        case 'completed':
          statusIcon = '✓';
          statusColor = colors.green;
          break;
        case 'failed':
          statusIcon = '✗';
          statusColor = colors.red;
          break;
        case 'in_progress':
          statusIcon = '⟳';
          statusColor = colors.yellow;
          break;
        default:
          statusIcon = '?';
          statusColor = colors.gray;
      }

      const taskName = run.taskName.length > 25 ? run.taskName.substring(0, 22) + '...' : run.taskName.padEnd(25);
      const durationStr = formatDuration(run.duration).padStart(8);
      const timeAgo = getRelativeTime(run.createdAt);

      let details = '';
      if (run.status === 'failed' && run.failedStage) {
        details = `${colors.red}Failed at: ${run.failedStage}${colors.reset}`;
      } else if (run.status === 'in_progress') {
        details = `${colors.yellow}Stage: ${getStageName(run.currentStage)}${colors.reset}`;
      } else if (run.status === 'completed') {
        details = `${colors.green}All stages passed${colors.reset}`;
      }

      console.log(
        `  ${statusColor}${statusIcon}${colors.reset} ${colors.dim}${run.taskId.substring(0, 12)}${colors.reset} │ ${taskName} │ ${colors.cyan}${durationStr}${colors.reset} │ ${colors.dim}${timeAgo.padStart(8)}${colors.reset}`
      );
      if (details) {
        console.log(`    ${details}`);
      }
    }
  }

  // Error Patterns Section
  if (errorPatterns.length > 0) {
    console.log('\n');
    console.log(`${colors.bright}  ⚠️  COMMON ERRORS${colors.reset}`);
    console.log(`${colors.dim}  ${'─'.repeat(68)}${colors.reset}`);

    for (const error of errorPatterns.slice(0, 5)) {
      const truncatedMsg = error.message.length > 50 ? error.message.substring(0, 47) + '...' : error.message;
      console.log(
        `  ${colors.red}${error.count}x${colors.reset} │ ${error.stage.padEnd(15)} │ ${truncatedMsg}`
      );
    }
  }

  // Footer
  console.log('\n');
  console.log(
    `${colors.dim}  Last updated: ${new Date().toLocaleString()}${colors.reset}`
  );
  console.log(
    `${colors.dim}  Run ${colors.cyan}npm run dashboard${colors.reset}${colors.dim} to refresh${colors.reset}`
  );
  console.log('\n');
}

/**
 * Main dashboard function
 */
export function showDashboard(daysBack: number = 7): void {
  console.log(timmy.info('Loading pipeline data...'));

  const data = analyzePipelines(daysBack);
  renderDashboard(data);
}

/**
 * Export pipeline report as JSON
 */
export function exportReport(daysBack: number = 7): DashboardData {
  return analyzePipelines(daysBack);
}
