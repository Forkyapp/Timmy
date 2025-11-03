# Multi-AI Review Workflow

## Overview

This system implements a **collaborative AI workflow** where different AIs work together:

1. **Gemini** → Analyzes task and creates feature spec
2. **Claude** → Implements the feature
3. **Codex** → Reviews Claude's code and adds TODO comments
4. **Claude** → Fixes the TODO comments
5. **Final** → Polished, reviewed PR ready to merge

---

## Workflow Diagram

```
┌─────────────────────┐
│  Gemini Analysis    │
│  Creates spec with  │
│  files to modify    │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Claude              │
│ Implementation      │
│ - Creates branch    │
│ - Implements code   │
│ - Commits & pushes  │
│ - Creates PR        │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ PR Created          │
│ (tracked by system) │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Codex Review        │
│ - Checks out branch │
│ - Reviews changes   │
│ - Adds TODO comments│
│ - Commits TODOs     │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Claude Fixes        │
│ - Finds all TODOs   │
│ - Implements fixes  │
│ - Removes TODOs     │
│ - Updates PR        │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Final PR            │
│ Ready for review    │
└─────────────────────┘
```

---

## Stage Details

### Stage 1: Gemini Analysis

**File:** `lib/gemini.js`
**Function:** `analyzeTask(task)`

**What it does:**
- Creates feature specification in `features/{taskId}/feature-spec.md`
- Includes critical "Files to Modify" section
- Lists specific files that need changes
- Provides implementation guidance

**Output:**
```markdown
## Files to Modify
- `lib/auth.js` - Create authentication module
- `lib/api/user.js` - Add login endpoints
- `tests/auth.test.js` - Unit tests
```

---

### Stage 2: Claude Implementation

**File:** `lib/claude.js`
**Function:** `launchClaude(task, { analysis })`

**What it does:**
- Receives Gemini's feature spec
- Creates branch: `task-{taskId}`
- Implements the feature
- Commits changes
- Pushes to GitHub
- Creates Pull Request

**Terminal Output:**
```bash
cd /repo/path
git checkout -b task-123
# ... implements code ...
git add .
git commit -m "feat: Add user authentication (#123)"
git push -u origin task-123
gh pr create --title "[ClickUp #123] Add user authentication" ...
```

---

### Stage 3: Codex Review

**File:** `lib/codex.js`
**Function:** `reviewClaudeChanges(task)`

**What it does:**
- Checks out the branch Claude created
- Reviews all changes: `git diff main...task-{taskId}`
- Adds TODO comments inline in the code
- Commits the TODO comments

**Example TODO comments added by Codex:**

```javascript
// lib/auth.js

function login(email, password) {
  // TODO: Add validation for empty email
  // TODO: Handle error case when database is unavailable
  // TODO: Add rate limiting to prevent brute force attacks

  const user = db.findUser(email);
  return user && user.password === password;
}
```

**Commit message:**
```
review: Add TODO comments from Codex review (#123)
```

---

### Stage 4: Claude Fixes

**File:** `lib/claude.js`
**Function:** `fixTodoComments(task)`

**What it does:**
- Checks out the same branch
- Searches for all `// TODO:` comments
- Implements each improvement
- Removes TODO comment after fixing
- Commits all fixes

**Example fixes by Claude:**

```javascript
// lib/auth.js

function login(email, password) {
  // Validation added (TODO removed)
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email');
  }

  // Error handling added (TODO removed)
  try {
    const user = db.findUser(email);

    // Rate limiting added (TODO removed)
    if (rateLimiter.isLimited(email)) {
      throw new Error('Too many login attempts');
    }

    return user && user.password === password;
  } catch (error) {
    logger.error('Login failed:', error);
    throw error;
  }
}
```

**Commit message:**
```
fix: Address TODO comments from code review (#123)
```

---

## Pipeline Stages

The system tracks progress through these stages:

| Stage | Status | Description |
|-------|--------|-------------|
| `DETECTED` | ✅ | Task detected from ClickUp |
| `ANALYZING` | 🔄 | Gemini creating feature spec |
| `IMPLEMENTING` | 🔄 | Claude implementing feature |
| `PR_CREATING` | 🔄 | Creating Pull Request |
| `CODEX_REVIEWING` | 🔄 | Codex reviewing code |
| `CODEX_REVIEWED` | ✅ | TODO comments added |
| `CLAUDE_FIXING` | 🔄 | Claude fixing TODOs |
| `CLAUDE_FIXED` | ✅ | All TODOs addressed |
| `COMPLETED` | ✅ | Workflow complete |

**View pipeline status:**
```bash
cat pipeline-state.json
```

---

## Files Created During Workflow

```
project/
├── features/
│   └── {taskId}/
│       ├── prompt.txt              # Gemini's prompt
│       └── feature-spec.md         # Gemini's analysis
│
├── task-{taskId}-prompt.txt        # Claude implementation prompt (temp)
├── task-{taskId}-launch.sh         # Claude launch script (temp)
│
├── task-{taskId}-codex-review-prompt.txt  # Codex review prompt (temp)
├── task-{taskId}-codex-review.sh          # Codex review script (temp)
│
├── task-{taskId}-fix-todos-prompt.txt     # Claude fix prompt (temp)
└── task-{taskId}-fix-todos.sh             # Claude fix script (temp)
```

Temp files are automatically cleaned up after execution.

---

## ClickUp Updates

The system posts updates to ClickUp throughout the workflow:

### After Claude Implementation
```
🤖 Agent Deployed

Autonomous agent is now executing this task.

Branch: `task-123`
Status: Working autonomously

You'll be notified when the Pull Request is ready.
```

### After PR Creation
```
✅ Pull Request Created

PR #45: https://github.com/owner/repo/pull/45

Implementation complete and ready for review.
```

### After Codex Review
```
👀 Codex Code Review Started

Codex is reviewing Claude's implementation and adding TODO comments for improvements.

Branch: `task-123`
Next Step: Claude will address the TODO comments
```

### After Claude Fixes
```
🔧 Claude Fixing TODO Comments

Claude is now addressing all the TODO comments from Codex's review.

Branch: `task-123`
Final Step: PR will be updated with all improvements
```

---

## Configuration

### Enable Review Workflow

Add to `.env`:

```bash
# Enable full review workflow
USE_MULTI_AI=true
ENABLE_CODE_REVIEW=true    # New flag (coming soon)

# AI CLIs
CLAUDE_CLI_PATH=claude
CODEX_CLI_PATH=codex
GEMINI_CLI_PATH=gemini
```

---

## Manual Triggering (Future Enhancement)

Future versions will support manual triggering of each stage:

```bash
# Trigger Codex review manually
node scripts/trigger-review.js --task-id=123

# Trigger Claude fixes manually
node scripts/trigger-fixes.js --task-id=123
```

---

## Benefits of This Workflow

### 1. **Quality Assurance**
- Codex provides an independent review
- Catches edge cases Claude might have missed
- Ensures error handling and validation

### 2. **Best Practices**
- Codex suggests performance improvements
- Identifies security concerns
- Recommends code quality improvements

### 3. **Learning Loop**
- Claude learns from Codex's feedback
- Iterative improvement on the same branch
- Better final code quality

### 4. **Comprehensive Coverage**
- Gemini provides architectural guidance
- Claude implements the feature
- Codex reviews for improvements
- Claude polishes the implementation

### 5. **Automated Excellence**
- No manual intervention needed
- Consistent review quality
- Scalable to many tasks

---

## Example Full Workflow

### Task: "Add user authentication"

#### Step 1: Gemini Analysis
```markdown
# Feature Specification - Add User Authentication

## Files to Modify
- `lib/auth.js` - Create authentication module
- `lib/middleware/jwt.js` - JWT verification
- `routes/auth.js` - Login/logout routes
- `tests/auth.test.js` - Unit tests
```

#### Step 2: Claude Implementation
Claude creates:
- `lib/auth.js` with login/signup
- `lib/middleware/jwt.js` with JWT logic
- `routes/auth.js` with endpoints
- Basic tests

Commits: `feat: Add user authentication (#123)`

#### Step 3: Codex Review
Codex adds TODO comments:
```javascript
// lib/auth.js
// TODO: Add email validation
// TODO: Hash passwords with bcrypt
// TODO: Add rate limiting
// TODO: Test edge case with invalid JWT

// lib/middleware/jwt.js
// TODO: Handle expired tokens
// TODO: Add refresh token support

// tests/auth.test.js
// TODO: Add test for concurrent logins
// TODO: Test password reset flow
```

Commits: `review: Add TODO comments from Codex review (#123)`

#### Step 4: Claude Fixes
Claude addresses all TODOs:
- Adds email validation
- Implements bcrypt hashing
- Adds rate limiting
- Handles expired tokens
- Adds refresh tokens
- Writes comprehensive tests

Commits: `fix: Address TODO comments from code review (#123)`

#### Result
PR now has:
- Initial implementation
- Code review feedback
- All improvements implemented
- Comprehensive tests
- Production-ready code

---

## Troubleshooting

### Issue: Codex not adding TODO comments

**Check:**
1. Is Codex CLI installed? `which codex`
2. Is the branch created? `git branch | grep task-`
3. Check Codex terminal output for errors

### Issue: Claude not finding TODOs

**Debug:**
```bash
cd /repo/path
git checkout task-123
grep -r "TODO:" .
```

Should show TODOs added by Codex.

### Issue: Workflow stuck at review stage

**Manual intervention:**
```bash
# Check pipeline status
cat pipeline-state.json | jq '.["task-123"]'

# Manually trigger next stage if needed
```

---

## Future Enhancements

### 1. Automated Review Detection
- System waits for Codex review commit
- Automatically triggers Claude fixes
- No manual intervention needed

### 2. Review Metrics
- Track number of TODOs per task
- Measure code quality improvements
- Report on common issues found

### 3. Configurable Review Depth
```bash
# .env
CODEX_REVIEW_DEPTH=standard  # quick, standard, thorough
```

### 4. Multi-Round Reviews
- Codex reviews again after Claude fixes
- Continue until no TODOs remain
- Maximum N iterations

### 5. Review Summary Reports
Generate markdown summary:
```markdown
## Code Review Summary

**TODOs Added:** 8
**TODOs Fixed:** 8
**Review Time:** 3 minutes
**Fix Time:** 5 minutes

### Issues Found:
- Missing input validation (3)
- Error handling gaps (2)
- Performance improvements (2)
- Test coverage gaps (1)
```

---

## API Reference

### `lib/claude.js`

**`launchClaude(task, options)`**
- Implements feature from scratch
- Parameters:
  - `task` - ClickUp task object
  - `options.analysis` - Gemini feature spec (optional)
- Returns: `{ success, pid?, branch? }`

**`fixTodoComments(task, options)`**
- Addresses TODO comments from Codex
- Parameters:
  - `task` - ClickUp task object
- Returns: `{ success, branch }`

### `lib/codex.js`

**`launchCodex(task, options)`**
- Alternative to Claude for initial implementation
- Parameters:
  - `task` - ClickUp task object
  - `options.analysis` - Gemini feature spec (optional)
- Returns: `{ success, pid?, branch? }`

**`reviewClaudeChanges(task, options)`**
- Reviews Claude's implementation and adds TODOs
- Parameters:
  - `task` - ClickUp task object
- Returns: `{ success, branch }`

---

## Summary

The review workflow creates a **collaborative AI system** where:

1. **Gemini** provides architectural guidance
2. **Claude** implements the feature quickly
3. **Codex** reviews for quality and improvements
4. **Claude** polishes based on feedback

Result: **Higher quality code with automated review cycles**

🚀 **Status: Ready to use!**
