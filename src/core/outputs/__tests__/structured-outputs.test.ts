import { StageOutputBuilder } from '../stage-output-builder';
import { parseAIOutput, extractJsonBlocks, extractField } from '../output-parser';
import type { AnalysisData, ImplementationData } from '../types';

describe('StageOutputBuilder', () => {
  it('should build a complete stage output', () => {
    const output = new StageOutputBuilder<AnalysisData>()
      .addUserLine('## Analysis Complete')
      .addUserLine('Found 2 requirements.')
      .setData({
        requirements: [
          { type: 'ubiquitous', text: 'The system SHALL validate input' },
          { type: 'event-driven', text: 'WHEN user clicks, the system SHALL respond' },
        ],
        filesToModify: [{ path: 'src/auth.ts', action: 'modify', description: 'Add validation' }],
        acceptanceCriteria: [{ given: 'valid input', when: 'submitted', then: 'accepted' }],
        technicalApproach: ['Use JWT tokens'],
      })
      .setMetrics({ tokensUsed: 1000, duration: 5000, model: 'gemini' })
      .build();

    expect(output.userSummary).toBe('## Analysis Complete\nFound 2 requirements.');
    expect(output.data.requirements).toHaveLength(2);
    expect(output.data.filesToModify).toHaveLength(1);
    expect(output.internal.tokensUsed).toBe(1000);
    expect(output.internal.model).toBe('gemini');
  });

  it('should support fluent chaining', () => {
    const output = new StageOutputBuilder<ImplementationData>()
      .setModel('claude')
      .setDuration(30000)
      .setTokensUsed(5000)
      .addReasoning('Read task description')
      .addReasoning('Identified affected files')
      .addUserLine('Implementation complete.')
      .setData({
        branch: 'task-123',
        commits: [{ hash: 'abc123', message: 'feat: add login' }],
        filesChanged: ['src/auth.ts'],
        testsAdded: ['src/__tests__/auth.test.ts'],
      })
      .build();

    expect(output.internal.model).toBe('claude');
    expect(output.internal.duration).toBe(30000);
    expect(output.internal.reasoning).toHaveLength(2);
    expect(output.data.branch).toBe('task-123');
  });

  it('should support mergeData', () => {
    const output = new StageOutputBuilder<ImplementationData>()
      .mergeData({ branch: 'task-456' })
      .mergeData({ filesChanged: ['file1.ts'] })
      .addUserLine('Done')
      .build();

    expect(output.data.branch).toBe('task-456');
    expect(output.data.filesChanged).toEqual(['file1.ts']);
  });

  it('should support setUserSummary to replace lines', () => {
    const output = new StageOutputBuilder<AnalysisData>()
      .addUserLine('This will be replaced')
      .setUserSummary('Complete replacement summary')
      .build();

    expect(output.userSummary).toBe('Complete replacement summary');
  });

  it('should have sensible defaults', () => {
    const output = new StageOutputBuilder<{}>().build();
    expect(output.userSummary).toBe('');
    expect(output.internal.model).toBe('unknown');
    expect(output.internal.tokensUsed).toBe(0);
    expect(output.internal.reasoning).toEqual([]);
  });
});

describe('parseAIOutput', () => {
  it('should extract JSON block from AI response', () => {
    const rawOutput = `## Analysis Complete

I found the following requirements.

\`\`\`json
{
  "requirements": [
    { "type": "ubiquitous", "text": "The system SHALL validate" }
  ],
  "filesToModify": [],
  "acceptanceCriteria": [],
  "technicalApproach": []
}
\`\`\`

That concludes my analysis.`;

    const defaultData: AnalysisData = {
      requirements: [],
      filesToModify: [],
      acceptanceCriteria: [],
      technicalApproach: [],
    };

    const result = parseAIOutput<AnalysisData>(rawOutput, defaultData);
    expect(result.data.requirements).toHaveLength(1);
    expect(result.data.requirements[0].text).toBe('The system SHALL validate');
    expect(result.userSummary).toContain('Analysis Complete');
    expect(result.userSummary).not.toContain('```json');
  });

  it('should return default data when no JSON block found', () => {
    const rawOutput = 'Just a plain text response with no JSON.';
    const defaultData: AnalysisData = {
      requirements: [],
      filesToModify: [],
      acceptanceCriteria: [],
      technicalApproach: ['fallback'],
    };

    const result = parseAIOutput<AnalysisData>(rawOutput, defaultData);
    expect(result.data).toEqual(defaultData);
    expect(result.userSummary).toBe('Just a plain text response with no JSON.');
    expect(result.internal.fallbackExtraction).toBe(true);
  });

  it('should handle invalid JSON gracefully', () => {
    const rawOutput = `Here is data:

\`\`\`json
{ invalid json here
\`\`\``;

    const defaultData = { branch: 'unknown', commits: [], filesChanged: [], testsAdded: [] };
    const result = parseAIOutput<ImplementationData>(rawOutput, defaultData);
    expect(result.data).toEqual(defaultData);
    expect(result.internal.fallbackExtraction).toBe(true);
  });

  it('should include provided metrics', () => {
    const result = parseAIOutput('text', {}, {
      model: 'gemini',
      tokensUsed: 500,
    });
    expect(result.internal.model).toBe('gemini');
    expect(result.internal.tokensUsed).toBe(500);
  });
});

describe('extractJsonBlocks', () => {
  it('should extract multiple JSON blocks', () => {
    const text = `
Some text

\`\`\`json
{"a": 1}
\`\`\`

More text

\`\`\`json
{"b": 2}
\`\`\`
`;
    const blocks = extractJsonBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ a: 1 });
    expect(blocks[1]).toEqual({ b: 2 });
  });

  it('should skip invalid JSON blocks', () => {
    const text = `
\`\`\`json
{"valid": true}
\`\`\`

\`\`\`json
not valid json
\`\`\`
`;
    const blocks = extractJsonBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ valid: true });
  });

  it('should return empty array when no blocks', () => {
    expect(extractJsonBlocks('no json here')).toEqual([]);
  });
});

describe('extractField', () => {
  it('should extract field matching pattern', () => {
    const text = 'Branch: task-123\nStatus: complete';
    expect(extractField(text, /Branch:\s*(.+)/)).toBe('task-123');
  });

  it('should return null when no match', () => {
    expect(extractField('no match here', /Branch:\s*(.+)/)).toBeNull();
  });
});
