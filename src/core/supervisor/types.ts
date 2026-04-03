/**
 * Supervisor System Types
 * Type definitions for the supervisor configuration, environment, and lifecycle.
 */

/** Supported AI model identifiers */
export type ModelId = 'claude' | 'gemini' | 'codex';

/** Supervisor operating environment */
export type SupervisorEnvironment = 'development' | 'production';

/** Supervisor lifecycle status */
export type SupervisorStatus = 'initializing' | 'ready' | 'running' | 'paused' | 'stopped' | 'error';

/** Decision a supervisor can make after reviewing stage output */
export type SupervisorDecision = 'APPROVE' | 'REVISE' | 'REJECT' | 'ESCALATE';

/** Configuration for an individual AI model */
export interface ModelConfig {
  readonly id: ModelId;
  readonly cliPath: string;
  readonly enabled: boolean;
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

/** Safety limits for the supervisor system */
export interface SafetyLimits {
  readonly maxPipelineTimeoutMs: number;
  readonly maxStageRetries: number;
  readonly maxConcurrentTasks: number;
  readonly allowedRepoPaths: readonly string[];
}

/** Supervisor-specific configuration */
export interface SupervisorConfig {
  readonly environment: SupervisorEnvironment;
  readonly models: Record<ModelId, ModelConfig>;
  readonly safety: SafetyLimits;
  readonly logging: {
    readonly level: 'debug' | 'info' | 'warn' | 'error';
    readonly enableFileLogging: boolean;
    readonly logDir: string;
  };
}

/** Result of environment validation */
export interface ValidationResult {
  readonly valid: boolean;
  readonly checks: readonly ValidationCheck[];
}

/** Individual validation check */
export interface ValidationCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly message: string;
  readonly required: boolean;
}

/** Supervisor status report returned by the entry point */
export interface SupervisorStatusReport {
  readonly status: SupervisorStatus;
  readonly environment: SupervisorEnvironment;
  readonly validation: ValidationResult;
  readonly timestamp: string;
}
