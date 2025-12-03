/**
 * Test Pattern Loader
 *
 * Loads example test files from the codebase to provide Claude with
 * context about how tests should be written following project patterns.
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Test pattern context for Claude
 */
export interface TestPatternContext {
  /** Example test files content */
  examples: string;
  /** Summary of patterns found */
  summary: string;
}

/**
 * Options for loading test patterns
 */
export interface LoadTestPatternsOptions {
  /** Repository path to search */
  repoPath: string;
  /** Maximum number of example files to include */
  maxExamples?: number;
  /** Maximum lines per example file */
  maxLinesPerFile?: number;
}

/**
 * Recursively find test files in a directory
 */
async function findTestFiles(
  dir: string,
  testFiles: string[] = [],
  depth: number = 0
): Promise<string[]> {
  // Limit recursion depth to avoid performance issues
  if (depth > 10) return testFiles;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip common directories
      if (
        entry.isDirectory() &&
        !['node_modules', 'dist', 'build', '.git', 'coverage'].includes(entry.name)
      ) {
        await findTestFiles(fullPath, testFiles, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
        testFiles.push(fullPath);
      }
    }
  } catch {
    // Ignore errors reading directories
  }

  return testFiles;
}

/**
 * Load test pattern examples from the codebase
 *
 * Finds and loads example test files to provide Claude with context
 * about how tests should be written following the project's patterns.
 *
 * @param options - Options for loading patterns
 * @returns Test pattern context for Claude
 */
export async function loadTestPatterns(
  options: LoadTestPatternsOptions
): Promise<TestPatternContext> {
  const { repoPath, maxExamples = 3, maxLinesPerFile = 150 } = options;

  const examples: string[] = [];

  try {
    // Find all test files
    const testFiles = await findTestFiles(repoPath);

    // Sort by modification time (most recent first) and limit
    const fileStats = await Promise.all(
      testFiles.map(async (file) => {
        try {
          const stats = await fs.stat(file);
          return { file, mtime: stats.mtime.getTime() };
        } catch {
          return { file, mtime: 0 };
        }
      })
    );

    const sortedFiles = fileStats
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, maxExamples)
      .map((f) => f.file);

    // Load content from selected files
    for (const filePath of sortedFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const truncatedContent =
          lines.length > maxLinesPerFile
            ? lines.slice(0, maxLinesPerFile).join('\n') + '\n// ... (truncated)'
            : content;

        const relativePath = path.relative(repoPath, filePath);
        examples.push(`// File: ${relativePath}\n${truncatedContent}`);
      } catch {
        // Skip files we can't read
      }
    }

    // Build summary of patterns found
    const summary = buildPatternSummary(examples);

    return {
      examples: examples.join('\n\n' + '='.repeat(80) + '\n\n'),
      summary,
    };
  } catch {
    // Return empty context if we can't find patterns
    return {
      examples: '',
      summary: 'Could not load test patterns from codebase.',
    };
  }
}

/**
 * Build a summary of the testing patterns found
 */
function buildPatternSummary(examples: string[]): string {
  if (examples.length === 0) {
    return 'No test examples found in codebase.';
  }

  const patterns: string[] = [];
  const fullText = examples.join('\n');

  // Detect testing framework
  if (fullText.includes('jest.mock') || fullText.includes('jest.fn')) {
    patterns.push('- Testing framework: Jest');
  }

  // Detect describe/it pattern
  if (fullText.includes('describe(') && fullText.includes('it(')) {
    patterns.push('- Test structure: describe/it blocks');
  }

  // Detect beforeEach/afterEach
  if (fullText.includes('beforeEach(')) {
    patterns.push('- Setup: Uses beforeEach for test setup');
  }
  if (fullText.includes('afterEach(')) {
    patterns.push('- Cleanup: Uses afterEach for cleanup');
  }

  // Detect mocking patterns
  if (fullText.includes('jest.mock(')) {
    patterns.push('- Mocking: Uses jest.mock() for module mocking');
  }
  if (fullText.includes('mockResolvedValue') || fullText.includes('mockReturnValue')) {
    patterns.push('- Mock values: Uses mockResolvedValue/mockReturnValue');
  }

  // Detect assertion style
  if (fullText.includes('expect(')) {
    patterns.push('- Assertions: Uses Jest expect() assertions');
  }
  if (fullText.includes('.toThrow')) {
    patterns.push('- Error testing: Uses .toThrow() for error assertions');
  }

  // Detect async patterns
  if (fullText.includes('async () =>') || fullText.includes('await ')) {
    patterns.push('- Async: Uses async/await pattern');
  }

  // Detect type imports
  if (fullText.includes('import type')) {
    patterns.push('- TypeScript: Uses "import type" for type imports');
  }

  // Detect mock factories
  if (fullText.includes('createMock')) {
    patterns.push('- Factories: Uses mock factory functions');
  }

  if (patterns.length === 0) {
    return `Found ${examples.length} test example(s) but could not detect specific patterns.`;
  }

  return `Detected testing patterns:\n${patterns.join('\n')}`;
}

/**
 * Format test patterns for inclusion in a Claude prompt
 *
 * @param context - The test pattern context
 * @returns Formatted string for Claude prompt
 */
export function formatTestPatternsForPrompt(context: TestPatternContext): string {
  if (!context.examples) {
    return '';
  }

  return `
**TEST PATTERNS FROM CODEBASE:**

${context.summary}

**Example Test Files:**
Follow these patterns exactly when writing tests:

${context.examples}

**IMPORTANT TEST WRITING RULES:**
1. Follow the EXACT same structure as the examples above
2. Use the same mocking patterns (jest.mock, jest.fn, etc.)
3. Use the same describe/it block structure
4. Use the same beforeEach/afterEach patterns
5. Use the same assertion style (expect().toBe(), expect().toThrow(), etc.)
6. Place tests in __tests__ folders next to the source files
7. Name test files with .test.ts extension
8. Mock external dependencies, don't call real APIs
9. Test both success and error paths
`;
}
