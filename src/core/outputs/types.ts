/**
 * Structured Output Types
 *
 * Every pipeline stage produces a StageOutput<T> with three layers:
 * 1. userSummary - Clean markdown for ClickUp/human display
 * 2. data - Typed JSON for programmatic use / next stage
 * 3. internal - Debug/logging metrics
 */

import type { QualityReport } from '../quality/types';

// ─── Core Output Interface ───────────────────────────────────

export interface InternalMetrics {
  reasoning: string[];
  tokensUsed: number;
  duration: number;
  model: string;
  confidence?: number;
  fallbackExtraction?: boolean;
  [key: string]: unknown;
}

export interface StageOutput<T> {
  /** Clean markdown summary for humans (ClickUp comments) */
  userSummary: string;
  /** Typed structured data for machines (next stage input) */
  data: T;
  /** Debug info for logging */
  internal: InternalMetrics;
}

// ─── Stage-Specific Data Types ───────────────────────────────

export interface EARSRequirement {
  type: 'ubiquitous' | 'event-driven' | 'state-driven' | 'unwanted' | 'optional';
  text: string;
}

export interface FileChange {
  path: string;
  action: 'create' | 'modify' | 'delete';
  description: string;
}

export interface AcceptanceCriterion {
  given: string;
  when: string;
  then: string;
}

export interface AnalysisData {
  requirements: EARSRequirement[];
  filesToModify: FileChange[];
  acceptanceCriteria: AcceptanceCriterion[];
  technicalApproach: string[];
}

export interface ImplementationData {
  branch: string;
  commits: { hash: string; message: string }[];
  filesChanged: string[];
  testsAdded: string[];
}

export interface ReviewIssue {
  severity: 'error' | 'warning' | 'info';
  file: string;
  description: string;
}

export interface ReviewData {
  decision: 'approve' | 'revise' | 'reject';
  issues: ReviewIssue[];
  suggestions: string[];
  qualityReport?: QualityReport;
}

export interface SupervisorData {
  decision: 'APPROVE' | 'REVISE' | 'REJECT' | 'ESCALATE';
  reasoning: string[];
  feedback?: string;
  nextAction: string;
}

export interface FixesData {
  branch: string;
  issuesFixed: number;
  issuesSkipped: number;
  details: string[];
}

// ─── Typed Stage Outputs ─────────────────────────────────────

export type AnalysisOutput = StageOutput<AnalysisData>;
export type ImplementationOutput = StageOutput<ImplementationData>;
export type ReviewOutput = StageOutput<ReviewData>;
export type SupervisorOutput = StageOutput<SupervisorData>;
export type FixesOutput = StageOutput<FixesData>;
