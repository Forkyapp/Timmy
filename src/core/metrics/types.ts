/**
 * Stage Metrics Types
 *
 * Types for tracking pipeline performance, token usage,
 * revision rates, and failure points.
 */

export interface StageMetrics {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  model: string;
  tokensIn: number;
  tokensOut: number;
  apiCalls: number;
  qualityScore?: number;
  issuesFound?: number;
  issuesFixed?: number;
  status: 'success' | 'failed' | 'revised';
  revisionCount: number;
  error?: string;
}

export interface StageTimer {
  complete: (data: Partial<StageMetrics>) => void;
}

export interface PipelineMetrics {
  taskId: string;
  startedAt: string;
  completedAt?: string;
  totalDurationMs: number;
  stages: Record<string, StageMetrics>;
  totals: {
    tokensUsed: number;
    apiCalls: number;
    revisions: number;
    qualityDelta: number;
  };
  outcome: 'completed' | 'failed' | 'escalated';
}

export interface AggregatedMetrics {
  period: 'day' | 'week' | 'month';
  summary: {
    tasksCompleted: number;
    tasksFailed: number;
    successRate: number;
    avgDurationMs: number;
    totalTokensUsed: number;
  };
  byStage: Record<string, StageAggregation>;
  trends: {
    durationTrend: 'improving' | 'stable' | 'degrading';
    qualityTrend: 'improving' | 'stable' | 'degrading';
  };
}

export interface StageAggregation {
  avgDurationMs: number;
  avgTokens: number;
  failureRate: number;
  revisionRate: number;
}
