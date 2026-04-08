/**
 * Metrics Aggregator
 *
 * Aggregates pipeline metrics for reporting and trend analysis.
 */

import type {
  PipelineMetrics,
  AggregatedMetrics,
  StageAggregation,
} from './types';

/**
 * Generate an aggregated report from pipeline metrics.
 */
export function generateReport(
  metrics: PipelineMetrics[],
  period: 'day' | 'week' | 'month' = 'week'
): AggregatedMetrics {
  if (metrics.length === 0) {
    return emptyReport(period);
  }

  const completed = metrics.filter(m => m.outcome === 'completed');
  const failed = metrics.filter(m => m.outcome === 'failed');

  return {
    period,
    summary: {
      tasksCompleted: completed.length,
      tasksFailed: failed.length,
      successRate: metrics.length > 0 ? (completed.length / metrics.length) * 100 : 0,
      avgDurationMs: average(metrics.map(m => m.totalDurationMs)),
      totalTokensUsed: sum(metrics.map(m => m.totals.tokensUsed)),
    },
    byStage: aggregateByStage(metrics),
    trends: calculateTrends(metrics),
  };
}

/**
 * Format aggregated metrics as a dashboard string.
 */
export function formatDashboard(report: AggregatedMetrics): string {
  const { summary, byStage } = report;
  const border = '─'.repeat(55);

  const lines = [
    `┌${border}┐`,
    `│               PIPELINE METRICS                        │`,
    `├${border}┤`,
    `│ This ${report.period.charAt(0).toUpperCase() + report.period.slice(1)}${' '.repeat(48 - report.period.length)}│`,
    `│ ├── Completed: ${padRight(String(summary.tasksCompleted) + ' tasks', 38)}│`,
    `│ ├── Failed: ${padRight(String(summary.tasksFailed) + ' tasks', 41)}│`,
    `│ ├── Success Rate: ${padRight(summary.successRate.toFixed(0) + '%', 35)}│`,
    `│ └── Avg Duration: ${padRight(formatDuration(summary.avgDurationMs), 35)}│`,
    `├${border}┤`,
    `│ By Stage${' '.repeat(46)}│`,
  ];

  for (const [stage, data] of Object.entries(byStage)) {
    const stageStr = `${stage}: ${formatDuration(data.avgDurationMs)} avg, ${data.failureRate.toFixed(0)}% fail, ${data.revisionRate.toFixed(0)}% revise`;
    lines.push(`│ ├── ${padRight(stageStr, 50)}│`);
  }

  lines.push(
    `├${border}┤`,
    `│ Token Usage: ${padRight(formatTokens(summary.totalTokensUsed), 40)}│`,
    `└${border}┘`
  );

  return lines.join('\n');
}

/**
 * Format report as markdown for ClickUp.
 */
export function formatReportMarkdown(report: AggregatedMetrics): string {
  const { summary, byStage, trends } = report;

  const lines = [
    `## Pipeline Metrics (${report.period})`,
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Tasks Completed | ${summary.tasksCompleted} |`,
    `| Tasks Failed | ${summary.tasksFailed} |`,
    `| Success Rate | ${summary.successRate.toFixed(1)}% |`,
    `| Avg Duration | ${formatDuration(summary.avgDurationMs)} |`,
    `| Total Tokens | ${formatTokens(summary.totalTokensUsed)} |`,
    '',
    `### By Stage`,
    '',
    `| Stage | Avg Duration | Avg Tokens | Fail Rate | Revision Rate |`,
    `|-------|-------------|------------|-----------|---------------|`,
  ];

  for (const [stage, data] of Object.entries(byStage)) {
    lines.push(
      `| ${stage} | ${formatDuration(data.avgDurationMs)} | ${formatTokens(data.avgTokens)} | ${data.failureRate.toFixed(1)}% | ${data.revisionRate.toFixed(1)}% |`
    );
  }

  lines.push(
    '',
    `### Trends`,
    `- Duration: ${trends.durationTrend}`,
    `- Quality: ${trends.qualityTrend}`,
  );

  return lines.join('\n');
}

// ─── Helpers ─────────────────────────────────────────────

function emptyReport(period: 'day' | 'week' | 'month'): AggregatedMetrics {
  return {
    period,
    summary: {
      tasksCompleted: 0,
      tasksFailed: 0,
      successRate: 0,
      avgDurationMs: 0,
      totalTokensUsed: 0,
    },
    byStage: {},
    trends: { durationTrend: 'stable', qualityTrend: 'stable' },
  };
}

function aggregateByStage(metrics: PipelineMetrics[]): Record<string, StageAggregation> {
  const stageNames = new Set<string>();
  for (const m of metrics) {
    for (const stage of Object.keys(m.stages)) {
      stageNames.add(stage);
    }
  }

  const result: Record<string, StageAggregation> = {};

  for (const stage of stageNames) {
    const stageData = metrics
      .map(m => m.stages[stage])
      .filter(Boolean);

    if (stageData.length === 0) continue;

    result[stage] = {
      avgDurationMs: average(stageData.map(s => s.durationMs)),
      avgTokens: average(stageData.map(s => s.tokensIn + s.tokensOut)),
      failureRate: (stageData.filter(s => s.status === 'failed').length / stageData.length) * 100,
      revisionRate: (stageData.filter(s => s.revisionCount > 0).length / stageData.length) * 100,
    };
  }

  return result;
}

function calculateTrends(metrics: PipelineMetrics[]): AggregatedMetrics['trends'] {
  if (metrics.length < 4) {
    return { durationTrend: 'stable', qualityTrend: 'stable' };
  }

  // Split into first half and second half
  const mid = Math.floor(metrics.length / 2);
  const firstHalf = metrics.slice(0, mid);
  const secondHalf = metrics.slice(mid);

  const avgFirst = average(firstHalf.map(m => m.totalDurationMs));
  const avgSecond = average(secondHalf.map(m => m.totalDurationMs));

  const successFirst = firstHalf.filter(m => m.outcome === 'completed').length / firstHalf.length;
  const successSecond = secondHalf.filter(m => m.outcome === 'completed').length / secondHalf.length;

  const threshold = 0.1; // 10% change threshold

  return {
    durationTrend: avgSecond < avgFirst * (1 - threshold)
      ? 'improving'
      : avgSecond > avgFirst * (1 + threshold)
        ? 'degrading'
        : 'stable',
    qualityTrend: successSecond > successFirst + threshold
      ? 'improving'
      : successSecond < successFirst - threshold
        ? 'degrading'
        : 'stable',
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1000000).toFixed(1)}M`;
}

function padRight(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}
