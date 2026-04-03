import fs from 'fs';

// Mock dependencies before importing the module
jest.mock('fs');
jest.mock('../../../shared/utils/paths.util', () => ({
  findWorkspaceFile: jest.fn().mockReturnValue('/mock/.timmy/workspace.json'),
  findProjectsFile: jest.fn().mockReturnValue('/mock/.timmy/projects.json'),
  getConfigPath: jest.fn((name: string) => `/mock/.timmy/${name}`),
}));

import { workspace } from '../workspace.service';

const mockFs = fs as jest.Mocked<typeof fs>;

const sampleProjects = {
  projects: {
    'my-app': {
      name: 'My Application',
      description: 'Main app',
      clickup: { workspaceId: '12345' },
      github: {
        owner: 'org',
        repo: 'my-app',
        path: '/home/user/my-app',
        baseBranch: 'main',
      },
    },
    'other-app': {
      name: 'Other App',
      clickup: { workspaceId: '67890' },
      github: {
        owner: 'org',
        repo: 'other-app',
        path: '/home/user/other-app',
        baseBranch: 'develop',
      },
    },
  },
};

describe('workspace.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadWorkspace', () => {
    it('should load workspace config from file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ active: 'my-app' }));

      const result = workspace.loadWorkspace();
      expect(result).toEqual({ active: 'my-app' });
    });

    it('should return null if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = workspace.loadWorkspace();
      expect(result).toBeNull();
    });

    it('should return null and log error on parse failure', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      const result = workspace.loadWorkspace();
      expect(result).toBeNull();
    });
  });

  describe('saveWorkspace', () => {
    it('should write config to file', () => {
      workspace.saveWorkspace({ active: 'my-app' });
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/mock/.timmy/workspace.json',
        JSON.stringify({ active: 'my-app' }, null, 2)
      );
    });

    it('should log error on write failure', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('disk full');
      });

      workspace.saveWorkspace({ active: 'test' });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('loadProjects', () => {
    it('should load projects config', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(sampleProjects));

      const result = workspace.loadProjects();
      expect(result).toEqual(sampleProjects);
    });

    it('should return null if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = workspace.loadProjects();
      expect(result).toBeNull();
    });

    it('should return null on parse error', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('bad json');

      const result = workspace.loadProjects();
      expect(result).toBeNull();
    });
  });

  describe('getActiveProject', () => {
    it('should return active project config', () => {
      mockFs.existsSync.mockReturnValue(true);
      // First call for workspace, second for projects
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify({ active: 'my-app' }))
        .mockReturnValueOnce(JSON.stringify(sampleProjects));

      const result = workspace.getActiveProject();
      expect(result).toEqual(sampleProjects.projects['my-app']);
    });

    it('should support activeProject field name', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify({ activeProject: 'my-app' }))
        .mockReturnValueOnce(JSON.stringify(sampleProjects));

      const result = workspace.getActiveProject();
      expect(result).toEqual(sampleProjects.projects['my-app']);
    });

    it('should return null if no workspace config', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = workspace.getActiveProject();
      expect(result).toBeNull();
    });

    it('should return null if no active project name', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({}));

      const result = workspace.getActiveProject();
      expect(result).toBeNull();
    });

    it('should return null if project not found in projects.json', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify({ active: 'nonexistent' }))
        .mockReturnValueOnce(JSON.stringify(sampleProjects));

      const result = workspace.getActiveProject();
      expect(result).toBeNull();
    });

    it('should return null if projects file fails to load', () => {
      mockFs.existsSync
        .mockReturnValueOnce(true) // workspace exists
        .mockReturnValueOnce(false); // projects doesn't exist
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ active: 'my-app' }));

      const result = workspace.getActiveProject();
      expect(result).toBeNull();
    });
  });

  describe('getActiveProjectName', () => {
    it('should return active project name', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ active: 'my-app' }));

      expect(workspace.getActiveProjectName()).toBe('my-app');
    });

    it('should return null if no workspace', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(workspace.getActiveProjectName()).toBeNull();
    });
  });

  describe('switchProject', () => {
    it('should switch to valid project', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(sampleProjects));

      const result = workspace.switchProject('my-app');
      expect(result).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should return false if projects fail to load', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = workspace.switchProject('my-app');
      expect(result).toBe(false);
    });

    it('should return false if project name not found', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(sampleProjects));

      const result = workspace.switchProject('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('listProjects', () => {
    it('should list all projects', () => {
      mockFs.existsSync.mockReturnValue(true);
      // workspace readFileSync for getActiveProjectName, then projects
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify(sampleProjects)) // loadProjects
        .mockReturnValueOnce(JSON.stringify({ active: 'my-app' })); // getActiveProjectName -> loadWorkspace

      workspace.listProjects();
      expect(console.log).toHaveBeenCalled();
    });

    it('should handle no projects file', () => {
      mockFs.existsSync.mockReturnValue(false);

      workspace.listProjects();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('showCurrent', () => {
    it('should show current project info', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ active: 'my-app' }));

      // Mock getActiveProject to also load projects
      const origReadFileSync = mockFs.readFileSync;
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify({ active: 'my-app' })) // getActiveProjectName
        .mockReturnValueOnce(JSON.stringify({ active: 'my-app' })) // getActiveProject -> loadWorkspace
        .mockReturnValueOnce(JSON.stringify(sampleProjects)); // getActiveProject -> loadProjects

      workspace.showCurrent();
      expect(console.log).toHaveBeenCalled();
    });

    it('should handle no active project', () => {
      mockFs.existsSync.mockReturnValue(false);

      workspace.showCurrent();
      expect(console.error).toHaveBeenCalled();
    });
  });
});
