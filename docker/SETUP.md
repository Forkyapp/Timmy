# Timmy Setup Guide

## Quickest Setup (2 commands)

```bash
git clone https://github.com/Forkyapp/Timmy.git && cd Timmy
npm run setup    # Interactive setup (handles all auth)
npm start        # Auto-detects Docker or runs locally
```

That's it! `npm start` will:
1. Check if setup is complete (runs setup if not)
2. Use Docker if available, otherwise run locally
3. Build images automatically on first run

## All Commands

| Command | What it does |
|---------|--------------|
| `npm run setup` | Interactive setup for all credentials |
| `npm start` | Smart start (Docker if available, else local) |
| `npm run start:docker` | Force Docker mode |
| `npm run start:local` | Force local mode (no Docker) |
| `npm run docker:logs` | View Docker logs |
| `npm run docker:down` | Stop Docker containers |

## Alternative: Global Install

```bash
npm install -g timmy-cli
timmy init     # Setup
timmy start    # Run from anywhere
```

## What Setup Configures

| Service | Auth Method | Required? |
|---------|-------------|-----------|
| GitHub | Browser OAuth | Yes |
| Claude/Gemini/Codex | Browser OAuth | Yes (one AI minimum) |
| ClickUp | API key | Yes |
| OpenRouter | API key | Optional |
| Discord | API key | Optional |

## Troubleshooting

```bash
# Reset and start fresh
npm run docker:down
docker volume prune -f
npm run setup
npm start

# View what's happening
npm run docker:logs

# Run without Docker
npm run start:local
```
