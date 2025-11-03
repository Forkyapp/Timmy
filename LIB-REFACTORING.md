# Lib Directory Refactoring Plan

## Current Structure (13 files)

### 📊 File Overview

| File | Size | Purpose | Dependencies |
|------|------|---------|--------------|
| `cache.js` | 58 lines | Processed tasks cache management | config |
| `claude.js` | 207 lines | Launch Codex/Claude with task prompts | config, ui, clickup, tracking, queue |
| `clickup.js` | 71 lines | ClickUp API (tasks, status, comments) | config, ui |
| `config.js` | 37 lines | **Central configuration** | dotenv |
| `gemini.js` | 176 lines | Gemini AI task analysis | config, ui, retry |
| `github.js` | 176 lines | GitHub API (branches, PRs) | config, ui, retry |
| `orchestrator.js` | 155 lines | **Multi-AI workflow coordinator** | All modules |
| `pipeline.js` | 354 lines | Pipeline state management | fs |
| `process-manager.js` | 183 lines | Process tracking & health checks | child_process |
| `queue.js` | 62 lines | Task queue management | config, ui |
| `retry.js` | 143 lines | Retry logic with backoff | ui |
| `tracking.js` | 132 lines | PR tracking and polling | config, ui, clickup |
| `ui.js` | 41 lines | Terminal colors & formatting | none |

**Total:** 1,795 lines across 13 files

---

## 🎯 Refactoring Strategy

### Goal: Reduce to 6-8 files with clear responsibilities

### Proposed New Structure

```
lib/
├── config.js              (keep as-is)
├── storage.js             (merge: cache + queue + tracking + pipeline)
├── ai/
    └── claude.js  
│   ├── codex.js          
│   └── gemini.js         

├── api/
│   ├── clickup.js        (keep as-is)
│   └── github.js         (keep as-is)
├── orchestrator.js        (keep as-is - main business logic)
└── utils/
    ├── ui.js             (keep as-is)
    ├── retry.js          (keep as-is)
    └── process.js        (renamed from process-manager.js)
```

**Result:** 10 files (better organized) instead of 13 flat files

---

## 📦 Detailed Consolidation Plan

### 1. Create `storage.js` - Unified Data Persistence
**Merges:** `cache.js` + `queue.js` + `tracking.js` + `pipeline.js`

**Why?** All these files do the same thing:
- Read/write JSON files
- Manage in-memory state
- Provide CRUD operations

**New API:**
```javascript
const storage = require('./storage');

// Cache operations
storage.cache.load()
storage.cache.save()
storage.cache.add(task)
storage.cache.has(taskId)

// Queue operations
storage.queue.load()
storage.queue.add(task)
storage.queue.remove(taskId)
storage.queue.getPending()

// Tracking operations
storage.tracking.start(task)
storage.tracking.check(taskId)
storage.tracking.complete(taskId, pr)
storage.tracking.poll()

// Pipeline operations
storage.pipeline.init(taskId)
storage.pipeline.updateStage(taskId, stage)
storage.pipeline.complete(taskId)
storage.pipeline.fail(taskId, error)
```

**Benefits:**
- **Single source of truth** for file I/O
- Reduces code duplication
- Easier to test
- **Saves ~450 lines** into one ~300 line file

---

### 2. Organize AI Modules → `ai/` folder

**Files:**
- `ai/codex.js` (renamed from `claude.js`)
- `ai/gemini.js` (keep as-is)

**Why?** Clear separation of AI-related functionality

---

### 3. Organize API Modules → `api/` folder

**Files:**
- `api/clickup.js` (keep as-is)
- `api/github.js` (keep as-is)

**Why?** All external API calls in one place

---

### 4. Organize Utilities → `utils/` folder

**Files:**
- `utils/ui.js` (keep as-is)
- `utils/retry.js` (keep as-is)
- `utils/process.js` (renamed from `process-manager.js`)

**Why?** Generic utilities separate from business logic

---

## 🔄 Migration Steps

### Phase 1: Create new organized structure ✅
1. Create folders: `ai/`, `api/`, `utils/`
2. Move files to appropriate folders
3. Update `require()` paths

### Phase 2: Consolidate storage layer ✅
1. Create `storage.js`
2. Merge cache, queue, tracking, pipeline
3. Export unified API
4. Update all imports

### Phase 3: Update main files ✅
1. Update `devin.js` (if used)
2. Update `orchestrator.js`
3. Update any other entry points

### Phase 4: Test & cleanup ✅
1. Test all functionality
2. Remove old files
3. Update documentation

---

## 📋 File-by-File Details

### `cache.js` → `storage.js`
**Functions:**
- `loadProcessedTasks()` → `storage.cache.load()`
- `saveProcessedTasks()` → `storage.cache.save()`
- `addToProcessed()` → `storage.cache.add()`
- `initializeCache()` → `storage.cache.init()`

### `queue.js` → `storage.js`
**Functions:**
- `loadQueue()` → `storage.queue.load()`
- `saveQueue()` → `storage.queue.save()`
- `queueTask()` → `storage.queue.add()`

### `tracking.js` → `storage.js`
**Functions:**
- `loadPRTracking()` → `storage.tracking.load()`
- `savePRTracking()` → `storage.tracking.save()`
- `startPRTracking()` → `storage.tracking.start()`
- `checkForPR()` → `storage.tracking.check()`
- `pollForPRs()` → `storage.tracking.poll()`
- `initializeTracking()` → `storage.tracking.init()`

### `pipeline.js` → `storage.js`
**Functions:** Keep all exports, just namespace under `storage.pipeline.*`

---

## 🎨 Before & After Comparison

### Before (13 flat files)
```
lib/
├── cache.js
├── claude.js
├── clickup.js
├── config.js
├── gemini.js
├── github.js
├── orchestrator.js
├── pipeline.js
├── process-manager.js
├── queue.js
├── retry.js
├── tracking.js
└── ui.js
```

### After (10 organized files)
```
lib/
├── config.js
├── storage.js              ← MERGED 4 files
├── orchestrator.js
├── ai/
│   ├── codex.js
│   └── gemini.js
├── api/
│   ├── clickup.js
│   └── github.js
└── utils/
    ├── ui.js
    ├── retry.js
    └── process.js
```

---

## 💡 Alternative: Minimal Refactor

If full refactor is too much, do this minimal cleanup:

### Option A: Just organize into folders (no merging)
- Move files to `ai/`, `api/`, `utils/` folders
- Keep all 13 files
- Just better organized

### Option B: Just merge storage (recommended)
- Create `storage.js` (merge 4 files)
- Leave everything else as-is
- Reduces to 10 files

---

## 🚀 Recommended Approach

**Start with Option B:**
1. ✅ Create `storage.js` (merge cache, queue, tracking, pipeline)
2. ✅ Update imports in orchestrator and main files
3. ✅ Test thoroughly
4. ✅ Then optionally move to folders

**Benefits:**
- Reduces confusion (4 files → 1 file for all data)
- Easier to understand data flow
- Less mental overhead
- Single file to edit for storage changes

---

## 📝 Current Dependencies Graph

```
orchestrator.js (MAIN ENTRY)
├── pipeline.js
├── gemini.js
│   ├── config.js
│   ├── ui.js
│   └── retry.js
├── claude.js
│   ├── config.js
│   ├── ui.js
│   ├── clickup.js
│   ├── tracking.js
│   └── queue.js
├── queue.js
│   ├── config.js
│   └── ui.js
└── tracking.js
    ├── config.js
    ├── ui.js
    └── clickup.js

clickup.js
├── config.js
└── ui.js

github.js
├── config.js
├── ui.js
└── retry.js

cache.js
└── config.js

process-manager.js
(no deps)
```

**Issue:** Too many cross-dependencies, hard to follow!

---

## ✅ Next Steps

1. **Decide on approach:**
   - [ ] Full refactor (10 files in folders)
   - [x] **Recommended:** Merge storage only (10 flat files)
   - [ ] Just add folders (13 files organized)

2. **Create `storage.js`** to unify:
   - Cache management
   - Queue management
   - PR tracking
   - Pipeline state

3. **Update imports** in:
   - `orchestrator.js`
   - `claude.js`
   - Main entry file

4. **Test everything**

5. **Delete old files:**
   - `cache.js`
   - `queue.js`
   - `tracking.js`
   - `pipeline.js`

---

## 🎯 Success Criteria

After refactoring:
- ✅ Fewer files (10 or less)
- ✅ Clear naming and organization
- ✅ Easier to find what you need
- ✅ Reduced code duplication
- ✅ Better maintainability
- ✅ All tests pass
