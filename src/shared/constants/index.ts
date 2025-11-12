/**
 * Application Constants
 * Only contains constants that are actually used in the codebase
 */

// Pipeline stages - used by pipeline.repository.ts
export const PIPELINE_STAGES = {
  DETECTED: 'detected',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  IMPLEMENTING: 'implementing',
  IMPLEMENTED: 'implemented',
  CODEX_REVIEWING: 'codex_reviewing',
  CODEX_REVIEWED: 'codex_reviewed',
  QWEN_TESTING: 'qwen_testing',
  QWEN_TESTED: 'qwen_tested',
  CLAUDE_FIXING: 'claude_fixing',
  CLAUDE_FIXED: 'claude_fixed',
  MERGING: 'merging',
  MERGED: 'merged',
  PR_CREATING: 'pr_creating',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// Pipeline statuses - used by pipeline.repository.ts
export const PIPELINE_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

// Removed unused constants (~170 lines):
// - DEFAULT_CONFIG, FILE_PATHS, CLI_COMMANDS, CLICKUP_COMMANDS
// - CLICKUP_STATUS, BRANCH_PREFIX, CLAUDE_BRANCH_PREFIX, ERROR_CODES
// - HTTP_STATUS, RETRY_CONFIG, AI_AGENTS, REVIEW_CONFIG
// - REGEX_PATTERNS, ENV_KEYS
//
// These were defined but never imported/used anywhere in the codebase.
// If needed in future, add them back individually when actually used.
