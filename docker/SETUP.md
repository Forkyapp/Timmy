# Docker Setup Guide

Get Timmy running in Docker in 5 minutes.

## Prerequisites

- Docker Desktop installed and running
- API keys for ClickUp, GitHub, and at least one AI service (Anthropic/Google/OpenAI)

## Quick Start

```bash
# 1. Clone and enter
git clone https://github.com/Forkyapp/Timmy.git && cd Timmy

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys (see Environment Variables below)

# 3. Build and run
./docker/scripts/build-base.sh
docker compose up -d

# 4. Check it's working
docker compose logs -f
```

## Commands

```bash
# Development
docker compose up -d          # Start
docker compose down           # Stop
docker compose logs -f        # Watch logs
docker compose restart        # Restart
docker compose exec timmy bash # Shell access

# Production
./docker/scripts/docker-start.sh prod
./docker/scripts/docker-stop.sh

# Maintenance
docker compose build          # Rebuild after code changes
docker compose build --no-cache # Full rebuild
./docker/scripts/docker-stop.sh --clean # Reset everything
```

## Environment Variables

Edit `.env` with these values:

| Variable | Required | Description |
|----------|----------|-------------|
| `CLICKUP_API_KEY` | Yes | ClickUp API token |
| `CLICKUP_WORKSPACE_ID` | Yes | ClickUp workspace ID |
| `GITHUB_TOKEN` | Yes | GitHub personal access token |
| `GITHUB_OWNER` | Yes | GitHub username or org |
| `GITHUB_REPO` | Yes | Default repository name |
| `ANTHROPIC_API_KEY` | One of these | For Claude |
| `GOOGLE_API_KEY` | One of these | For Gemini |
| `OPENAI_API_KEY` | One of these | For Codex |
| `POLL_INTERVAL_MS` | No | Task polling interval (default: 60000) |
| `LOG_LEVEL` | No | Logging verbosity (default: debug) |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Container won't start | `docker compose logs timmy` to see errors |
| Permission denied | `docker compose down && docker volume rm timmy_node_modules && docker compose up -d` |
| Can't connect to APIs | Verify keys in `.env`, test with `docker compose exec timmy curl -I https://api.github.com` |

## Help

- [Phase documentation](./phases/) - Detailed explanations
- [Architecture overview](./PLAN.md)
- [GitHub Issues](https://github.com/Forkyapp/Timmy/issues)
