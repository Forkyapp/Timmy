/**
 * Projects command - Manage multiple projects
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { timmy, colors } from '@/shared/ui';

function getConfigDir(): string {
  return process.env.TIMMY_CONFIG_DIR ||
    (process.env.XDG_CONFIG_HOME
      ? path.join(process.env.XDG_CONFIG_HOME, 'timmy')
      : path.join(os.homedir(), '.timmy'));
}

interface Project {
  name: string;
  description?: string;
  clickup: { workspaceId: string };
  github: {
    owner: string;
    repo: string;
    path: string;
    baseBranch: string;
  };
}

interface ProjectsFile {
  projects: Record<string, Project>;
}

interface WorkspaceFile {
  active: string;
}

export function projectsCommand(): Command {
  const cmd = new Command('projects')
    .description('Manage projects');

  cmd
    .command('list')
    .alias('ls')
    .description('List all projects')
    .action(listProjects);

  cmd
    .command('switch <name>')
    .description('Switch to a different project')
    .action(switchProject);

  cmd
    .command('add')
    .description('Add a new project')
    .action(addProject);

  cmd
    .command('remove <name>')
    .description('Remove a project')
    .action(removeProject);

  cmd
    .command('current')
    .description('Show current project')
    .action(showCurrent);

  // Default action
  cmd.action(listProjects);

  return cmd;
}

function loadProjects(): ProjectsFile {
  const configDir = getConfigDir();
  const projectsPath = path.join(configDir, 'projects.json');

  if (!fs.existsSync(projectsPath)) {
    return { projects: {} };
  }

  return JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
}

function saveProjects(data: ProjectsFile): void {
  const configDir = getConfigDir();
  const projectsPath = path.join(configDir, 'projects.json');
  fs.writeFileSync(projectsPath, JSON.stringify(data, null, 2));
}

function loadWorkspace(): WorkspaceFile {
  const configDir = getConfigDir();
  const workspacePath = path.join(configDir, 'workspace.json');

  if (!fs.existsSync(workspacePath)) {
    return { active: 'default' };
  }

  return JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
}

function saveWorkspace(data: WorkspaceFile): void {
  const configDir = getConfigDir();
  const workspacePath = path.join(configDir, 'workspace.json');
  fs.writeFileSync(workspacePath, JSON.stringify(data, null, 2));
}

async function listProjects(): Promise<void> {
  console.log(timmy.section('Projects'));

  const projectsData = loadProjects();
  const workspace = loadWorkspace();
  const projects = Object.entries(projectsData.projects);

  if (projects.length === 0) {
    console.log(`\n${colors.yellow}No projects configured.${colors.reset}`);
    console.log(`Run ${colors.cyan}timmy projects add${colors.reset} to add one.\n`);
    return;
  }

  console.log('');
  for (const [key, project] of projects) {
    const isActive = key === workspace.active;
    const marker = isActive ? colors.green + ' (active)' + colors.reset : '';

    console.log(`  ${colors.cyan}${key}${colors.reset}${marker}`);
    console.log(`    Repository: ${project.github.owner}/${project.github.repo}`);
    console.log(`    Path: ${project.github.path}`);
    console.log('');
  }
}

async function switchProject(name: string): Promise<void> {
  const projectsData = loadProjects();

  if (!projectsData.projects[name]) {
    console.log(`${colors.red}Project not found: ${name}${colors.reset}`);
    console.log(`\nAvailable projects:`);
    Object.keys(projectsData.projects).forEach(p => console.log(`  - ${p}`));
    return;
  }

  const workspace = loadWorkspace();
  workspace.active = name;
  saveWorkspace(workspace);

  console.log(`${colors.green}Switched to project:${colors.reset} ${name}`);
}

async function addProject(): Promise<void> {
  console.log(timmy.section('Add New Project'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'key',
      message: 'Project key (short identifier):',
      validate: (input: string) => {
        if (!input) return 'Key is required';
        if (!/^[a-z0-9-]+$/.test(input)) return 'Key must be lowercase alphanumeric with hyphens';
        return true;
      },
    },
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      validate: (input: string) => input.length > 0 || 'Name is required',
    },
    {
      type: 'input',
      name: 'workspaceId',
      message: 'ClickUp Workspace ID:',
      validate: (input: string) => input.length > 0 || 'Workspace ID is required',
    },
    {
      type: 'input',
      name: 'githubOwner',
      message: 'GitHub owner:',
      validate: (input: string) => input.length > 0 || 'Owner is required',
    },
    {
      type: 'input',
      name: 'githubRepo',
      message: 'GitHub repo:',
      validate: (input: string) => input.length > 0 || 'Repo is required',
    },
    {
      type: 'input',
      name: 'githubPath',
      message: 'Local path to repo:',
      validate: (input: string) => {
        if (!input) return 'Path is required';
        const expanded = input.replace(/^~/, os.homedir());
        if (!fs.existsSync(expanded)) return 'Path does not exist';
        return true;
      },
    },
    {
      type: 'input',
      name: 'baseBranch',
      message: 'Base branch:',
      default: 'main',
    },
  ]);

  const projectsData = loadProjects();
  projectsData.projects[answers.key] = {
    name: answers.name,
    clickup: { workspaceId: answers.workspaceId },
    github: {
      owner: answers.githubOwner,
      repo: answers.githubRepo,
      path: answers.githubPath.replace(/^~/, os.homedir()),
      baseBranch: answers.baseBranch,
    },
  };

  saveProjects(projectsData);
  console.log(`\n${colors.green}Project added:${colors.reset} ${answers.key}`);

  const { switchNow } = await inquirer.prompt([{
    type: 'confirm',
    name: 'switchNow',
    message: 'Switch to this project now?',
    default: true,
  }]);

  if (switchNow) {
    await switchProject(answers.key);
  }
}

async function removeProject(name: string): Promise<void> {
  const projectsData = loadProjects();

  if (!projectsData.projects[name]) {
    console.log(`${colors.red}Project not found: ${name}${colors.reset}`);
    return;
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Remove project "${name}"?`,
    default: false,
  }]);

  if (!confirm) {
    console.log('Cancelled.');
    return;
  }

  delete projectsData.projects[name];
  saveProjects(projectsData);

  // If active project was removed, switch to first available
  const workspace = loadWorkspace();
  if (workspace.active === name) {
    const remaining = Object.keys(projectsData.projects);
    if (remaining.length > 0) {
      workspace.active = remaining[0];
      saveWorkspace(workspace);
      console.log(`Switched to: ${remaining[0]}`);
    }
  }

  console.log(`${colors.green}Project removed:${colors.reset} ${name}`);
}

async function showCurrent(): Promise<void> {
  const workspace = loadWorkspace();
  const projectsData = loadProjects();
  const project = projectsData.projects[workspace.active];

  if (!project) {
    console.log(`${colors.yellow}No active project${colors.reset}`);
    return;
  }

  console.log(`${colors.cyan}${workspace.active}${colors.reset}`);
  console.log(`  ${project.github.owner}/${project.github.repo}`);
}
