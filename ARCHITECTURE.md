# J.A.R.V.I.S Architecture

## Project Structure

```
clickup-claude-github/
├── devin.js                  # Main entry point (orchestrator)
├── devin-old.js             # Original monolithic version (backup)
├── devin.test.js            # Test suite
├── lib/                     # Modular components
│   ├── ui.js               # JARVIS terminal UI & formatting
│   ├── config.js           # Configuration & environment variables
│   ├── cache.js            # Processed tasks cache management
│   ├── queue.js            # Task queue management
│   ├── tracking.js         # PR tracking system
│   ├── clickup.js          # ClickUp API operations
│   └── claude.js           # Claude Code automation
├── package.json
├── .env                     # Environment variables
└── README.md
```

## Module Breakdown

### 🎨 `lib/ui.js` - User Interface
**Purpose:** JARVIS-style terminal colors and formatting

**Exports:**
- `colors` - Color codes for terminal output
- `jarvis` - Formatted output functions:
  - `header()` - ASCII art headers
  - `success()`, `error()`, `warning()`, `info()` - Status messages
  - `ai()` - AI/JARVIS-style messages
  - `processing()` - Processing indicators
  - `divider()`, `label()`, `timestamp()` - UI helpers

**Dependencies:** None

---

### ⚙️ `lib/config.js` - Configuration
**Purpose:** Centralized configuration management

**Exports:**
```javascript
{
  clickup: {
    apiKey, botUserId, workspaceId
  },
  github: {
    repoPath, owner, repo, token
  },
  system: {
    pollIntervalMs, codexCliPath
  },
  files: {
    cacheFile, queueFile, prTrackingFile
  },
  prTracking: {
    checkIntervalMs, timeoutMs
  }
}
```

**Dependencies:** `dotenv`, `path`

---

### 💾 `lib/cache.js` - Cache Management
**Purpose:** Track processed tasks to prevent duplicates

**Exports:**
- `loadProcessedTasks()` - Load cache from disk
- `saveProcessedTasks()` - Save cache to disk
- `addToProcessed(task)` - Add task to cache
- `initializeCache()` - Initialize cache on startup
- `processedTasksData` - Array of processed tasks
- `processedTaskIds` - Set of processed task IDs

**Dependencies:** `fs`, `config`

**Storage:** `processed-tasks.json`

---

### 📋 `lib/queue.js` - Queue Management
**Purpose:** Queue tasks for manual processing if automation fails

**Exports:**
- `loadQueue()` - Load queue from disk
- `saveQueue(queue)` - Save queue to disk
- `queueTask(task)` - Add task to pending queue

**Dependencies:** `fs`, `config`, `ui`

**Storage:** `task-queue.json`

---

### 🔍 `lib/tracking.js` - PR Tracking
**Purpose:** Monitor for PR creation and update ClickUp

**Exports:**
- `loadPRTracking()` - Load tracking data
- `savePRTracking(tracking)` - Save tracking data
- `startPRTracking(task)` - Start tracking a task
- `checkForPR(tracking)` - Check if PR exists
- `pollForPRs()` - Poll all tracked tasks
- `initializeTracking()` - Initialize on startup
- `prTracking` - Array of tracked PRs

**Dependencies:** `fs`, `axios`, `config`, `ui`, `clickup`

**Storage:** `pr-tracking.json`

**Polling:** Every 30 seconds, 30-minute timeout

---

### 🔗 `lib/clickup.js` - ClickUp API
**Purpose:** ClickUp API operations

**Exports:**
- `getAssignedTasks()` - Fetch tasks assigned to bot
- `updateStatus(taskId, statusId)` - Update task status
- `addComment(taskId, text)` - Add comment to task

**Dependencies:** `axios`, `config`, `ui`

**API:** ClickUp REST API v2

---

### 🤖 `lib/claude.js` - Claude Automation
**Purpose:** Launch Claude Code agents for autonomous task execution

**Exports:**
- `ensureClaudeSettings()` - Create/update .claude/settings.json
- `launchCodex(task)` - Deploy Claude Code agent

**Dependencies:** `fs`, `path`, `child_process`, `config`, `ui`, `clickup`, `tracking`, `queue`

**Process:**
1. Create security settings
2. Generate task prompt
3. Create bash launch script
4. Execute via AppleScript (macOS Terminal)
5. Monitor for PR creation

---

### 🎯 `devin.js` - Main Orchestrator
**Purpose:** Main entry point, coordinates all modules

**Key Functions:**
- `pollAndProcess()` - Main polling loop
- `gracefulShutdown()` - Clean shutdown handler

**Workflow:**
1. Initialize cache and tracking
2. Poll ClickUp for new tasks
3. Launch Claude agents for each task
4. Track PR creation
5. Update ClickUp on completion

**Dependencies:** All lib modules

---

## Data Flow

```
┌─────────────────┐
│   ClickUp API   │
└────────┬────────┘
         │ Poll every 15s
         ↓
┌─────────────────┐
│  pollAndProcess │
└────────┬────────┘
         │ New task?
         ↓
┌─────────────────┐
│ Check cache     │ ← processed-tasks.json
└────────┬────────┘
         │ Not processed
         ↓
┌─────────────────┐
│  launchCodex    │
└────────┬────────┘
         │
         ├─→ Create .claude/settings.json
         ├─→ Generate task prompt
         ├─→ Launch Terminal + Claude
         └─→ Start PR tracking
                    │
                    ↓
         ┌─────────────────┐
         │   pollForPRs    │ Poll every 30s
         └────────┬────────┘
                  │ PR found?
                  ↓
         ┌─────────────────┐
         │ Update ClickUp  │
         │ - Add comment   │
         │ - Change status │
         └─────────────────┘
```

## Environment Variables

```bash
# ClickUp
CLICKUP_API_KEY=your_api_key
CLICKUP_BOT_USER_ID=12345
CLICKUP_WORKSPACE_ID=90181842045

# GitHub
GITHUB_REPO_PATH=/path/to/repo
GITHUB_OWNER=your_username
GITHUB_REPO=repo_name
GITHUB_TOKEN=ghp_your_token

# System
POLL_INTERVAL_MS=15000
```

## Running the System

```bash
# Install dependencies
npm install

# Run
node devin.js

# Run tests
npm test

# Test coverage
npm test -- --coverage
```

## Benefits of Modular Architecture

### ✅ Maintainability
- Each module has a single responsibility
- Easy to locate and fix bugs
- Clear separation of concerns

### ✅ Testability
- Modules can be tested independently
- Easy to mock dependencies
- Better test coverage

### ✅ Scalability
- Easy to add new features
- Can swap implementations
- Parallel development

### ✅ Reusability
- Modules can be used in other projects
- Clear interfaces
- Documented dependencies

## Migration Notes

The original `devin.js` has been backed up as `devin-old.js`. All functionality remains the same, just organized into modules.

### Key Changes:
1. **UI/Formatting** → `lib/ui.js`
2. **Configuration** → `lib/config.js`
3. **Cache Management** → `lib/cache.js`
4. **Queue Management** → `lib/queue.js`
5. **PR Tracking** → `lib/tracking.js`
6. **ClickUp API** → `lib/clickup.js`
7. **Claude Automation** → `lib/claude.js`
8. **Main Orchestrator** → `devin.js` (refactored)
