import { MetricsCollector } from '../metrics-collector';
import { generateReport, formatDashboard, formatReportMarkdown } from '../aggregator';
import type { PipelineMetrics } from '../types';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  it('should start and complete a pipeline', () => {
    collector.startPipeline('task-1');
    const result = collector.completePipeline('task-1', 'completed');

    expect(result).not.toBeNull();
    expect(result!.taskId).toBe('task-1');
    expect(result!.outcome).toBe('completed');
    expect(result!.completedAt).toBeDefined();
    expect(result!.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('should track stage metrics', () => {
    collector.startPipeline('task-2');
    const timer = collector.startStage('task-2', 'analysis');

    timer.complete({
      model: 'gemini',
      tokensIn: 1000,
      tokensOut: 3000,
      apiCalls: 1,
      status: 'success',
      revisionCount: 0,
    });

    const metrics = collector.getMetrics('task-2');
    expect(metrics).not.toBeNull();
    expect(metrics!.stages['analysis']).toBeDefined();
    expect(metrics!.stages['analysis'].model).toBe('gemini');
    expect(metrics!.stages['analysis'].tokensIn).toBe(1000);
    expect(metrics!.stages['analysis'].tokensOut).toBe(3000);
    expect(metrics!.stages['analysis'].status).toBe('success');
    expect(metrics!.totals.tokensUsed).toBe(4000);
    expect(metrics!.totals.apiCalls).toBe(1);
  });

  it('should accumulate totals across stages', () => {
    collector.startPipeline('task-3');

    const t1 = collector.startStage('task-3', 'analysis');
    t1.complete({ tokensIn: 500, tokensOut: 1500, apiCalls: 1 });

    const t2 = collector.startStage('task-3', 'implementation');
    t2.complete({ tokensIn: 2000, tokensOut: 5000, apiCalls: 2 });

    const metrics = collector.getMetrics('task-3');
    expect(metrics!.totals.tokensUsed).toBe(9000); // 500+1500+2000+5000
    expect(metrics!.totals.apiCalls).toBe(3);
  });

  it('should track failed stages', () => {
    collector.startPipeline('task-4');
    const timer = collector.startStage('task-4', 'implementation');

    timer.complete({
      model: 'claude',
      status: 'failed',
      error: 'Timeout after 30 minutes',
    });

    const metrics = collector.getMetrics('task-4');
    expect(metrics!.stages['implementation'].status).toBe('failed');
    expect(metrics!.stages['implementation'].error).toBe('Timeout after 30 minutes');
  });

  it('should return null for unknown task', () => {
    expect(collector.getMetrics('unknown')).toBeNull();
    expect(collector.completePipeline('unknown', 'failed')).toBeNull();
  });

  it('should get all metrics', () => {
    collector.startPipeline('task-a');
    collector.startPipeline('task-b');

    const all = collector.getAllMetrics();
    expect(all).toHaveLength(2);
  });

  it('should track revision count in totals', () => {
    collector.startPipeline('task-5');
    const timer = collector.startStage('task-5', 'implementation');
    timer.complete({ revisionCount: 2, status: 'revised' });

    const metrics = collector.getMetrics('task-5');
    expect(metrics!.totals.revisions).toBe(2);
  });
});

describe('Aggregator', () => {
  function createMetrics(overrides: Partial<PipelineMetrics> = {}): PipelineMetrics {
    return {
      taskId: 'task-1',
      startedAt: '2025-12-06T10:00:00Z',
      completedAt: '2025-12-06T10:15:00Z',
      totalDurationMs: 900000,
      stages: {
        analysis: {
          startedAt: '2025-12-06T10:00:00Z',
          completedAt: '2025-12-06T10:00:45Z',
          durationMs: 45000,
          model: 'gemini',
          tokensIn: 1200,
          tokensOut: 3500,
          apiCalls: 1,
          status: 'success',
          revisionCount: 0,
        },
        implementation: {
          startedAt: '2025-12-06T10:01:00Z',
          completedAt: '2025-12-06T10:11:00Z',
          durationMs: 600000,
          model: 'claude',
          tokensIn: 5000,
          tokensOut: 15000,
          apiCalls: 2,
          status: 'success',
          revisionCount: 1,
        },
      },
      totals: {
        tokensUsed: 24700,
        apiCalls: 3,
        revisions: 1,
        qualityDelta: 0,
      },
      outcome: 'completed',
      ...overrides,
    };
  }

  describe('generateReport', () => {
    it('should generate a report from pipeline metrics', () => {
      const metrics = [
        createMetrics(),
        createMetrics({ taskId: 'task-2' }),
        createMetrics({ taskId: 'task-3', outcome: 'failed' }),
      ];

      const report = generateReport(metrics);
      expect(report.summary.tasksCompleted).toBe(2);
      expect(report.summary.tasksFailed).toBe(1);
      expect(report.summary.successRate).toBeCloseTo(66.67, 0);
      expect(report.summary.avgDurationMs).toBe(900000);
      expect(report.summary.totalTokensUsed).toBe(74100);
    });

    it('should aggregate by stage', () => {
      const metrics = [createMetrics(), createMetrics({ taskId: 'task-2' })];
      const report = generateReport(metrics);

      expect(report.byStage['analysis']).toBeDefined();
      expect(report.byStage['analysis'].avgDurationMs).toBe(45000);
      expect(report.byStage['analysis'].failureRate).toBe(0);
      expect(report.byStage['implementation']).toBeDefined();
      expect(report.byStage['implementation'].revisionRate).toBe(100);
    });

    it('should return empty report for no metrics', () => {
      const report = generateReport([]);
      expect(report.summary.tasksCompleted).toBe(0);
      expect(report.summary.successRate).toBe(0);
      expect(report.byStage).toEqual({});
    });

    it('should calculate trends', () => {
      const metrics = [
        createMetrics({ taskId: 't1', totalDurationMs: 100000 }),
        createMetrics({ taskId: 't2', totalDurationMs: 110000 }),
        createMetrics({ taskId: 't3', totalDurationMs: 50000 }),
        createMetrics({ taskId: 't4', totalDurationMs: 40000 }),
      ];
      const report = generateReport(metrics);
      expect(report.trends.durationTrend).toBe('improving');
    });
  });

  describe('formatDashboard', () => {
    it('should produce a formatted dashboard string', () => {
      const report = generateReport([createMetrics()]);
      const dashboard = formatDashboard(report);

      expect(dashboard).toContain('PIPELINE METRICS');
      expect(dashboard).toContain('Completed');
      expect(dashboard).toContain('Failed');
      expect(dashboard).toContain('Success Rate');
      expect(dashboard).toContain('By Stage');
      expect(dashboard).toContain('Token Usage');
    });
  });

  describe('formatReportMarkdown', () => {
    it('should produce markdown report', () => {
      const report = generateReport([createMetrics()]);
      const markdown = formatReportMarkdown(report);

      expect(markdown).toContain('## Pipeline Metrics');
      expect(markdown).toContain('| Metric | Value |');
      expect(markdown).toContain('### By Stage');
      expect(markdown).toContain('### Trends');
    });
  });
});
