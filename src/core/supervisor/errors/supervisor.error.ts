/**
 * Supervisor Error Classes
 * Custom errors for the supervisor system.
 */

import { BaseError } from '@/shared/errors/base.error';

export class SupervisorError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SUPERVISOR_ERROR', 500, true, context);
  }
}

export class SupervisorConfigError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SUPERVISOR_CONFIG_ERROR', 400, true, context);
  }
}

export class SupervisorValidationError extends BaseError {
  constructor(message: string, checks?: readonly { name: string; message: string }[]) {
    super(message, 'SUPERVISOR_VALIDATION_ERROR', 400, true, {
      failedChecks: checks,
    });
  }
}
