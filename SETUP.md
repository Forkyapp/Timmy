# Timmy Setup Guide

**Simple step-by-step guide to get Timmy up and running**

---

## What is Timmy?

Timmy automatically:
1. Watches your ClickUp tasks for status "bot in progress"
2. Uses AI (Claude, Gemini, Codex) to analyze and implement features
3. Creates GitHub pull requests with the implementation
4. (Optional) Monitors Discord channels and responds to bugs/issues

---

## Quick Start (Recommended)

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Interactive Setup

```bash
npm run init
```

This will guide you through setting up:
- ClickUp API credentials
- GitHub repository connection
- Project configuration
- Optional Discord bot
- Optional OpenAI integration

**That's it! Skip to [Running Timmy](#running-timmy)**

---

## Manual Setup

If you prefer manual configuration:

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Configuration Files

```bash
# Copy templates
cp templates/.env.example .env

# Create required directories
mkdir -p data/cache data/state data/tracking data/discord
```

### 3. Configure Environment Variables

Edit `.env` file:

```bash
# ===== REQUIRED: ClickUp =====
CLICKUP_API_KEY=pk_your_api_key_here
CLICKUP_WORKSPACE_ID=12345678
CLICKUP_BOT_USER_ID=12345678

# ===== REQUIRED: GitHub =====
GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo-name
GITHUB_REPO_PATH=/absolute/path/to/your/repo
GITHUB_BASE_BRANCH=main

# ===== OPTIONAL: Discord Bot =====
DISCORD_ENABLED=false
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_server_id
DISCORD_CHANNEL_IDS=channel1_id,channel2_id
DISCORD_KEYWORDS=bug,issue,error,problem,broken,crash,fix
DISCORD_POLL_INTERVAL_MS=600000

# ===== OPTIONAL: OpenAI (for Discord AI Brain) =====
OPENAI_API_KEY=sk-your-openai-key

# ===== SYSTEM (defaults usually work) =====
POLL_INTERVAL_MS=60000
CLAUDE_CLI_PATH=claude
GEMINI_CLI_PATH=gemini
CODEX_CLI_PATH=codex
```

### 4. Initialize Data Files

```bash
# Copy template files
cp templates/data/cache/processed-tasks.json data/cache/
cp templates/data/state/task-queue.json data/state/
cp templates/data/state/pipeline-state.json data/state/
cp templates/data/tracking/pr-tracking.json data/tracking/

# For Discord (if enabled)
echo '[]' > data/discord/processed-messages.json
```

---

## Component Setup Guides

### ClickUp Setup

**1. Get API Key**
- Go to https://app.clickup.com/settings/apps
- Click "Generate" under "API Token"
- Copy your API key (starts with `pk_`)

**2. Get Workspace ID**
```bash
curl -H "Authorization: YOUR_API_KEY" https://api.clickup.com/api/v2/team
```
Copy the `id` field from the response

**3. Get Bot User ID**
- Go to https://app.clickup.com/settings/profile
- Your User ID is in the URL: `https://app.clickup.com/settings/profile/USER_ID`

**4. Create Task Status "bot in progress"**
- Go to your ClickUp workspace
- Settings → Statuses → Add custom status
- Name: `bot in progress`
- This is the status Timmy watches for

---

### GitHub Setup

**Option A: Using GitHub CLI (Recommended)**

```bash
# Install GitHub CLI
# macOS: brew install gh
# Linux: See https://cli.github.com/manual/installation

# Authenticate
gh auth login

# That's it! Timmy will use your gh credentials
```

**Option B: Personal Access Token**

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name (e.g., "Timmy Bot")
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Actions workflows)
5. Copy the token (starts with `ghp_`)
6. Add to `.env`: `GITHUB_TOKEN=ghp_...`

**3. Clone Your Repository**

```bash
# Clone the repo you want Timmy to work on
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /path/to/repo

# Add the absolute path to .env
GITHUB_REPO_PATH=/path/to/repo
```

---

### Claude Code CLI Setup

**Required for code implementation**

**1. Install Claude Code CLI**

Visit: https://docs.anthropic.com/claude-code/installation

```bash
# macOS/Linux
curl -sSL https://install.anthropic.com/claude-code | bash

# Verify installation
claude --version
```

**2. Authenticate**

```bash
claude auth login
```

**3. Configure Path (if needed)**

If `claude` is not in your PATH:
```bash
# Find Claude location
which claude

# Add to .env
CLAUDE_CLI_PATH=/full/path/to/claude
```

---

### Gemini CLI Setup

**Optional - enhances task analysis (has fallback if not installed)**

**1. Install Gemini CLI**

Visit: https://ai.google.dev/gemini-api/docs/cli

```bash
# Installation varies by platform
# Follow official docs

# Verify
gemini --version
```

**2. Authenticate**

```bash
gemini auth login
```

**3. Configure Path (if needed)**

```bash
GEMINI_CLI_PATH=/path/to/gemini
```

---

### Codex CLI Setup

**Optional - adds code review step**

**1. Install Codex CLI**

Visit: https://codex.so/docs/cli

```bash
# Follow installation instructions
# Verify
codex --version
```

**2. Authenticate**

```bash
codex auth login
```

**3. Configure Path (if needed)**

```bash
CODEX_CLI_PATH=/path/to/codex
```

---

### Discord Bot Setup

**Optional - enables Discord integration for bug reporting**

**1. Create Discord Application**

- Go to https://discord.com/developers/applications
- Click "New Application"
- Give it a name (e.g., "Timmy Bot")

**2. Create Bot**

- Go to "Bot" tab
- Click "Add Bot"
- Under "Privileged Gateway Intents", enable:
  - ✅ Message Content Intent
  - ✅ Server Members Intent
- Copy the bot token

**3. Invite Bot to Server**

- Go to "OAuth2" → "URL Generator"
- Select scopes:
  - ✅ `bot`
- Select permissions:
  - ✅ Send Messages
  - ✅ Read Message History
  - ✅ View Channels
- Copy the generated URL and open it to invite the bot

**4. Get Server and Channel IDs**

Enable Developer Mode in Discord:
- User Settings → Advanced → Developer Mode

Right-click your server → Copy ID (Guild ID)
Right-click channels → Copy ID (Channel IDs)

**5. Configure Environment**

```bash
DISCORD_ENABLED=true
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_server_id
DISCORD_CHANNEL_IDS=channel1_id,channel2_id,channel3_id
```

**6. (Optional) OpenAI for AI Brain**

To enable intelligent responses:

```bash
# Get API key from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-key
```

---

## Multi-Project Setup

**Work with multiple projects/repositories**

### 1. Create Projects Configuration

Create `projects.json`:

```json
{
  "projects": {
    "my-app": {
      "name": "My Application",
      "description": "Main application",
      "clickup": {
        "workspaceId": "12345678"
      },
      "github": {
        "owner": "myorg",
        "repo": "my-app",
        "path": "/Users/me/projects/my-app",
        "baseBranch": "main"
      }
    },
    "other-project": {
      "name": "Other Project",
      "description": "Another project",
      "clickup": {
        "workspaceId": "87654321"
      },
      "github": {
        "owner": "myorg",
        "repo": "other-project",
        "path": "/Users/me/projects/other-project",
        "baseBranch": "develop"
      }
    }
  }
}
```

### 2. Set Active Project

Create `workspace.json`:

```json
{
  "active": "my-app"
}
```

### 3. Switch Projects

```bash
# List all projects
npm run projects

# Switch to different project
npm run switch other-project

# Show current project
npm run current
```

---

## Running Timmy

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
# Build first
npm run build

# Run
npm start
```

### What Happens

1. **ClickUp Polling** - Every 60 seconds, checks for tasks with status "bot in progress"
2. **Discord Polling** - Every 10 minutes, checks for messages with keywords (if enabled)
3. **Task Processing** - When task detected:
   - Stage 1: Gemini analyzes task (optional)
   - Stage 2: Claude implements code
   - Stage 3: Codex reviews code (optional)
   - Stage 4: Claude fixes TODOs/FIXMEs
   - Stage 5: Creates GitHub pull request
4. **Posts PR link back to ClickUp task**

---

## Testing Your Setup

### Test ClickUp Connection

```bash
# Should list your tasks
npm run dev
# Watch for "✓ Connected to ClickUp" message
```

### Test GitHub Connection

```bash
# Check GitHub CLI (if using)
gh auth status

# Or test API with token
curl -H "Authorization: token YOUR_GITHUB_TOKEN" https://api.github.com/user
```

### Test Discord Bot (if enabled)

1. Start Timmy: `npm run dev`
2. Post a message in monitored channel with keyword "bug"
3. Watch console for message detection
4. If OpenAI configured, bot should respond

### Create Test Task

1. In ClickUp, create a task:
   - Title: "Test: Add hello world function"
   - Description: "Create a function that prints hello world"
   - Status: "bot in progress"
2. Watch Timmy console for task detection
3. Check GitHub for created branch and PR

---

## Project Structure

```
timmy/
├── .env                    # Your configuration (don't commit!)
├── workspace.json          # Active project
├── projects.json           # Multi-project config
├── data/                   # Runtime data (gitignored)
│   ├── cache/             # Processed tasks
│   ├── state/             # Pipeline state
│   ├── tracking/          # PR tracking
│   └── discord/           # Discord messages
├── src/                   # Source code
└── scripts/               # Setup scripts
```

---

## Troubleshooting

### "Failed to connect to ClickUp"

- Check `CLICKUP_API_KEY` is correct
- Verify workspace ID: `curl -H "Authorization: YOUR_KEY" https://api.clickup.com/api/v2/team`
- Check internet connection

### "GitHub authentication failed"

- If using GitHub CLI: `gh auth status`
- If using token: Verify it has `repo` scope
- Token must not be expired

### "Claude command not found"

- Install Claude CLI: https://docs.anthropic.com/claude-code/installation
- Or set full path: `CLAUDE_CLI_PATH=/full/path/to/claude`

### "Discord bot not responding"

- Verify `DISCORD_ENABLED=true`
- Check bot token is correct
- Ensure bot has permissions in channels
- Check channel IDs are correct

### "No tasks detected"

- Verify task status is exactly "bot in progress"
- Check `CLICKUP_WORKSPACE_ID` matches your workspace
- Ensure task is assigned (or use custom filters)

### "Branch already exists" error

- Timmy creates branch names like: `claude/feature-task-123-abc123`
- Delete old branch: `git branch -D branch-name`
- Or check if PR already exists for this task

---

## Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `CLICKUP_API_KEY` | ClickUp API token | `pk_123...` |
| `CLICKUP_WORKSPACE_ID` | Workspace ID | `12345678` |
| `CLICKUP_BOT_USER_ID` | Your user ID | `12345678` |
| `GITHUB_TOKEN` | GitHub access token | `ghp_abc...` |
| `GITHUB_OWNER` | Repository owner | `myusername` |
| `GITHUB_REPO` | Repository name | `my-repo` |
| `GITHUB_REPO_PATH` | Local repo path | `/path/to/repo` |

### Optional - Discord

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCORD_ENABLED` | Enable Discord integration | `false` |
| `DISCORD_BOT_TOKEN` | Discord bot token | - |
| `DISCORD_GUILD_ID` | Discord server ID | - |
| `DISCORD_CHANNEL_IDS` | Comma-separated channel IDs | - |
| `DISCORD_KEYWORDS` | Keywords to detect | `bug,issue,error...` |
| `DISCORD_POLL_INTERVAL_MS` | Poll interval | `600000` (10 min) |

### Optional - OpenAI

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | - |

### Optional - System

| Variable | Description | Default |
|----------|-------------|---------|
| `POLL_INTERVAL_MS` | ClickUp poll interval | `60000` (1 min) |
| `GITHUB_BASE_BRANCH` | Default base branch | `main` |
| `CLAUDE_CLI_PATH` | Path to Claude CLI | `claude` |
| `GEMINI_CLI_PATH` | Path to Gemini CLI | `gemini` |
| `CODEX_CLI_PATH` | Path to Codex CLI | `codex` |
| `AUTO_CREATE_REPO` | Auto-create repos | `true` |
| `DISABLE_COMMENTS` | Disable ClickUp comments | `false` |

---

## Advanced Features

### Custom Commands via ClickUp Comments

Comment on a ClickUp task with:

- `@bot rerun` - Restart entire pipeline
- `@bot review` - Rerun only Codex review
- `@bot fix` - Rerun only Claude fixes

### Pipeline Stages

You can configure which stages run:

1. **Analysis** (Gemini) - Optional, has fallback
2. **Implementation** (Claude) - Required
3. **Review** (Codex) - Optional
4. **Fixes** (Claude) - Required
5. **PR Creation** (GitHub) - Required

### State Management

All state stored in `data/`:
- Check pipeline status: `cat data/state/pipeline-state.json`
- View processed tasks: `cat data/cache/processed-tasks.json`
- See PR tracking: `cat data/tracking/pr-tracking.json`

---

## Getting Help

- **Documentation**: Check `CLAUDE.md` for detailed architecture
- **Issues**: https://github.com/yourusername/timmy/issues
- **Logs**: Check console output for detailed error messages

---

## Quick Checklist

Before starting Timmy:

- [ ] Node.js 18+ installed
- [ ] `npm install` completed
- [ ] `.env` file configured
- [ ] ClickUp API key obtained
- [ ] GitHub token obtained (or `gh auth login`)
- [ ] Claude CLI installed and authenticated
- [ ] Repository cloned locally
- [ ] Task status "bot in progress" exists in ClickUp
- [ ] Data directories created

Optional:
- [ ] Discord bot created and invited (if using Discord)
- [ ] OpenAI API key configured (if using AI Brain)
- [ ] Gemini CLI installed (if using enhanced analysis)
- [ ] Codex CLI installed (if using code review)

**Ready to go!** Run `npm run dev` and create your first task.

---

**Last Updated**: 2025-11-15
