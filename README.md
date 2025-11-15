# Timmy - Your AI Junior Developer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

Your autonomous AI junior developer that handles tasks from ClickUp and Discord, with GitHub issue support coming soon! Timmy orchestrates multiple AI services (Gemini, Claude, Codex) to analyze, implement, review, and fix code automatically - just like a real junior developer on your team!

## How It Works

### Simple Overview

```
┌──────────────────────────────────────────────────────┐
│ 1. YOU: Assign Work to Timmy                        │
│    - ClickUp: Set task to "bot in progress"         │
│    - Discord: Ask questions or assign tasks (NEW!)  │
│    - GitHub: Label issue (coming soon)              │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 2. TIMMY: Your AI Junior Dev                        │
│    - Detects tasks/issues automatically (60s poll)  │
│    - AI Brain analyzes requirements (Gemini)        │
│    - Loads smart context from codebase              │
│    - Understands the work like a junior developer   │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 3. TIMMY: Implements & Self-Reviews                 │
│    - Claude implements features autonomously        │
│    - Codex reviews own code (self-QA)               │
│    - Claude fixes issues found in review            │
│    - All automated - works independently!           │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 4. RESULT: Ready for Senior Review                  │
│    - GitHub PR created with full context            │
│    - Original issue/task updated with PR link       │
│    - Discord/ClickUp notification sent              │
│    - Waiting for your approval to merge             │
└──────────────────────────────────────────────────────┘
```

### Multi-AI Orchestration Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Task Detection (Every 60s)                               │
│    - Polls ClickUp for "bot in progress" tasks              │
│    - Monitors Discord channels with AI Brain (NEW!)         │
│    - GitHub issue monitoring (coming soon)                  │
│    - Deduplicates using cache                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Stage 1: Gemini Analysis                                 │
│    - Analyzes task requirements                             │
│    - Generates feature specification                        │
│    - Creates architecture recommendations                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Stage 2: Claude Implementation                           │
│    - Loads smart context from codebase                      │
│    - Implements feature based on specification              │
│    - Commits changes to feature branch                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Stage 3: Codex Code Review                               │
│    - Reviews implementation quality                         │
│    - Identifies issues and improvements                     │
│    - Generates review feedback                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Stage 4: Claude Fixes                                    │
│    - Addresses TODO/FIXME comments                          │
│    - Implements review suggestions                          │
│    - Finalizes implementation                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Pull Request Creation & Updates                         │
│    - Creates GitHub PR automatically                        │
│    - Links PR to original GitHub issue (if applicable)      │
│    - Posts PR link to ClickUp task                          │
│    - Updates task/issue status                              │
│    - Notifies via Discord (optional)                        │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Core Capabilities

- **Multi-AI Orchestration Pipeline**: Coordinated workflow using Gemini (analysis) → Claude (implementation) → Codex (review) → Claude (fixes)
- **Automated ClickUp Integration**: Polls for tasks every 60s, processes "bot in progress" status automatically
- **Discord Bot with AI Brain** ✨ NEW: Monitor Discord channels, respond intelligently to messages, track conversations with context-aware AI
- **GitHub Automation**: Automatic branch creation, commits, pull request generation, and issue linking
- **Smart Context Loading**: Intelligent codebase analysis and context preparation for AI services
- **Multi-Project Support**: Manage multiple projects with easy switching via workspace system
- **Interactive Terminal UI**: Real-time monitoring and control through interactive CLI
- **State Persistence**: Pipeline state tracking, task queue management, and PR tracking
- **Retry Logic**: Automatic retry with exponential backoff for network operations
- **TypeScript**: Full type safety with strict mode enabled

### Planned Features 🚀

- **GitHub Issue Bot**: Auto-detect labeled issues, analyze with AI brain, implement fixes (coming Q1 2025)
- **PR Review Bot**: Automatically review incoming PRs with AI feedback
- **Slack Integration**: Extend Discord bot capabilities to Slack workspaces

### AI Services Integration

- **Gemini CLI**: Feature specification and requirement analysis
- **Claude Code CLI**: Feature implementation and code fixes
- **Codex CLI**: Code quality review and improvement suggestions
- **AI Brain**: Discord message processing with context-aware responses (powered by Claude)

### Discord Bot Features ✨ (Live Now!)

- **AI Brain Integration**: Powered by Claude for intelligent, context-aware responses
- **Message Monitoring**: Real-time monitoring and logging of configured channels
- **Thread Tracking**: Maintains conversation history and context across threads
- **Smart Responses**: Understands questions and provides helpful answers using codebase context
- **Channel Configuration**: Flexible channel-specific settings
- **Rate Limiting**: Built-in protection against API rate limits
- **Error Handling**: Robust error recovery and retry logic

### GitHub Bot Features 🚀 (Coming Soon)

- **Issue Detection**: Automatically detects issues labeled with "timmy" or "bot"
- **AI Analysis**: Uses AI Brain to understand issue context and requirements
- **Bug Fixing**: Analyzes stack traces, error messages, and reproduces bugs
- **Feature Implementation**: Implements feature requests from GitHub issues
- **Auto-PR Creation**: Creates pull requests linked to original issues
- **Issue Updates**: Comments on issues with progress and PR links
- **Smart Labeling**: Automatically categorizes issues (bug, feature, enhancement)
- **Context-Aware**: Loads relevant codebase context for better understanding

## Prerequisites

### Required

- **Node.js 18+**: Runtime environment
- **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)**: For AI-powered implementation
- **ClickUp Account**: With API access for task management
- **GitHub Account**: With personal access token for PR creation

### Optional

- **Gemini CLI**: For advanced task analysis (falls back to basic analysis if not available)
- **Codex CLI**: For code quality review
- **Discord Bot**: For Discord channel monitoring and AI responses (see [DISCORD_SETUP.md](DISCORD_SETUP.md))
- **macOS**: Required for automatic Terminal launching feature

## Installation

```bash
git clone https://github.com/kuxala/clickup-bot.git
cd clickup-bot
npm install
npm run build
```

## Setup

**Interactive (Recommended):**
```bash
npm run init
```

**Manual:**
```bash
npm run setup
# Edit .env with your credentials
# Edit projects.json with your projects
npm run switch my-project
```

## Usage

### Starting Timmy

**Standard Mode:**
```bash
npm start
```

**Interactive Mode:**
```bash
npm run dev
```

The interactive terminal provides:
- Real-time task monitoring
- Pipeline status visualization
- Manual task reprocessing
- Discord bot status
- Interactive commands

### ClickUp Task Workflow

1. **Create a ClickUp Task:**
   - Set status to "bot in progress"
   - Add clear title and description
   - Optionally add custom fields for repository selection

2. **Automated Processing:**
   - Timmy detects task within 60s
   - **Stage 1**: Gemini analyzes requirements
   - **Stage 2**: Claude implements features
   - **Stage 3**: Codex reviews code
   - **Stage 4**: Claude fixes issues
   - **Stage 5**: PR is created automatically

3. **Review:**
   - Check the generated PR on GitHub
   - Review changes and merge when ready
   - ClickUp task is updated with PR link

### Discord Bot Usage ✨ (Live Now!)

**Setup:**
See [DISCORD_SETUP.md](DISCORD_SETUP.md) for detailed configuration.

**How to Use:**
1. **Add Timmy to Your Discord Server**
   - Invite the bot using the Discord app
   - Configure monitored channels in `.env`
   - Enable AI Brain for intelligent responses

2. **Interact with Timmy:**
   - Ask questions in monitored channels
   - Timmy responds with context-aware answers
   - Can discuss code, explain features, help debug
   - Maintains conversation context across threads

3. **Example Interactions:**
   ```
   You: "How does the orchestrator pipeline work?"
   Timmy: *Analyzes codebase and explains the 4-stage pipeline*

   You: "Can you help me understand the Discord integration?"
   Timmy: *Provides detailed explanation with code references*
   ```

**Configuration:**
```bash
# .env file
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
DISCORD_CHANNEL_IDS=channel1,channel2
DISCORD_AI_ENABLED=true  # Enable AI Brain
```

### GitHub Issue Workflow 🚀 (Coming Soon)

1. **Create or Label a GitHub Issue:**
   - Create a new issue describing the bug or feature
   - Add label "timmy" or "bot" to assign it to Timmy
   - Include details: description, steps to reproduce, expected behavior

2. **Automated Processing:**
   - Timmy detects labeled issue within 60s
   - **Stage 1**: AI Brain analyzes issue and context
   - **Stage 2**: Claude implements fix or feature
   - **Stage 3**: Codex reviews the implementation
   - **Stage 4**: Claude addresses review feedback
   - **Stage 5**: PR is created and linked to issue

3. **Review & Merge:**
   - GitHub PR is linked to original issue
   - Timmy comments on issue with PR link and summary
   - Review changes and approve
   - Issue auto-closes when PR is merged

**Supported Issue Types:**
- 🐛 **Bug Reports**: Analyzes stack traces, reproduces bugs, implements fixes
- ✨ **Feature Requests**: Understands requirements, implements new features
- 🔧 **Enhancements**: Improves existing functionality
- 📝 **Documentation**: Updates docs, adds comments, creates guides
- ♻️ **Refactoring**: Restructures code while maintaining functionality

### Project Management

```bash
npm run projects        # List all projects
npm run switch <name>   # Switch active project
npm run current         # Show current project
```

### Interactive Commands

When running in interactive mode:
- `s` - Show current status
- `q` - View task queue
- `r <taskId>` - Rerun task
- `h` - Show help
- `Ctrl+C` - Graceful shutdown

## Data Storage

All state stored in `data/` directory:

```
data/
├── cache/              # Processed tasks/comments
├── state/              # Task queue, pipeline state
└── tracking/           # PR and review tracking
```

**Initialize:**
```bash
for f in data/**/*.example; do cp "$f" "${f%.example}"; done
```

## Architecture

### Directory Structure

```
timmy/
├── src/                          # Modern refactored codebase
│   ├── types/                   # TypeScript type definitions
│   │   ├── clickup.ts           # ClickUp domain types
│   │   ├── github.ts            # GitHub domain types
│   │   ├── discord.ts           # Discord domain types
│   │   ├── ai.ts                # AI service types
│   │   └── storage.ts           # Storage/pipeline types
│   │
│   ├── shared/                  # Shared utilities and infrastructure
│   │   ├── config/              # Configuration management
│   │   ├── errors/              # Custom error classes
│   │   ├── utils/               # Utility functions
│   │   ├── ui/                  # Terminal UI formatting
│   │   └── interactive-cli.ts   # Interactive mode handler
│   │
│   ├── core/                    # Core business logic
│   │   ├── orchestrator/        # Main workflow orchestration
│   │   │   ├── stages/          # Pipeline stages (4 stages)
│   │   │   └── utils/           # Pipeline utilities
│   │   │
│   │   ├── ai-services/         # AI model integrations
│   │   │   ├── claude.service.ts
│   │   │   ├── gemini.service.ts
│   │   │   ├── ai-brain.service.ts
│   │   │   └── qwen.service.ts
│   │   │
│   │   ├── discord/             # Discord bot service
│   │   │   └── discord.service.ts
│   │   │
│   │   ├── repositories/        # Data access layer
│   │   │   ├── cache.repository.ts
│   │   │   ├── pipeline.repository.ts
│   │   │   └── discord-message.repository.ts
│   │   │
│   │   ├── monitoring/          # Code review and monitoring
│   │   │   └── codex.service.ts
│   │   │
│   │   └── context/             # Smart context loading
│   │       └── smart-context-loader.service.ts
│   │
│   └── infrastructure/          # External integrations
│       ├── api/                 # API clients
│       │   ├── clickup.client.ts
│       │   ├── github.client.ts
│       │   └── discord.client.ts
│       │
│       └── storage/             # Storage implementations
│
├── data/                         # Runtime state (gitignored)
│   ├── cache/                   # Processed tasks cache
│   ├── state/                   # Task queue and pipeline state
│   └── tracking/                # PR and review tracking
│
├── lib/                          # Legacy code (being migrated)
├── timmy.ts                      # Main entry point
└── package.json                  # Dependencies and scripts
```

### Key Technologies

- **Runtime**: Node.js 18+ with TypeScript 5.9+
- **AI Integration**: Claude Code CLI, Gemini CLI, Codex CLI
- **APIs**: ClickUp REST API v2, GitHub REST API v3, Discord API
- **Testing**: Jest with ts-jest
- **Storage**: JSON file-based persistence
- **HTTP**: Axios with retry logic

### Commands

```bash
# Development
npm run build          # Compile TypeScript
npm run dev            # Run with ts-node
npm start              # Build and run production

# Testing
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode

# Project Management
npm run projects       # List all projects
npm run switch <name>  # Switch active project
npm run current        # Show current project

# Cleanup
npm run clean          # Clean build artifacts
```

## Troubleshooting

**Tasks not detected:**
- Verify status is exactly "bot in progress"
- Check credentials in `.env`
- Confirm correct user ID

**Background execution:**
```bash
# Using pm2
pm2 start npm --name timmy -- start

# Using nohup
nohup npm start > timmy.log 2>&1 &
```

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - Comprehensive codebase guide for AI assistants (1400+ lines)
- **[DISCORD_SETUP.md](DISCORD_SETUP.md)** - Discord bot setup and configuration
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines
- **[REPORT.md](REPORT.md)** - Detailed codebase analysis report
- **[QUICKSTART.md](QUICKSTART.md)** - Quick start guide

## Important Notes

### Current Capabilities

- **Multi-AI Pipeline**: Fully autonomous task processing through 4 AI stages (Analysis → Implementation → Review → Fixes)
- **Discord Bot with AI Brain** ✨: Real-time monitoring, intelligent Q&A, context-aware responses - like having a junior dev in your Discord!
- **ClickUp Automation**: Polls and processes ClickUp tasks automatically every 60s
- **Smart Context Loading**: Intelligent codebase analysis and context preparation for AI services
- **State Management**: Persistent pipeline state with resume capability
- **Interactive Terminal**: Real-time monitoring and control of all operations
- **Multi-Project Support**: Seamlessly switch between multiple projects

### Limitations

- **macOS Terminal Launching**: Automatic Terminal launching requires macOS (uses osascript)
- **Sequential Processing**: Tasks processed one at a time with 60s polling intervals
- **Computer Must Run**: Continuous operation required (use pm2 for background execution)
- **API Rate Limits**: Subject to ClickUp (100 req/min) and GitHub (5000 req/hr) limits

### Best Practices

- **Clear Task Descriptions**: Write detailed, specific task requirements for better AI analysis
- **Review PRs**: Always review generated code before merging
- **Use pm2**: Run in background for production use
- **Monitor Logs**: Check logs regularly for errors or issues
- **Test AI CLIs**: Ensure Gemini, Claude, and Codex CLIs are properly installed
- **Discord Rate Limits**: Be aware of Discord API rate limits when using bot features

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT License - see [LICENSE](LICENSE)
