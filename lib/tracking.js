const fs = require('fs');
const axios = require('axios');
const config = require('./config');
const { jarvis, colors } = require('./ui');
const clickup = require('./clickup');

let prTracking = [];

function loadPRTracking() {
  try {
    if (fs.existsSync(config.files.prTrackingFile)) {
      return JSON.parse(fs.readFileSync(config.files.prTrackingFile, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading PR tracking:', error.message);
  }
  return [];
}

function savePRTracking(tracking) {
  try {
    fs.writeFileSync(config.files.prTrackingFile, JSON.stringify(tracking, null, 2));
  } catch (error) {
    console.error('Error saving PR tracking:', error.message);
  }
}

function startPRTracking(task) {
  const tracking = {
    taskId: task.id,
    taskName: task.name,
    branch: `task-${task.id}`,
    startedAt: new Date().toISOString(),
    owner: config.github.owner,
    repo: config.github.repo
  };

  prTracking.push(tracking);
  savePRTracking(prTracking);
}

async function checkForPR(tracking) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${tracking.owner}/${tracking.repo}/pulls`,
      {
        headers: {
          'Authorization': `token ${config.github.token}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        params: {
          head: `${tracking.owner}:${tracking.branch}`,
          state: 'all'
        }
      }
    );

    if (response.data && response.data.length > 0) {
      const pr = response.data[0];
      return {
        found: true,
        url: pr.html_url,
        number: pr.number,
        state: pr.state
      };
    }
  } catch (error) {
    console.error(`Error checking PR for ${tracking.taskId}:`, error.message);
  }

  return { found: false };
}

async function pollForPRs() {
  const now = new Date();

  for (let i = prTracking.length - 1; i >= 0; i--) {
    const tracking = prTracking[i];
    const startedAt = new Date(tracking.startedAt);
    const elapsed = now - startedAt;

    if (elapsed > config.prTracking.timeoutMs) {
      console.log(jarvis.warning(`Task ${colors.bright}${tracking.taskId}${colors.reset} timeout (30min)`));

      await clickup.addComment(
        tracking.taskId,
        `⚠️ **Timeout Warning**\n\n` +
        `No Pull Request detected after 30 minutes.\n\n` +
        `Check terminal for agent status.`
      );

      prTracking.splice(i, 1);
      savePRTracking(prTracking);
      continue;
    }

    const result = await checkForPR(tracking);

    if (result.found) {
      console.log(jarvis.success(`Task ${colors.bright}${tracking.taskId}${colors.reset} → PR #${result.number}`));
      console.log(jarvis.info(result.url));

      await clickup.addComment(
        tracking.taskId,
        `✅ **Pull Request Created**\n\n` +
        `**PR #${result.number}:** ${result.url}\n\n` +
        `Implementation complete and ready for review.`
      );

      await clickup.updateStatus(tracking.taskId, 'can be checked');

      prTracking.splice(i, 1);
      savePRTracking(prTracking);
    }
  }
}

function initializeTracking() {
  prTracking = loadPRTracking();
}

module.exports = {
  loadPRTracking,
  savePRTracking,
  startPRTracking,
  checkForPR,
  pollForPRs,
  initializeTracking,
  get prTracking() { return prTracking; },
  set prTracking(val) { prTracking = val; },
};
