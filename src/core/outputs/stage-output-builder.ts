/**
 * StageOutputBuilder - Fluent builder for constructing typed stage outputs.
 *
 * Usage:
 *   const output = new StageOutputBuilder<AnalysisData>()
 *     .addUserLine('## Analysis Complete')
 *     .addUserLine('Found 5 requirements.')
 *     .setData({ requirements, filesToModify, acceptanceCriteria, technicalApproach })
 *     .setMetrics({ tokensUsed: 1234, duration: 45000, model: 'gemini' })
 *     .build();
 */

import type { StageOutput, InternalMetrics } from './types';

export class StageOutputBuilder<T> {
  private userLines: string[] = [];
  private outputData: Partial<T> = {};
  private metrics: InternalMetrics = {
    reasoning: [],
    tokensUsed: 0,
    duration: 0,
    model: 'unknown',
  };

  /**
   * Add a line to the user-facing summary.
   */
  addUserLine(line: string): this {
    this.userLines.push(line);
    return this;
  }

  /**
   * Set the user summary as a complete string (replaces any lines added).
   */
  setUserSummary(summary: string): this {
    this.userLines = [summary];
    return this;
  }

  /**
   * Set the structured data for this stage output.
   */
  setData(data: T): this {
    this.outputData = data;
    return this;
  }

  /**
   * Merge partial data into the existing data.
   */
  mergeData(partial: Partial<T>): this {
    this.outputData = { ...this.outputData, ...partial };
    return this;
  }

  /**
   * Set internal metrics (replaces existing).
   */
  setMetrics(metrics: Partial<InternalMetrics>): this {
    this.metrics = { ...this.metrics, ...metrics };
    return this;
  }

  /**
   * Add a reasoning step to internal metrics.
   */
  addReasoning(step: string): this {
    this.metrics.reasoning.push(step);
    return this;
  }

  /**
   * Set the model name.
   */
  setModel(model: string): this {
    this.metrics.model = model;
    return this;
  }

  /**
   * Set duration in milliseconds.
   */
  setDuration(durationMs: number): this {
    this.metrics.duration = durationMs;
    return this;
  }

  /**
   * Set token usage.
   */
  setTokensUsed(tokens: number): this {
    this.metrics.tokensUsed = tokens;
    return this;
  }

  /**
   * Build the final StageOutput.
   */
  build(): StageOutput<T> {
    return {
      userSummary: this.userLines.join('\n'),
      data: this.outputData as T,
      internal: { ...this.metrics },
    };
  }
}
