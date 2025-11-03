# Autonomous Mode Flags for All AIs

## Overview

All three AI CLIs now run in **fully autonomous mode** without asking for permissions or confirmations.

---

## AI Flags Summary

| AI | CLI Command | Autonomous Flags | Purpose |
|---|---|---|---|
| **Claude** | `claude` | `--dangerously-skip-permissions` | Skips all permission prompts |
| **Codex** | `codex` | `--yolo --sandbox danger-full-access` | Full autonomous mode with sandbox access |
| **Gemini** | `gemini` | `--yolo` | YOLO mode for autonomous operation |

---

## Detailed Flag Explanations

### Claude (Anthropic)

**Command:**
```bash
claude --dangerously-skip-permissions
```

**What it does:**
- Bypasses all security prompts
- Allows full file system access
- Executes bash commands without asking
- No confirmation dialogs

**Used in:**
- `lib/claude.js` → `launchClaude()`
- `lib/claude.js` → `fixTodoComments()`

**Example:**
```bash
(echo "y"; sleep 2; cat "$PROMPT_FILE") | claude --dangerously-skip-permissions
```

---

### Codex (OpenAI)

**Command:**
```bash
codex --yolo --sandbox danger-full-access
```

**Flags explained:**
- `--yolo` - "You Only Live Once" mode - autonomous operation
- `--sandbox danger-full-access` - Full sandbox access permissions

**What it does:**
- Runs in fully autonomous mode
- No permission prompts
- Full access to execute commands
- Bypasses safety confirmations

**Used in:**
- `lib/codex.js` → `launchCodex()` (implementation)
- `lib/codex.js` → `reviewClaudeChanges()` (code review)

**Example:**
```bash
(echo "y"; sleep 2; cat "$PROMPT_FILE") | codex --yolo --sandbox danger-full-access
```

**Note:** The exact flags might vary based on your Codex installation. Common alternatives:
- `--full-auto`
- `--no-confirm`
- `--danger-mode`

If `--yolo --sandbox danger-full-access` doesn't work, try:
```bash
codex --yolo
# or
codex --full-auto
# or
codex --no-confirm --sandbox full
```

---

### Gemini (Google)

**Command:**
```bash
gemini --yolo --prompt-file "prompt.txt"
```

**What it does:**
- Runs in YOLO (autonomous) mode
- Processes prompt file without confirmations
- No interactive prompts

**Used in:**
- `lib/gemini.js` → `analyzeTask()`

**Example:**
```bash
gemini --yolo --prompt-file "${promptFile}"
```

---

## Where These Flags Are Used

### 1. Gemini Analysis (`lib/gemini.js`)

**Line 85:**
```javascript
const { stdout } = await execAsync(
  `${config.system.geminiCliPath} --yolo --prompt-file "${promptFile}"`,
  {
    timeout: 120000,
    maxBuffer: 1024 * 1024 * 10
  }
);
```

**Purpose:** Creates feature specifications autonomously

---

### 2. Claude Implementation (`lib/claude.js`)

#### Initial Implementation

**Line 159:**
```bash
(echo "y"; sleep 2; cat "$PROMPT_FILE") | claude --dangerously-skip-permissions
```

**Purpose:** Implements features from Gemini's spec

#### TODO Fixes

**Line 275:**
```bash
(echo "y"; sleep 2; cat "$PROMPT_FILE") | claude --dangerously-skip-permissions
```

**Purpose:** Addresses TODO comments from Codex review

---

### 3. Codex Implementation & Review (`lib/codex.js`)

#### Implementation (Alternative to Claude)

**Line 158:**
```bash
(echo "y"; sleep 2; cat "$PROMPT_FILE") | codex --yolo --sandbox danger-full-access
```

**Purpose:** Implements features (when using Codex instead of Claude)

#### Code Review

**Line 288:**
```bash
(echo "y"; sleep 2; cat "$PROMPT_FILE") | codex --yolo --sandbox danger-full-access
```

**Purpose:** Reviews Claude's code and adds TODO comments

---

## Why Autonomous Mode?

### Benefits

1. **No Manual Intervention**
   - System runs 24/7 without human input
   - Can process multiple tasks overnight
   - Fully automated workflow

2. **Faster Execution**
   - No waiting for user confirmations
   - Immediate action on every step
   - Parallel task processing possible

3. **Consistent Behavior**
   - Always uses same security model
   - Predictable execution
   - No accidental denials

4. **Production Ready**
   - Designed for CI/CD integration
   - Scales to many tasks
   - Reliable automation

---

## Security Considerations

### ⚠️ Important Security Notes

**These flags bypass security prompts!**

1. **File System Access**
   - AIs can read/write ANY file in the repository
   - Can delete files
   - Can modify sensitive data

2. **Command Execution**
   - AIs can run ANY bash command
   - Can install packages
   - Can make network requests
   - Can access environment variables

3. **Git Operations**
   - AIs can commit and push code
   - Can create branches and PRs
   - Can modify git history (if instructed)

### 🛡️ Safety Measures

**How we mitigate risks:**

1. **Scoped to Repository**
   - AIs are instructed to work only in `${config.github.repoPath}`
   - Commands start with `cd ${repoPath}`

2. **Clear Instructions**
   - Prompts explicitly define allowed operations
   - Forbidden operations listed (no force push, no rebase, etc.)

3. **Review Process**
   - Codex reviews Claude's code
   - Multiple AIs validate changes
   - PRs require human approval before merge

4. **Tracking & Logging**
   - All operations tracked in pipeline
   - ClickUp updates for transparency
   - Git history shows all changes

5. **Branch Isolation**
   - Work happens on feature branches
   - Main branch protected
   - PRs required for merging

---

## Configuration

### Environment Variables

Configure CLI paths in `.env`:

```bash
# AI CLI Paths
CLAUDE_CLI_PATH=claude          # Default: 'claude'
CODEX_CLI_PATH=codex            # Default: 'codex'
GEMINI_CLI_PATH=gemini          # Default: 'gemini'

# Repository (for scoping)
GITHUB_REPO_PATH=/path/to/repo
```

### Verify CLIs Are Installed

```bash
# Check Claude
which claude
claude --version

# Check Codex
which codex
codex --version

# Check Gemini
which gemini
gemini --version
```

---

## Troubleshooting

### Issue: "Unknown flag --yolo"

**For Codex:**
Try alternative flags:
```bash
codex --full-auto
# or
codex --no-confirm
# or
codex --autonomous
```

Update `lib/codex.js` line 158 and 288 with the correct flag.

**For Gemini:**
Try:
```bash
gemini --no-confirm
# or
gemini --autonomous
```

Update `lib/gemini.js` line 85 with the correct flag.

---

### Issue: "Permission denied" errors

Even with autonomous flags, some operations might fail.

**Check:**
1. File permissions in repository
2. Git credentials configured
3. GitHub token has correct permissions

---

### Issue: AI still asks for confirmation

**Possible causes:**
1. Wrong flag syntax
2. Old version of CLI
3. Terminal input not being piped correctly

**Debug:**
```bash
# Test manually
echo "test prompt" | claude --dangerously-skip-permissions
echo "test prompt" | codex --yolo --sandbox danger-full-access
echo "test prompt" | gemini --yolo
```

---

## Testing Autonomous Mode

### Test Each AI

**Gemini:**
```bash
echo "Analyze this task: Add login feature" > test-prompt.txt
gemini --yolo --prompt-file test-prompt.txt
```

**Claude:**
```bash
echo "Implement a hello world function" | claude --dangerously-skip-permissions
```

**Codex:**
```bash
echo "Review this code: console.log('hello')" | codex --yolo --sandbox danger-full-access
```

All should execute without asking for confirmation.

---

## Flag Changes History

### v1.0 - Initial
- Claude: ✅ `--dangerously-skip-permissions`
- Codex: ❌ No flags
- Gemini: ❌ No flags

### v2.0 - Current
- Claude: ✅ `--dangerously-skip-permissions`
- Codex: ✅ `--yolo --sandbox danger-full-access`
- Gemini: ✅ `--yolo`

---

## Summary

All three AIs now run in **fully autonomous mode**:

| AI | Status | Flags |
|---|---|---|
| Claude | ✅ | `--dangerously-skip-permissions` |
| Codex | ✅ | `--yolo --sandbox danger-full-access` |
| Gemini | ✅ | `--yolo` |

**Result:** Complete end-to-end automation with no manual intervention required!

---

## Files Modified

- ✅ `lib/gemini.js` - Added `--yolo` flag
- ✅ `lib/codex.js` - Updated to `--yolo --sandbox danger-full-access` (2 places)
- ✅ `lib/claude.js` - Already using `--dangerously-skip-permissions`

---

## Quick Reference

```bash
# Gemini (Analysis)
gemini --yolo --prompt-file "prompt.txt"

# Claude (Implementation & Fixes)
claude --dangerously-skip-permissions

# Codex (Review & Alternative Implementation)
codex --yolo --sandbox danger-full-access
```

**All AIs are now fully autonomous! 🚀**
