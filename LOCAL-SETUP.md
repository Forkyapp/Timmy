# Local Claude Code Integration Setup

This guide explains how to run the ClickUp-Claude-GitHub integration locally using Claude Code.

## Overview

When a ClickUp task is assigned to you with status "bot in progress", the local polling script will:
1. Detect the new task
2. Invoke Claude Code with the task details
3. Claude Code implements the feature
4. Creates a GitHub PR
5. Updates the ClickUp task to "can be checked"

## Prerequisites

1. **Claude Code CLI** installed and accessible via `claude` command
2. **Node.js** installed
3. **Git** configured with your GitHub credentials
4. **.env file** configured (see main README)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure .env

Make sure you have these variables in `.env`:

```bash
# Required
CLICKUP_API_KEY=your_api_key
CLICKUP_BOT_USER_ID=your_user_id
CLICKUP_WORKSPACE_ID=your_workspace_id
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=your_github_username_or_org
GITHUB_REPO=your_repo_name
GITHUB_REPO_PATH=/full/path/to/your/github/repo

# Optional
GITHUB_BASE_BRANCH=main
POLL_INTERVAL_MS=60000  # Poll every 60 seconds
```

**Important:** `GITHUB_REPO_PATH` should point to your **actual GitHub repository** where Claude Code will implement features, NOT this integration repo.

Example:
```bash
GITHUB_REPO_PATH=/Users/user/Documents/Personal Projects/collabifi-back
```

### 3. Verify Claude Code CLI

Test that Claude Code is accessible:

```bash
claude --version
# or
which claude
```

If Claude Code is installed with a different command name, update line 106 in `local-poll.js`:

```javascript
const claude = spawn('your-claude-command-here', [], {
```

## Usage

### Start Local Polling

Run the polling script in the background:

```bash
node local-poll.js
```

You should see:
```
🚀 Starting local ClickUp polling...
📍 Workspace: 90181842045
👤 Bot User ID: 87761917
📁 GitHub Repo: /Users/user/Documents/Personal Projects/collabifi-back
⏱️  Poll Interval: 60s
```

### Workflow

1. **Create a task in ClickUp**
   - Add title and description with implementation details
   - Assign to yourself
   - Set status to "bot in progress"

2. **Local script detects it**
   - Within 60 seconds, the script will detect the new task
   - It will attempt to invoke Claude Code automatically

3. **Claude Code implements**
   - Claude Code receives the task details
   - Creates a new branch: `task-{taskId}`
   - Implements the feature
   - Commits and pushes
   - Creates a GitHub PR

4. **ClickUp updated**
   - Task status changes to "can be checked"
   - You can review the PR on GitHub

### Manual Fallback

If automatic Claude Code invocation fails, the script will:
- Save the prompt to `task-{taskId}-prompt.txt`
- Add task to `task-queue.json`
- Display manual instructions

To manually complete a task:

1. Open Claude Code in your repo:
   ```bash
   cd /path/to/your/repo
   claude
   ```

2. Copy and paste the prompt from `task-{taskId}-prompt.txt`

3. After implementing and creating the PR, mark the task complete:
   ```bash
   node mark-task-complete.js {taskId}
   ```

## Task Queue Management

The script maintains a `task-queue.json` file with three queues:

- **pending**: Tasks waiting for manual processing
- **inProgress**: Tasks currently being processed
- **completed**: Successfully completed tasks

View the queue:
```bash
cat task-queue.json
```

## Troubleshooting

### Claude Code not found

If you get "Could not spawn Claude Code automatically":

1. Check Claude Code installation:
   ```bash
   which claude
   ```

2. Update `local-poll.js` line 106 with the correct command

3. Or process tasks manually using the fallback workflow

### No tasks detected

1. Verify ClickUp configuration:
   ```bash
   curl -H "Authorization: $CLICKUP_API_KEY" \
     "https://api.clickup.com/api/v2/team/$CLICKUP_WORKSPACE_ID/task?assignees[]=$CLICKUP_BOT_USER_ID"
   ```

2. Check task status is exactly "bot in progress" (case-sensitive)

3. Ensure task is assigned to the correct user ID

### PR creation fails

1. Verify `GITHUB_REPO_PATH` points to the correct repository
2. Ensure GitHub token has `repo` scope
3. Check that Claude Code has git configured with push access

## Stopping the Script

Press `Ctrl+C` to stop the polling script.

## Running in Background

To keep polling running even when terminal closes:

```bash
# Using nohup
nohup node local-poll.js > polling.log 2>&1 &

# View logs
tail -f polling.log

# Stop
pkill -f "node local-poll.js"
```

Or use a process manager like `pm2`:

```bash
npm install -g pm2
pm2 start local-poll.js --name clickup-poller
pm2 logs clickup-poller
pm2 stop clickup-poller
```

## How It Works

```
ClickUp Task (bot in progress)
         ↓
   local-poll.js (every 60s)
         ↓
   Claude Code CLI
         ↓
   Feature Implementation
         ↓
   Git Branch + Commit + Push
         ↓
   GitHub PR Created
         ↓
   ClickUp Task → "can be checked"
```
