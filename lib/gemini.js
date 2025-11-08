const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const config = require('./config');
const { jarvis, colors } = require('./ui');
const { withRetry } = require('./retry');

const execAsync = promisify(exec);

/**
 * Analyze task using Gemini CLI
 * @param {object} task - ClickUp task object
 * @param {object} options - Options object
 * @param {object} options.repoConfig - Repository configuration
 */
async function analyzeTask(task, options = {}) {
  const taskId = task.id;
  const taskTitle = task.name;
  const taskDescription = task.description || task.text_content || '';
  const { repoConfig } = options;

  // Use provided repoConfig or fall back to legacy config
  const repoPath = repoConfig?.path || config.github.repoPath;
  const repoOwner = repoConfig?.owner || config.github.owner;
  const repoName = repoConfig?.repo || config.github.repo;

  console.log(jarvis.processing(`${colors.bright}Gemini${colors.reset} analyzing task ${colors.bright}${taskId}${colors.reset}...`));

  // Create feature directory
  const featureDir = path.join(config.files.featuresDir, taskId);
  if (!fs.existsSync(featureDir)) {
    fs.mkdirSync(featureDir, { recursive: true });
  }

  // Create log file and progress file paths
  const timestamp = Date.now();
  const logFile = path.join(__dirname, '..', 'logs', `${taskId}-gemini-${timestamp}.log`);
  const progressFile = path.join(__dirname, '..', 'progress', `${taskId}-gemini.json`);

  // Initialize progress
  const updateProgress = (step, total, currentStep) => {
    const progress = {
      agent: 'gemini',
      taskId,
      stage: 'analyzing',
      currentStep,
      completedSteps: step,
      totalSteps: total,
      lastUpdate: new Date().toISOString()
    };
    try {
      fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    } catch (err) {
      // Silent fail - don't break execution
    }
  };

  updateProgress(0, 3, 'Starting analysis...');

  const analysisPrompt = `You are a senior software architect analyzing a development task.

**Task ID:** ${taskId}
**Title:** ${taskTitle}
**Description:**
${taskDescription}

**Repository:** ${repoPath}
**Owner/Org:** ${repoOwner}
**Repo Name:** ${repoName}

Your job is to analyze this task and create a detailed feature specification. DO NOT include any code implementation.

Please provide:

1. **Feature Overview** (2-3 sentences)
   - What needs to be built
   - Why it's needed
   - Expected outcome

2. **Files to Modify** (CRITICAL - Be Specific)
   List exact file paths that need to be created or modified:
   - \`path/to/file.js\` - What changes are needed
   - \`path/to/another.js\` - What changes are needed
   - Include both new files and existing files to modify
   - Use relative paths from repository root

3. **Technical Approach** (4-6 bullet points)
   - High-level architecture decisions
   - Which parts of the codebase will be affected
   - Any dependencies or prerequisites
   - Potential challenges

4. **Implementation Steps** (numbered list)
   - Break down into logical steps
   - Reference specific files from "Files to Modify" section
   - Order of implementation

5. **Testing Strategy** (3-4 bullet points)
   - What should be tested
   - Types of tests needed
   - Edge cases to consider
   - Which test files to create/modify

6. **Acceptance Criteria** (checklist)
   - Specific requirements that must be met
   - Definition of done
   - How to verify the feature works

Format your response in clear Markdown. Be specific about file paths and changes. Focus on WHAT and WHY, not HOW (no code).`;

  try {
    // Save prompt to file
    const promptFile = path.join(featureDir, 'prompt.txt');
    fs.writeFileSync(promptFile, analysisPrompt);

    updateProgress(1, 3, 'Calling Gemini AI...');

    // Call Gemini CLI with retry and log output
    const result = await withRetry(
      async () => {
        const { stdout, stderr } = await execAsync(
          `cat "${promptFile}" | ${config.system.geminiCliPath} --yolo 2>&1 | tee -a "${logFile}"`,
          {
            timeout: 120000, // 2 minute timeout
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            shell: '/bin/bash'
          }
        );
        return stdout;
      },
      {
        maxAttempts: 3,
        timeoutMs: 120000,
        onRetry: (attempt) => {
          console.log(jarvis.info(`${colors.bright}Gemini${colors.reset} retry attempt ${attempt}/3...`));
          updateProgress(1, 3, `Retrying analysis (attempt ${attempt}/3)...`);
        }
      }
    );

    updateProgress(2, 3, 'Writing feature specification...');

    // Save feature specification to file
    const featureSpecFile = path.join(featureDir, 'feature-spec.md');
    fs.writeFileSync(featureSpecFile, result.trim());

    updateProgress(3, 3, 'Analysis complete');

    console.log(jarvis.success(`Feature spec created: ${featureSpecFile}`));

    return {
      success: true,
      featureSpecFile,
      featureDir,
      content: result.trim(),
      logFile,
      progressFile
    };

  } catch (error) {
    console.log(jarvis.error(`Gemini analysis failed: ${error.message}`));

    // Create fallback feature spec
    const fallbackSpec = `# Feature Specification - ${taskTitle}

**Status:** Auto-generated fallback (Gemini unavailable)

## Feature Overview
${taskDescription || 'No description provided'}

## Files to Modify
⚠️ Manual analysis required - please identify affected files

## Technical Approach
- Implement the feature as described in the task description
- Follow existing code patterns and conventions
- Write tests for new functionality
- Update documentation as needed

## Implementation Steps
1. Review task requirements carefully
2. Identify affected files and modules
3. Implement changes incrementally
4. Test thoroughly
5. Create pull request

## Testing Strategy
- Write unit tests for new functionality
- Test edge cases
- Verify integration with existing features

## Acceptance Criteria
- [ ] Feature implemented as described
- [ ] Tests pass
- [ ] Code follows project conventions
- [ ] PR created and ready for review

**Note:** This is a fallback specification. Gemini AI analysis was unavailable.
`;

    const featureSpecFile = path.join(featureDir, 'feature-spec.md');
    fs.writeFileSync(featureSpecFile, fallbackSpec);

    return {
      success: false,
      featureSpecFile,
      featureDir,
      content: fallbackSpec,
      fallback: true,
      error: error.message
    };
  }
}

/**
 * Read feature specification file
 */
function readFeatureSpec(taskId) {
  const featureSpecFile = path.join(config.files.featuresDir, taskId, 'feature-spec.md');

  if (!fs.existsSync(featureSpecFile)) {
    return null;
  }

  return {
    file: featureSpecFile,
    content: fs.readFileSync(featureSpecFile, 'utf8')
  };
}

/**
 * Check if feature spec exists for task
 */
function hasFeatureSpec(taskId) {
  const featureSpecFile = path.join(config.files.featuresDir, taskId, 'feature-spec.md');
  return fs.existsSync(featureSpecFile);
}

module.exports = {
  analyzeTask,
  readFeatureSpec,
  hasFeatureSpec,
  // Backwards compatibility
  readAnalysis: readFeatureSpec,
  hasAnalysis: hasFeatureSpec
};
