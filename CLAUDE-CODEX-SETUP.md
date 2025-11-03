# Claude & Codex - Dual AI Support

## Overview

The system now supports **both** Claude (Anthropic) and Codex (OpenAI) as AI implementation agents.

You can choose which AI to use via environment variable configuration.

---

## File Structure

### New Files Created
- ✅ **`lib/codex.js`** - Codex (OpenAI) implementation agent
- ✅ **`lib/claude.js`** - Claude (Anthropic) implementation agent (reverted from previous changes)

### Updated Files
- ✅ **`lib/config.js`** - Added `AI_PROVIDER` configuration
- ✅ **`lib/orchestrator.js`** - Now supports both Claude and Codex dynamically

---

## Configuration

### Environment Variable

Add to your `.env` file:

```bash
# AI Provider Selection
AI_PROVIDER=claude    # Options: 'claude' or 'codex'
```

**Default:** If not set, defaults to `claude`

### CLI Paths (Optional)

You can also configure custom paths for each CLI:

```bash
# Optional: Custom CLI paths
CLAUDE_CLI_PATH=claude
CODEX_CLI_PATH=codex
GEMINI_CLI_PATH=gemini
```

---

## How It Works

### Workflow

```
1. Gemini Analysis (Feature Spec Generation)
   ↓
2. AI Implementation (Claude OR Codex based on config)
   ↓
3. PR Creation & Tracking
```

### AI Selection Logic

The orchestrator (`lib/orchestrator.js`) automatically:
1. Reads `config.system.aiProvider` from environment
2. Selects the appropriate module (`lib/claude.js` or `lib/codex.js`)
3. Calls the correct launch function
4. Tracks the AI provider in pipeline metadata

**Code:**
```javascript
const aiProvider = config.system.aiProvider;  // 'claude' or 'codex'
const aiModule = aiProvider === 'codex' ? codex : claude;
const launchFunction = aiProvider === 'codex'
  ? aiModule.launchCodex
  : aiModule.launchClaude;

const result = await launchFunction(task, { analysis });
```

---

## Differences Between Claude & Codex

### `lib/claude.js`

**Command:** `claude`
**Function:** `launchClaude(task, options)`
**Settings Directory:** `.claude/`
**Launch Script:** `task-{taskId}-launch.sh`
**Prompt File:** `task-{taskId}-prompt.txt`
**ClickUp Comment:** "Agent Deployed"
**PR Attribution:** "Automated via Devin"

### `lib/codex.js`

**Command:** `codex`
**Function:** `launchCodex(task, options)`
**Settings Directory:** `.claude/` (shared)
**Launch Script:** `task-{taskId}-codex-launch.sh`
**Prompt File:** `task-{taskId}-codex-prompt.txt`
**ClickUp Comment:** "Codex Agent Deployed"
**PR Attribution:** "Automated via Devin (Codex)"

---

## Usage Examples

### Use Claude (Anthropic)

```bash
# .env
AI_PROVIDER=claude
```

```bash
node local/devin.js
```

Output:
```
🤖 JARVIS » Deploying agent for task-123: "Add feature"
✓ Agent active on task-123
```

### Use Codex (OpenAI)

```bash
# .env
AI_PROVIDER=codex
```

```bash
node local/devin.js
```

Output:
```
🤖 JARVIS » Deploying Codex agent for task-123: "Add feature"
✓ Codex agent active on task-123
```

---

## Pipeline Metadata

The pipeline now tracks which AI provider was used:

```json
{
  "taskId": "abc123",
  "currentStage": "implementing",
  "metadata": {
    "aiProvider": "codex",
    "aiInstances": [
      {
        "provider": "codex",
        "type": "main",
        "branch": "task-abc123",
        "pid": 12345,
        "startedAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "geminiAnalysis": {
      "file": "features/abc123/feature-spec.md",
      "fallback": false
    }
  }
}
```

---

## Testing

### Test Claude

```bash
# .env
AI_PROVIDER=claude

# Run
node local/devin.js
```

1. Create a ClickUp task with status "bot in progress"
2. Check that Claude is launched
3. Verify terminal shows "Agent Deployed"
4. Check pipeline metadata shows `"aiProvider": "claude"`

### Test Codex

```bash
# .env
AI_PROVIDER=codex

# Run
node local/devin.js
```

1. Create a ClickUp task with status "bot in progress"
2. Check that Codex is launched
3. Verify terminal shows "Codex Agent Deployed"
4. Check pipeline metadata shows `"aiProvider": "codex"`

---

## Troubleshooting

### Issue: "codex: command not found"

**Solution:** Make sure Codex CLI is installed and in PATH

```bash
which codex
# Should output: /path/to/codex

# Or set custom path in .env
CODEX_CLI_PATH=/full/path/to/codex
```

### Issue: "claude: command not found"

**Solution:** Make sure Claude Code CLI is installed

```bash
which claude
# Should output: /path/to/claude

# Or set custom path in .env
CLAUDE_CLI_PATH=/full/path/to/claude
```

### Issue: Wrong AI is being used

**Check `.env` file:**
```bash
cat .env | grep AI_PROVIDER
```

Should output:
```
AI_PROVIDER=claude  # or codex
```

### Issue: Settings not applied

**Check `.claude/settings.json` in your repo:**
```bash
cat .claude/settings.json
```

Both Claude and Codex use the same settings directory (`.claude/`).

---

## Advanced: Switch AI Mid-Workflow

Currently, the AI provider is set per-session. To switch:

1. Stop the current process (Ctrl+C)
2. Update `.env` file:
   ```bash
   AI_PROVIDER=codex  # or claude
   ```
3. Restart:
   ```bash
   node local/devin.js
   ```

**Future enhancement:** Support per-task AI selection via ClickUp custom fields.

---

## Files Summary

| File | Purpose | AI Support |
|------|---------|-----------|
| `lib/claude.js` | Claude (Anthropic) integration | Claude only |
| `lib/codex.js` | Codex (OpenAI) integration | Codex only |
| `lib/orchestrator.js` | AI workflow orchestration | Both (dynamic) |
| `lib/config.js` | Configuration management | Both |
| `lib/gemini.js` | Gemini feature spec generation | Both |

---

## Next Steps

### Option 1: Keep Current Setup (Recommended)
- Use environment variable to switch between Claude and Codex
- Simple and straightforward
- Works great for most use cases

### Option 2: Per-Task AI Selection
Create a ClickUp custom field to specify AI per task:
- Add custom field: "AI Provider" (dropdown: Claude, Codex)
- Update orchestrator to check task custom field
- Falls back to env var if not specified

### Option 3: Parallel AI Testing
Run both Claude and Codex on the same task:
- Create two branches: `task-{id}-claude` and `task-{id}-codex`
- Compare implementations
- Choose the better one

---

## Benefits

✅ **Flexibility:** Choose the best AI for each project
✅ **Fallback:** If one AI is down, switch to the other
✅ **Cost Optimization:** Use cheaper AI for simple tasks
✅ **Performance Testing:** Compare AI implementations
✅ **Future-Proof:** Easy to add more AI providers

---

## Migration from Old Setup

If you were using the old code where `lib/claude.js` had `launchCodex`:

### What Changed
- ✅ `lib/claude.js` now correctly uses `launchClaude` and `claude` command
- ✅ New `lib/codex.js` file created for Codex
- ✅ `orchestrator.js` now dynamically selects AI based on config
- ✅ No breaking changes to existing functionality

### Action Required
1. Add `AI_PROVIDER` to your `.env` file
2. Choose `claude` or `codex`
3. Test your setup

That's it! ✅

---

## Example `.env` File

```bash
# ClickUp Configuration
CLICKUP_API_KEY=your_api_key_here
CLICKUP_BOT_USER_ID=12345678
CLICKUP_WORKSPACE_ID=90181842045

# GitHub Configuration
GITHUB_REPO_PATH=/path/to/your/repo
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-repo-name
GITHUB_TOKEN=your_github_token

# AI Configuration
AI_PROVIDER=claude          # Choose: 'claude' or 'codex'
USE_MULTI_AI=true           # Enable Gemini analysis

# CLI Paths (optional)
CLAUDE_CLI_PATH=claude
CODEX_CLI_PATH=codex
GEMINI_CLI_PATH=gemini

# Polling
POLL_INTERVAL_MS=15000
```

---

## Quick Reference

### Switch to Claude
```bash
# .env
AI_PROVIDER=claude
```

### Switch to Codex
```bash
# .env
AI_PROVIDER=codex
```

### Check Current Configuration
```bash
node -e "console.log(require('./lib/config').system.aiProvider)"
```

Output: `claude` or `codex`

---

**Status:** ✅ Ready to use both Claude and Codex!

Choose your AI and let the automation begin! 🚀
