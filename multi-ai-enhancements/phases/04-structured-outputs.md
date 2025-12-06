# Phase 04: Structured Outputs

## Problem

AI outputs are unstructured text. Same data used for:
- ClickUp comments (human-readable)
- Next pipeline stage (machine-readable)
- Logging (debug info)

Result: Parsing errors, inconsistent formats, lost metadata.

## Solution

Separate output into three layers:
1. **User Summary** - Clean markdown for humans
2. **Structured Data** - Typed JSON for machines
3. **Internal Metrics** - Debug info for logging

## Features

### 1. Output Interface

```typescript
interface StageOutput<T> {
  // For ClickUp comments / user display
  userSummary: string;

  // For next stage / programmatic use
  data: T;

  // For logging / debugging
  internal: {
    reasoning: string[];
    tokensUsed: number;
    duration: number;
    model: string;
    confidence?: number;
  };
}

// Stage-specific data types
interface AnalysisData {
  requirements: EARSRequirement[];
  filesToModify: FileChange[];
  acceptanceCriteria: AcceptanceCriterion[];
}

interface ImplementationData {
  branch: string;
  commits: Commit[];
  filesChanged: string[];
  testsAdded: string[];
}

interface ReviewData {
  decision: 'approve' | 'revise' | 'reject';
  issues: Issue[];
  suggestions: string[];
  qualityScore: number;
}
```

---

### 2. Output Builder

Helper to construct outputs:

```typescript
class StageOutputBuilder<T> {
  private userSummary: string[] = [];
  private data: Partial<T> = {};
  private internal: InternalMetrics = {};

  addUserLine(line: string): this {
    this.userSummary.push(line);
    return this;
  }

  setData(data: T): this {
    this.data = data;
    return this;
  }

  setMetrics(metrics: Partial<InternalMetrics>): this {
    this.internal = { ...this.internal, ...metrics };
    return this;
  }

  build(): StageOutput<T> {
    return {
      userSummary: this.userSummary.join('\n'),
      data: this.data as T,
      internal: this.internal
    };
  }
}

// Usage
const output = new StageOutputBuilder<AnalysisData>()
  .addUserLine('## Analysis Complete')
  .addUserLine('Found 5 requirements and 3 files to modify.')
  .setData({
    requirements: parsedRequirements,
    filesToModify: files,
    acceptanceCriteria: criteria
  })
  .setMetrics({ tokensUsed: 1234, duration: 45000 })
  .build();
```

---

### 3. AI Output Parsing

Extract structured data from AI response:

```typescript
async function parseAIOutput<T>(
  rawOutput: string,
  schema: OutputSchema<T>
): Promise<StageOutput<T>> {
  // Try to extract JSON block if present
  const jsonMatch = rawOutput.match(/```json\n([\s\S]*?)\n```/);

  if (jsonMatch) {
    const data = JSON.parse(jsonMatch[1]) as T;
    const userSummary = rawOutput.replace(/```json[\s\S]*?```/, '').trim();
    return { userSummary, data, internal: {} };
  }

  // Fall back to AI extraction
  const extractionPrompt = buildExtractionPrompt(rawOutput, schema);
  const extracted = await callModel('claude-haiku', extractionPrompt);

  return {
    userSummary: rawOutput,
    data: JSON.parse(extracted) as T,
    internal: { fallbackExtraction: true }
  };
}
```

---

### 4. Prompt Instructions

Tell AI to output structured data:

```markdown
## Output Format

Your response MUST include TWO sections:

### 1. Summary (for humans)
Write a clear markdown summary of your analysis/implementation.

### 2. Structured Data (for machines)
Include a JSON block with the following schema:

\`\`\`json
{
  "requirements": [...],
  "filesToModify": [...],
  "acceptanceCriteria": [...]
}
\`\`\`

The JSON block will be parsed programmatically. Ensure it is valid JSON.
```

---

### 5. Stage Result Types

Each stage has typed output:

```typescript
// Analysis stage
type AnalysisOutput = StageOutput<{
  requirements: EARSRequirement[];
  filesToModify: FileChange[];
  acceptanceCriteria: AcceptanceCriterion[];
  technicalApproach: string[];
}>;

// Implementation stage
type ImplementationOutput = StageOutput<{
  branch: string;
  commits: { hash: string; message: string }[];
  filesChanged: string[];
  testsAdded: string[];
}>;

// Review stage
type ReviewOutput = StageOutput<{
  decision: 'approve' | 'revise' | 'reject';
  issues: { severity: string; file: string; description: string }[];
  suggestions: string[];
  qualityReport: QualityReport;
}>;

// Supervisor decision
type SupervisorOutput = StageOutput<{
  decision: 'APPROVE' | 'REVISE' | 'REJECT' | 'ESCALATE';
  reasoning: string[];
  feedback?: string;
  nextAction: string;
}>;
```

---

### 6. ClickUp Posting

Only post user summary to ClickUp:

```typescript
async function postStageResult(
  taskId: string,
  stage: string,
  output: StageOutput<unknown>
): Promise<void> {
  // Post clean summary to ClickUp
  await clickup.addComment(taskId, `## ${stage}\n\n${output.userSummary}`);

  // Log full output internally
  logger.info(`Stage ${stage} complete`, {
    taskId,
    data: output.data,
    metrics: output.internal
  });

  // Store structured data for next stage
  await storage.pipeline.updateStageData(taskId, stage, output.data);
}
```

---

## Success Criteria

- [ ] StageOutput interface defined
- [ ] Output builder implemented
- [ ] AI output parsing working
- [ ] Prompts updated to request JSON blocks
- [ ] Each stage returns typed output
- [ ] ClickUp receives clean summaries
- [ ] Structured data passed between stages

## Effort Estimate

- Types and interfaces: 1 hour
- Output builder: 2 hours
- AI parsing: 2 hours
- Prompt updates: 2 hours
- Stage integration: 3 hours
- Testing: 2 hours

**Total: ~1.5 days**
