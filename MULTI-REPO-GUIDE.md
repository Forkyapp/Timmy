# Multi-Repository Support Guide

## Overview

The system now supports working with multiple repositories! You can work on different projects simultaneously without changing configuration or restarting the system.

## How It Works

### 1. Configuration File: `repos.json`

Create or edit `repos.json` in the project root:

```json
{
  "default": "collabifi-back",
  "repositories": {
    "collabifi-back": {
      "owner": "collabifiapp",
      "repo": "collabifi-back",
      "path": "/Users/user/Documents/Personal-Projects/collabifi-back",
      "baseBranch": "main"
    },
    "my-frontend": {
      "owner": "yourname",
      "repo": "my-frontend-project",
      "path": "/Users/user/Documents/Personal-Projects/my-frontend",
      "baseBranch": "main"
    },
    "api-service": {
      "owner": "company",
      "repo": "api-service",
      "path": "/Users/user/Documents/Work/api-service",
      "baseBranch": "develop"
    }
  }
}
```

### 2. Specify Repository Per Task

You have 3 ways to specify which repository a task should use:

#### Option 1: Custom Field (Recommended)
Add a custom field named `Repository` in ClickUp and set its value to the repository name (e.g., `my-frontend`)

#### Option 2: Tag
Add a tag to your task like: `repo:my-frontend`

#### Option 3: Description
Include in the task description:
```
[Repo: my-frontend]
or
[Repository: my-frontend]
```

### 3. Default Repository

If no repository is specified, the system uses the `default` repository from `repos.json`.

## Adding a New Repository

1. **Edit `repos.json`:**
```json
{
  "default": "collabifi-back",
  "repositories": {
    "collabifi-back": { ... },
    "new-project": {
      "owner": "your-github-username",
      "repo": "new-project-name",
      "path": "/full/path/to/new-project",
      "baseBranch": "main"
    }
  }
}
```

2. **Create a ClickUp task** with:
   - Tag: `repo:new-project`
   - OR Custom field `Repository` = `new-project`
   - OR Description: `[Repo: new-project]`

3. **Set status to "bot in progress"**

4. **Done!** The system will automatically:
   - Detect the repository
   - Run Gemini analysis
   - Launch Claude to implement
   - Create PR in the correct repo
   - Run Codex review
   - Complete the workflow

## Example Workflows

### Frontend Task
```
Task: "Add dark mode toggle to header"
Tag: repo:my-frontend
Status: bot in progress

→ System implements in my-frontend repo
→ PR created in my-frontend
```

### Backend Task
```
Task: "Add user authentication API"
Custom Field: Repository = api-service
Status: bot in progress

→ System implements in api-service repo
→ PR created in api-service
```

### Default Repo Task
```
Task: "Fix login bug"
No repo specified
Status: bot in progress

→ System uses default repo (collabifi-back)
→ PR created in collabifi-back
```

## Auto-Create Repositories (NEW! 🎉)

The system can **automatically create new private GitHub repositories** when you specify a repo that doesn't exist yet!

### How It Works

1. **Create a ClickUp task** with a new repository name:
   ```
   Task: "Setup authentication service"
   Tag: repo:auth-api
   Status: bot in progress
   ```

2. **System detects** `auth-api` doesn't exist in `repos.json`

3. **Automatically:**
   - Creates private GitHub repo: `your-username/auth-api`
   - Clones it to: `/Users/user/Documents/Personal-Projects/auth-api`
   - Adds to `repos.json`
   - Continues with task implementation

4. **Done!** Your new repo is ready and the task is being implemented

### Configuration

Control auto-create behavior in `.env`:

```bash
# Auto-Create Repository Configuration
AUTO_CREATE_REPO=true                    # Enable/disable (default: true)
AUTO_REPO_PRIVATE=true                   # Create private repos (default: true)
AUTO_REPO_BASE_DIR=/Users/user/Documents/Personal-Projects  # Clone location
AUTO_REPO_DEFAULT_BRANCH=main            # Default branch name
```

### Example: Start a New Project

**Old way:**
1. Go to GitHub → Create repo
2. Clone locally
3. Edit repos.json
4. Create ClickUp task
5. Set status to "bot in progress"

**New way:**
1. Create ClickUp task with `repo:new-project` tag
2. Set status to "bot in progress"
3. ✅ Done! Repo created and task implemented automatically

## Benefits

✅ **No restart needed** - Add tasks for any configured repo
✅ **Work on multiple projects** - Handle tasks from different repos simultaneously
✅ **Auto-create repos** - New repos created automatically when needed
✅ **Easy to add repos** - Just edit repos.json or let system create them
✅ **Backward compatible** - Old tasks without repo specified use default
✅ **Per-task flexibility** - Each task can target a different repo

## Migration from Single-Repo

If you were using the old single-repo setup:

1. Your `.env` still works as a fallback
2. Create `repos.json` with your current repo as default
3. Add new repos as needed
4. Old tasks without repo specification will use default (from `repos.json` or `.env`)

## Repository Detection Order

The system checks in this order:
1. **Custom field** named `Repository` or `repository`
2. **Tag** starting with `repo:`
3. **Description** containing `[Repo: name]` or `[Repository: name]`
4. **Default** from repos.json
5. **Fallback** to .env configuration (legacy)

## Troubleshooting

### Task using wrong repository?
Check the console output when task is detected:
```
🤖 Starting multi-AI workflow for 86abc123
ℹ️  Repository: my-frontend
✅ Using repository: yourname/my-frontend-project
```

### Repository not found?
Make sure the repository name in your task matches exactly with the key in `repos.json`.
If auto-create is enabled, the system will create it automatically.

### Auto-create not working?
1. **Check GitHub CLI auth:**
   ```bash
   gh auth status
   ```
   If not authenticated:
   ```bash
   gh auth login
   ```

2. **Check `.env` settings:**
   ```bash
   AUTO_CREATE_REPO=true  # Must be 'true'
   ```

3. **Check console output** for error messages during repo creation

### Repository created but task failed?
The repository was created successfully and saved to `repos.json`.
You can:
- Retry the task (it will use the existing repo)
- Check the repository on GitHub
- Manually add initial files if needed

### Want to disable auto-create?
Set in `.env`:
```bash
AUTO_CREATE_REPO=false
```
Then manually add repos to `repos.json` before creating tasks.

### Want to see available repos?
The system logs available repositories on startup.

## Technical Details

- **Config resolution:** `lib/config.js` - `resolveRepoConfig(repoName)`
- **Detection logic:** `lib/clickup.js` - `detectRepository(task)`
- **Auto-creation:** `lib/repo-manager.js` - `ensureRepository(repoName, options)`
- **Storage:** Repository info is stored in pipeline state and review tracking
- **Backward compatible:** Falls back to `.env` if `repos.json` not found

### Auto-Create Flow

```
1. Task detected with repo name
2. orchestrator.js calls repoManager.ensureRepository()
3. Check if repo exists in repos.json
4. If not found:
   - Get GitHub username from gh CLI
   - Create private repo on GitHub
   - Clone to local path
   - Add to repos.json
   - Return repo config
5. Continue with normal workflow (Gemini → Claude → PR)
```

### Files Modified for Multi-Repo Support

- `repos.json` - Repository configuration
- `repos.json.example` - Template for adding new repos
- `lib/config.js` - Load and resolve repo configs
- `lib/clickup.js` - Detect repository from tasks
- `lib/repo-manager.js` - Auto-create repositories (NEW)
- `lib/orchestrator.js` - Use dynamic repo configs
- `lib/gemini.js` - Use dynamic repo configs
- `lib/claude.js` - Use dynamic repo configs
- `lib/codex.js` - Use dynamic repo configs
- `lib/storage.js` - Store repo info in review tracking
- `devin.js` - Pass repo config to review workflow
