# Phase 01: Skills System

## Problem

Prompts are hardcoded in TypeScript files. To update how Gemini analyzes tasks or how Claude implements features, you must:

1. Find the right `.ts` file
2. Modify string literals
3. Rebuild the project
4. Redeploy

This is slow and error-prone.

## Solution

Store prompts as markdown files in a `skills/` directory. Load them at runtime. Update prompts without code changes.

## Features

### 1. Skills Directory Structure

```
src/core/skills/
├── analysis/
│   ├── SKILL.md              # Main skill definition
│   ├── ears-format.md        # EARS requirement syntax
│   └── templates/
│       └── feature-spec.md   # Output template
│
├── implementation/
│   ├── SKILL.md
│   ├── typescript.md         # TS-specific patterns
│   ├── testing.md            # Testing approach
│   └── error-handling.md
│
├── review/
│   ├── SKILL.md
│   ├── security-checklist.md
│   ├── performance.md
│   └── code-style.md
│
└── supervisor/
    ├── SKILL.md
    ├── business-rules.yaml   # Company-specific rules
    └── quality-gates.yaml    # TRUST 5 thresholds
```

**Why:** Organized, discoverable, easy to update.

---

### 2. Skill Loader

```typescript
// src/core/skills/loader.ts
async function loadSkill(name: string): Promise<string> {
  const skillPath = path.join(SKILLS_DIR, name, 'SKILL.md');
  return fs.readFile(skillPath, 'utf8');
}

async function loadSkillWithDeps(name: string): Promise<string> {
  const skill = await loadSkill(name);
  const deps = extractDependencies(skill); // Parse @include directives
  const depContents = await Promise.all(deps.map(loadSkill));
  return [skill, ...depContents].join('\n\n');
}
```

**Why:** Simple API. Handles dependencies between skills.

---

### 3. Skill Format

Each skill follows a standard format:

```markdown
# Skill: Analysis

## Role
You are a senior software architect analyzing development tasks.

## Dependencies
@include ears-format.md
@include templates/feature-spec.md

## Instructions
1. Read the task description carefully
2. Identify affected files and modules
3. Output specification in EARS format

## Output Format
Use the feature-spec template.

## Examples
[Include 1-2 examples of good output]
```

**Why:** Consistent structure. Easy to understand and modify.

---

### 4. Runtime Injection

Skills injected into AI prompts:

```typescript
// Before (hardcoded)
const prompt = `You are a senior software architect...
  ${taskDescription}
  Please provide: 1. Feature Overview...`;

// After (skill-based)
const analysisSkill = await loadSkillWithDeps('analysis');
const prompt = `${analysisSkill}\n\n## Task\n${taskDescription}`;
```

**Why:** Same result, but prompt lives in editable file.

---

### 5. Hot Reload (Optional)

Watch skills directory for changes:

```typescript
if (process.env.NODE_ENV === 'development') {
  watchSkillsDirectory((changedSkill) => {
    skillCache.invalidate(changedSkill);
    console.log(`Skill ${changedSkill} reloaded`);
  });
}
```

**Why:** Iterate on prompts without restarting.

---

## Migration Path

1. Extract current prompts from `gemini.service.ts` → `skills/analysis/`
2. Extract from `claude.service.ts` → `skills/implementation/`
3. Extract from `codex.service.ts` → `skills/review/`
4. Update services to use `loadSkill()`

## Success Criteria

- [ ] Skills directory created with initial skills
- [ ] Skill loader implemented
- [ ] Gemini uses loaded skill
- [ ] Claude uses loaded skill
- [ ] Codex uses loaded skill
- [ ] Can update prompt without code change

## Effort Estimate

- Directory structure: 1 hour
- Skill loader: 2 hours
- Migration: 3 hours
- Testing: 2 hours

**Total: ~1 day**
