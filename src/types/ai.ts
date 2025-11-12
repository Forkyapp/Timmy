/**
 * AI Service Types
 * Types for AI agent interactions (Claude, Gemini, Codex)
 */

import { RepositoryConfig } from './config';

// Common AI types
export interface AIProgress {
  readonly agent: string;
  readonly taskId: string;
  readonly stage: string;
  readonly currentStep: string;
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly lastUpdate: string;
}

// Removed AIExecutionInfo - never used

// Claude types
export interface ClaudeSettings {
  readonly permissions: {
    readonly allow: readonly string[];
    readonly deny: readonly string[];
  };
  readonly hooks: {
    readonly [key: string]: string;
  };
}

export interface ClaudeLaunchOptions {
  readonly analysis?: {
    readonly content: string;
    readonly featureDir?: string;
    readonly featureSpecFile?: string;
  };
  // Removed subtask property - never accessed
  readonly branch?: string;
  readonly repoConfig?: RepositoryConfig;
}

export interface ClaudeLaunchResult {
  readonly success: boolean;
  readonly branch?: string;
  readonly logFile?: string;
  readonly progressFile?: string;
  readonly error?: string;
}

export interface ClaudeFixTodoOptions {
  readonly repoConfig?: RepositoryConfig;
}

export interface ClaudeFixTodoResult {
  readonly success: boolean;
  readonly branch?: string;
  readonly error?: string;
}

// Gemini types
// Removed GeminiAnalyzeTaskOptions - never imported (gemini.service.ts uses its own local type)

export interface GeminiAnalysisResult {
  readonly success: boolean;
  readonly featureSpecFile: string;
  readonly featureDir: string;
  readonly content: string;
  readonly logFile?: string;
  readonly progressFile?: string;
  readonly fallback?: boolean;
  readonly error?: string;
}

export interface GeminiFeatureSpec {
  readonly file: string;
  readonly content: string;
}

// Codex types
export interface CodexReviewOptions {
  readonly repoConfig?: RepositoryConfig;
}

export interface CodexReviewResult {
  readonly success: boolean;
  readonly branch?: string;
  readonly error?: string;
}

// Removed CodexLaunchOptions and CodexLaunchResult - related to removed launchCodex() function

// Qwen types
export interface QwenWriteTestsOptions {
  readonly repoConfig?: RepositoryConfig;
}

export interface QwenWriteTestsResult {
  readonly success: boolean;
  readonly branch?: string;
  readonly error?: string;
}

// Removed ExecWithPTYOptions - related to removed execWithPTY() function
// Removed ErrorWithCode - duplicate of same interface in retry.util.ts

// Backwards compatibility aliases
export type Settings = ClaudeSettings;
export type LaunchOptions = ClaudeLaunchOptions;
export type LaunchResult = ClaudeLaunchResult;
export type FixTodoOptions = ClaudeFixTodoOptions;
export type FixTodoResult = ClaudeFixTodoResult;
export type AnalysisResult = GeminiAnalysisResult;
export type FeatureSpec = GeminiFeatureSpec;
export type Progress = AIProgress;
export type ReviewOptions = CodexReviewOptions;
export type ReviewResult = CodexReviewResult;
