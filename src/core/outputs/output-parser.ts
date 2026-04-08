/**
 * AI Output Parser
 *
 * Extracts structured JSON data from AI responses.
 * Supports explicit JSON blocks (```json ... ```) and
 * fallback text-only parsing.
 */

import type { StageOutput, InternalMetrics } from './types';
import { logger } from '@/shared/utils/logger.util';

/**
 * Parse raw AI output into a StageOutput.
 *
 * Strategy:
 * 1. Look for ```json blocks and extract structured data
 * 2. Use remaining text as user summary
 * 3. If no JSON block found, return raw text as summary with empty data
 */
export function parseAIOutput<T>(
  rawOutput: string,
  defaultData: T,
  metrics?: Partial<InternalMetrics>
): StageOutput<T> {
  const jsonBlockPattern = /```json\s*\n([\s\S]*?)\n\s*```/;
  const match = rawOutput.match(jsonBlockPattern);

  const internalMetrics: InternalMetrics = {
    reasoning: [],
    tokensUsed: 0,
    duration: 0,
    model: 'unknown',
    ...metrics,
  };

  if (match) {
    try {
      const data = JSON.parse(match[1]) as T;
      const userSummary = rawOutput.replace(jsonBlockPattern, '').trim();

      return {
        userSummary: userSummary || 'Output processed successfully.',
        data,
        internal: internalMetrics,
      };
    } catch (error) {
      logger.warn('Failed to parse JSON block from AI output', {
        error: (error as Error).message,
      });
    }
  }

  // No valid JSON block found - return raw output as summary
  return {
    userSummary: rawOutput.trim(),
    data: defaultData,
    internal: {
      ...internalMetrics,
      fallbackExtraction: true,
    },
  };
}

/**
 * Extract multiple JSON blocks from AI output.
 * Useful when AI returns multiple structured sections.
 */
export function extractJsonBlocks(rawOutput: string): unknown[] {
  const jsonBlockPattern = /```json\s*\n([\s\S]*?)\n\s*```/g;
  const blocks: unknown[] = [];

  let match;
  while ((match = jsonBlockPattern.exec(rawOutput)) !== null) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch {
      logger.warn('Skipping invalid JSON block in AI output');
    }
  }

  return blocks;
}

/**
 * Try to extract a specific field from raw AI output using regex.
 * Useful for extracting key values when no JSON block is present.
 */
export function extractField(rawOutput: string, fieldPattern: RegExp): string | null {
  const match = rawOutput.match(fieldPattern);
  return match ? match[1].trim() : null;
}
