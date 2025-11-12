/**
 * Common/Shared Types
 * Reusable types used across multiple domains
 */

// Removed unused generic result types:
// - SuccessResult, ErrorResult, Result<T>
// Services use specific result types instead (LaunchResult, ReviewResult, etc.)

export interface ExecResult {
  readonly stdout: string;
  readonly stderr: string;
}

// Removed RetryableOperation<T> - never used (retry.util uses inline function types)

export interface RetryOptions {
  readonly maxAttempts?: number;
  readonly delayMs?: number;
  readonly backoffFactor?: number;
  readonly maxDelayMs?: number;
  readonly onRetry?: (attempt: number, error: Error) => void;
}

// Removed ValidationError and ValidationResult interfaces
// These are orphaned - there's a different ValidationError CLASS in shared/errors/ that's actually used
