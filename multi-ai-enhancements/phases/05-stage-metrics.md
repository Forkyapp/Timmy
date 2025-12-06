# Phase 05: Stage Metrics

## Problem

No visibility into pipeline performance:
- How long does each stage take?
- How many tokens are consumed?
- What's the revision rate?
- Which stages fail most often?

Can't optimize what you can't measure.

## Solution

Collect metrics at every stage. Aggregate for reporting. Use data to identify bottlenecks and improve prompts.

## Features

### 1. Metrics Schema

```typescript
interface StageMetrics {
  // Timing
  startedAt: string;
  completedAt: string;
  durationMs: number;

  // AI usage
  model: string;
  tokensIn: number;
  tokensOut: number;
  apiCalls: number;

  // Quality
  qualityScore?: number;
  issuesFound?: number;
  issuesFixed?: number;

  // Outcome
  status: 'success' | 'failed' | 'revised';
  revisionCount: number;
  error?: string;
}

interface PipelineMetrics {
  taskId: string;
  startedAt: string;
  completedAt?: string;
  totalDurationMs: number;

  stages: {
    analysis: StageMetrics;
    implementation: StageMetrics;
    review: StageMetrics;
    fixes: StageMetrics;
  };

  totals: {
    tokensUsed: number;
    apiCalls: number;
    revisions: number;
    qualityDelta: number;  // Before vs after
  };

  outcome: 'completed' | 'failed' | 'escalated';
}
```

---

### 2. Metrics Collector

```typescript
class MetricsCollector {
  private metrics: Map<string, PipelineMetrics> = new Map();

  startPipeline(taskId: string): void {
    this.metrics.set(taskId, {
      taskId,
      startedAt: new Date().toISOString(),
      totalDurationMs: 0,
      stages: {} as any,
      totals: { tokensUsed: 0, apiCalls: 0, revisions: 0, qualityDelta: 0 },
      outcome: 'completed'
    });
  }

  startStage(taskId: string, stage: string): StageTimer {
    const startedAt = new Date();

    return {
      complete: (data: Partial<StageMetrics>) => {
        const completedAt = new Date();
        const metrics = this.metrics.get(taskId)!;

        metrics.stages[stage] = {
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          durationMs: completedAt.getTime() - startedAt.getTime(),
          ...data
        };

        // Update totals
        metrics.totals.tokensUsed += data.tokensIn || 0;
        metrics.totals.tokensUsed += data.tokensOut || 0;
        metrics.totals.apiCalls += data.apiCalls || 0;
        metrics.totals.revisions += data.revisionCount || 0;
      }
    };
  }

  completePipeline(taskId: string, outcome: string): PipelineMetrics {
    const metrics = this.metrics.get(taskId)!;
    metrics.completedAt = new Date().toISOString();
    metrics.totalDurationMs =
      new Date(metrics.completedAt).getTime() -
      new Date(metrics.startedAt).getTime();
    metrics.outcome = outcome as any;

    return metrics;
  }
}
```

---

### 3. Usage in Stages

```typescript
async function executeAnalysis(context: StageContext): Promise<AnalysisOutput> {
  const timer = metricsCollector.startStage(context.taskId, 'analysis');

  try {
    const result = await gemini.analyzeTask(context.task);

    timer.complete({
      model: 'gemini-pro',
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      apiCalls: 1,
      status: 'success',
      revisionCount: 0
    });

    return result;
  } catch (error) {
    timer.complete({
      model: 'gemini-pro',
      status: 'failed',
      error: error.message
    });
    throw error;
  }
}
```

---

### 4. Metrics Storage

```typescript
// data/metrics/pipeline-metrics.json
{
  "task-123": {
    "taskId": "task-123",
    "startedAt": "2025-12-06T10:00:00Z",
    "completedAt": "2025-12-06T10:15:00Z",
    "totalDurationMs": 900000,
    "stages": {
      "analysis": {
        "durationMs": 45000,
        "tokensIn": 1200,
        "tokensOut": 3500,
        "status": "success"
      },
      "implementation": {
        "durationMs": 600000,
        "tokensIn": 5000,
        "tokensOut": 15000,
        "revisionCount": 1,
        "status": "success"
      }
    },
    "totals": {
      "tokensUsed": 24700,
      "apiCalls": 4,
      "revisions": 1
    },
    "outcome": "completed"
  }
}
```

---

### 5. Aggregated Reports

```typescript
interface AggregatedMetrics {
  period: 'day' | 'week' | 'month';

  summary: {
    tasksCompleted: number;
    tasksFailed: number;
    successRate: number;
    avgDurationMs: number;
    totalTokensUsed: number;
  };

  byStage: {
    [stage: string]: {
      avgDurationMs: number;
      avgTokens: number;
      failureRate: number;
      revisionRate: number;
    };
  };

  trends: {
    durationTrend: 'improving' | 'stable' | 'degrading';
    qualityTrend: 'improving' | 'stable' | 'degrading';
  };
}

function generateReport(metrics: PipelineMetrics[]): AggregatedMetrics {
  return {
    period: 'week',
    summary: {
      tasksCompleted: metrics.filter(m => m.outcome === 'completed').length,
      tasksFailed: metrics.filter(m => m.outcome === 'failed').length,
      successRate: calculateSuccessRate(metrics),
      avgDurationMs: average(metrics.map(m => m.totalDurationMs)),
      totalTokensUsed: sum(metrics.map(m => m.totals.tokensUsed))
    },
    byStage: aggregateByStage(metrics),
    trends: calculateTrends(metrics)
  };
}
```

---

### 6. Dashboard Display

```
┌─────────────────────────────────────────────────────────┐
│               PIPELINE METRICS                          │
├─────────────────────────────────────────────────────────┤
│ This Week                                               │
│ ├── Completed: 23 tasks                                │
│ ├── Failed: 2 tasks                                    │
│ ├── Success Rate: 92%                                  │
│ └── Avg Duration: 12.5 min                             │
├─────────────────────────────────────────────────────────┤
│ By Stage                                                │
│ ├── Analysis:       45s avg, 0% fail, 5% revise       │
│ ├── Implementation: 8m avg, 3% fail, 15% revise       │
│ ├── Review:         30s avg, 0% fail, 0% revise       │
│ └── Fixes:          2m avg, 1% fail, 8% revise        │
├─────────────────────────────────────────────────────────┤
│ Token Usage: 1.2M tokens (↓8% vs last week)            │
└─────────────────────────────────────────────────────────┘
```

---

## Success Criteria

- [ ] Metrics schema defined
- [ ] Collector implemented
- [ ] All stages report metrics
- [ ] Metrics persisted to file
- [ ] Aggregation functions working
- [ ] Basic dashboard display
- [ ] Metrics included in pipeline state

## Effort Estimate

- Schema and collector: 2 hours
- Stage integration: 3 hours
- Storage: 1 hour
- Aggregation: 2 hours
- Display: 2 hours
- Testing: 2 hours

**Total: ~1.5 days**
