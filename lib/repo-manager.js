const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const config = require('./config');
const { jarvis, colors } = require('./ui');

const execAsync = promisify(exec);

/**
 * Check if repository exists in repos.json
 * @param {string} repoName - Repository name
 * @returns {boolean} True if exists
 */
function repositoryExists(repoName) {
  return config.repos.repositories[repoName] !== undefined;
}

/**
 * Get GitHub username from gh CLI or config
 * @returns {Promise<string>} GitHub username
 */
async function getGitHubUsername() {
  // Try to get from environment variable first
  if (process.env.GITHUB_DEFAULT_USERNAME) {
    console.log(jarvis.info(`Using GitHub username from env: ${process.env.GITHUB_DEFAULT_USERNAME}`));
    return process.env.GITHUB_DEFAULT_USERNAME;
  }

  // Try gh CLI
  try {
    const { stdout } = await execAsync('gh api user --jq .login', {
      timeout: 10000
    });
    return stdout.trim();
  } catch (error) {
    console.log(jarvis.warning('Failed to get GitHub username from gh CLI'));

    // Fallback to default username
    const defaultUsername = 'kuxala';
    console.log(jarvis.info(`Using default GitHub username: ${defaultUsername}`));
    return defaultUsername;
  }
}

/**
 * Create a new private GitHub repository
 * @param {string} repoName - Name of the repository
 * @param {string} owner - GitHub username or organization
 * @param {object} options - Additional options
 * @returns {Promise<object>} Repository information
 */
async function createGitHubRepo(repoName, owner, options = {}) {
  const {
    description = `Auto-created repository for ${repoName}`,
    isPrivate = true
  } = options;

  console.log(jarvis.processing(`Creating GitHub repository ${colors.bright}${owner}/${repoName}${colors.reset}...`));

  try {
    const privateFlag = isPrivate ? '--private' : '--public';

    // Try to create repo on GitHub using gh CLI
    const { stdout } = await execAsync(
      `gh repo create ${owner}/${repoName} ${privateFlag} --description "${description}" --clone`,
      {
        timeout: 60000,
        cwd: path.join(process.env.HOME, 'Documents', 'Personal-Projects')
      }
    );

    console.log(jarvis.success(`Repository created: ${colors.bright}${owner}/${repoName}${colors.reset}`));

    return {
      owner,
      repo: repoName,
      url: `https://github.com/${owner}/${repoName}`,
      cloned: true
    };
  } catch (error) {
    console.log(jarvis.warning(`Could not auto-create via gh CLI: ${error.message}`));
    console.log(jarvis.info(`Please create the repository manually:`));
    console.log(jarvis.info(`1. Visit: https://github.com/new`));
    console.log(jarvis.info(`2. Name: ${repoName}`));
    console.log(jarvis.info(`3. Visibility: ${isPrivate ? 'Private' : 'Public'}`));
    console.log(jarvis.info(`4. Click "Create repository"`));

    throw new Error(`Please create repository manually at https://github.com/new (name: ${repoName}, private: ${isPrivate})`);
  }
}

/**
 * Clone repository to local path
 * @param {string} owner - GitHub username or organization
 * @param {string} repoName - Repository name
 * @param {string} targetPath - Local path to clone to
 * @returns {Promise<void>}
 */
async function cloneRepository(owner, repoName, targetPath) {
  console.log(jarvis.processing(`Cloning repository to ${colors.bright}${targetPath}${colors.reset}...`));

  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Clone repository
    await execAsync(
      `gh repo clone ${owner}/${repoName} "${targetPath}"`,
      {
        timeout: 60000
      }
    );

    console.log(jarvis.success(`Repository cloned to ${targetPath}`));
  } catch (error) {
    console.log(jarvis.error(`Failed to clone repository: ${error.message}`));
    throw error;
  }
}

/**
 * Add repository to repos.json
 * @param {string} repoName - Repository identifier/key
 * @param {object} repoConfig - Repository configuration
 * @returns {Promise<void>}
 */
async function addToReposConfig(repoName, repoConfig) {
  const reposConfigPath = config.files.reposConfig;

  try {
    // Read current config
    let reposData = { default: null, repositories: {} };
    if (fs.existsSync(reposConfigPath)) {
      reposData = JSON.parse(fs.readFileSync(reposConfigPath, 'utf8'));
    }

    // Add new repository
    reposData.repositories[repoName] = repoConfig;

    // Write back to file
    fs.writeFileSync(reposConfigPath, JSON.stringify(reposData, null, 2));

    console.log(jarvis.success(`Added ${colors.bright}${repoName}${colors.reset} to repos.json`));

    // Reload config in memory
    config.repos.repositories[repoName] = repoConfig;
  } catch (error) {
    console.log(jarvis.error(`Failed to update repos.json: ${error.message}`));
    throw error;
  }
}

/**
 * Auto-create repository if it doesn't exist
 * @param {string} repoName - Repository name/identifier
 * @param {object} options - Creation options
 * @returns {Promise<object>} Repository configuration
 */
async function ensureRepository(repoName, options = {}) {
  // Check if repository already exists in config
  if (repositoryExists(repoName)) {
    console.log(jarvis.info(`Repository ${colors.bright}${repoName}${colors.reset} already configured`));
    return config.resolveRepoConfig(repoName);
  }

  console.log(jarvis.warning(`Repository ${colors.bright}${repoName}${colors.reset} not found in repos.json`));

  const {
    owner = null,
    autoCreate = true,
    baseDir = path.join(process.env.HOME, 'Documents', 'Personal-Projects'),
    isPrivate = true,
    baseBranch = 'main'
  } = options;

  if (!autoCreate) {
    throw new Error(`Repository "${repoName}" not configured in repos.json. Please add it manually.`);
  }

  // Get GitHub username if owner not provided
  const repoOwner = owner || await getGitHubUsername();

  console.log(jarvis.ai(`Auto-creating private repository ${colors.bright}${repoOwner}/${repoName}${colors.reset}...`));

  // Determine local path
  const localPath = path.join(baseDir, repoName);

  try {
    // Create GitHub repository and clone it
    const repoInfo = await createGitHubRepo(repoName, repoOwner, {
      isPrivate,
      description: `Auto-created for task automation`
    });

    // Repository is already cloned by gh repo create --clone
    // Just verify it exists
    if (!fs.existsSync(localPath)) {
      // If somehow it wasn't cloned, clone it manually
      await cloneRepository(repoOwner, repoName, localPath);
    }

    // Create repository configuration
    const repoConfig = {
      owner: repoOwner,
      repo: repoName,
      path: localPath,
      baseBranch: baseBranch
    };

    // Add to repos.json
    await addToReposConfig(repoName, repoConfig);

    console.log(jarvis.success(`Repository ${colors.bright}${repoName}${colors.reset} ready!`));
    console.log(jarvis.info(`Path: ${localPath}`));
    console.log(jarvis.info(`URL: ${repoInfo.url}`));

    return {
      ...repoConfig,
      token: process.env.GITHUB_TOKEN
    };

  } catch (error) {
    console.log(jarvis.error(`Auto-create failed: ${error.message}`));
    console.log(jarvis.warning(`Attempting to use existing repository or manual creation...`));

    // Check if repository already exists locally
    if (fs.existsSync(localPath) && fs.existsSync(path.join(localPath, '.git'))) {
      console.log(jarvis.success(`Found existing local repository at ${localPath}`));

      // Create repository configuration
      const repoConfig = {
        owner: repoOwner,
        repo: repoName,
        path: localPath,
        baseBranch: baseBranch
      };

      // Add to repos.json
      await addToReposConfig(repoName, repoConfig);

      return {
        ...repoConfig,
        token: process.env.GITHUB_TOKEN
      };
    }

    // Repository doesn't exist - give instructions
    console.log(jarvis.error(`Repository not found locally at: ${localPath}`));
    console.log(jarvis.info(`\nPlease create the repository manually:`));
    console.log(jarvis.info(`1. Create on GitHub: https://github.com/new`));
    console.log(jarvis.info(`   - Name: ${repoName}`));
    console.log(jarvis.info(`   - Owner: ${repoOwner}`));
    console.log(jarvis.info(`   - Visibility: Private`));
    console.log(jarvis.info(`2. Clone it: git clone git@github.com:${repoOwner}/${repoName}.git ${localPath}`));
    console.log(jarvis.info(`3. Re-run the task\n`));

    throw new Error(`Repository "${repoName}" not found. Please create it manually.`);
  }
}

module.exports = {
  repositoryExists,
  getGitHubUsername,
  createGitHubRepo,
  cloneRepository,
  addToReposConfig,
  ensureRepository
};
