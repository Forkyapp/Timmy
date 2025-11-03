require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');

const config = {
  clickup: {
    apiKey: process.env.CLICKUP_API_KEY,
    botUserId: parseInt(process.env.CLICKUP_BOT_USER_ID || '0'),
    workspaceId: process.env.CLICKUP_WORKSPACE_ID || '90181842045',
  },
  github: {
    repoPath: process.env.GITHUB_REPO_PATH,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    token: process.env.GITHUB_TOKEN,
  },
  system: {
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '15000'),
    codexCliPath: process.env.CODEX_CLI_PATH || 'codex',
  },
  files: {
    cacheFile: path.join(__dirname, '..', 'processed-tasks.json'),
    queueFile: path.join(__dirname, '..', 'task-queue.json'),
    prTrackingFile: path.join(__dirname, '..', 'pr-tracking.json'),
  },
  prTracking: {
    checkIntervalMs: 30000,
    timeoutMs: 30 * 60 * 1000,
  },
};

module.exports = config;
