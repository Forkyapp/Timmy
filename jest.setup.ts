/**
 * Jest Global Setup
 * Sets up required environment variables for tests
 */

// Set required environment variables for tests
process.env.CLICKUP_API_KEY = process.env.CLICKUP_API_KEY || 'test-clickup-api-key';
process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'test-github-token';
process.env.GITHUB_REPO_PATH = process.env.GITHUB_REPO_PATH || '/test/repo/path';

// Set other commonly needed env vars for tests
process.env.CLICKUP_WORKSPACE_ID = process.env.CLICKUP_WORKSPACE_ID || 'test-workspace-id';
process.env.CLICKUP_BOT_USER_ID = process.env.CLICKUP_BOT_USER_ID || '12345';
process.env.GITHUB_OWNER = process.env.GITHUB_OWNER || 'test-owner';
process.env.GITHUB_REPO = process.env.GITHUB_REPO || 'test-repo';
