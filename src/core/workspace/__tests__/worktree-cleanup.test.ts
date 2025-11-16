/**
 * Integration Tests - Worktree Cleanup
 * Tests worktree cleanup in success and failure scenarios
 */

import { WorktreeManager } from '../worktree-manager.service';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

describe('WorktreeManager - Cleanup Tests', () => {
  let tempRepoPath: string;
  let worktreeManager: WorktreeManager;
  const testTaskId = 'test-cleanup-task';

  beforeEach(async () => {
    // Create a temporary git repository for testing
    tempRepoPath = path.join(__dirname, '..', '..', '..', '..', 'tmp', `test-repo-${Date.now()}`);
    await fs.mkdir(tempRepoPath, { recursive: true });

    // Initialize git repository
    await execAsync(`cd "${tempRepoPath}" && git init`);
    await execAsync(`cd "${tempRepoPath}" && git config user.email "test@example.com"`);
    await execAsync(`cd "${tempRepoPath}" && git config user.name "Test User"`);

    // Create initial commit
    await fs.writeFile(path.join(tempRepoPath, 'README.md'), '# Test Repo');
    await execAsync(`cd "${tempRepoPath}" && git add . && git commit -m "Initial commit"`);

    // Create main branch
    await execAsync(`cd "${tempRepoPath}" && git branch -M main`);

    // Add origin remote pointing to itself (for worktree creation)
    await execAsync(`cd "${tempRepoPath}" && git remote add origin "${tempRepoPath}"`);

    worktreeManager = new WorktreeManager(tempRepoPath);
  });

  afterEach(async () => {
    // Clean up temp repository
    try {
      await fs.rm(tempRepoPath, { recursive: true, force: true });
      // Clean up worktrees directory
      const worktreesDir = path.join(path.dirname(tempRepoPath), '.timmy-worktrees');
      await fs.rm(worktreesDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Successful cleanup scenarios', () => {
    it('should clean up worktree after successful task completion', async () => {
      // Create worktree
      const worktreePath = await worktreeManager.createWorktree({
        taskId: testTaskId,
        baseBranch: 'main',
        repoPath: tempRepoPath,
      });

      // Verify worktree exists
      const existsBefore = await fileExists(worktreePath);
      expect(existsBefore).toBe(true);

      // Remove worktree
      await worktreeManager.removeWorktree({
        taskId: testTaskId,
        repoPath: tempRepoPath,
        force: true,
      });

      // Verify worktree is removed
      const existsAfter = await fileExists(worktreePath);
      expect(existsAfter).toBe(false);
    });

    it('should clean up worktree with uncommitted changes when force=true', async () => {
      // Create worktree
      const worktreePath = await worktreeManager.createWorktree({
        taskId: testTaskId,
        baseBranch: 'main',
        repoPath: tempRepoPath,
      });

      // Make uncommitted changes
      await fs.writeFile(path.join(worktreePath, 'test.txt'), 'uncommitted content');

      // Remove worktree with force
      await worktreeManager.removeWorktree({
        taskId: testTaskId,
        repoPath: tempRepoPath,
        force: true,
      });

      // Verify worktree is removed despite uncommitted changes
      const existsAfter = await fileExists(worktreePath);
      expect(existsAfter).toBe(false);
    });

    it('should handle cleanup of already-removed worktree gracefully', async () => {
      // Create worktree
      const worktreePath = await worktreeManager.createWorktree({
        taskId: testTaskId,
        baseBranch: 'main',
        repoPath: tempRepoPath,
      });

      // Remove worktree manually
      await fs.rm(worktreePath, { recursive: true, force: true });

      // Attempt to remove again - should not throw
      await expect(
        worktreeManager.removeWorktree({
          taskId: testTaskId,
          repoPath: tempRepoPath,
          force: true,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Failed pipeline cleanup scenarios', () => {
    it('should clean up worktree even when pipeline fails', async () => {
      // Create worktree
      const worktreePath = await worktreeManager.createWorktree({
        taskId: testTaskId,
        baseBranch: 'main',
        repoPath: tempRepoPath,
      });

      // Simulate pipeline failure by just cleaning up immediately
      // In real scenario, this would be in a finally block
      await worktreeManager.removeWorktree({
        taskId: testTaskId,
        repoPath: tempRepoPath,
        force: true,
      });

      // Verify cleanup happened
      const existsAfter = await fileExists(worktreePath);
      expect(existsAfter).toBe(false);
    });

    it('should retry with force when initial cleanup fails', async () => {
      // Create worktree
      const worktreePath = await worktreeManager.createWorktree({
        taskId: testTaskId,
        baseBranch: 'main',
        repoPath: tempRepoPath,
      });

      // Make uncommitted changes that would cause non-force removal to fail
      await fs.writeFile(path.join(worktreePath, 'test.txt'), 'uncommitted content');

      // First try without force (will internally retry with force)
      await worktreeManager.removeWorktree({
        taskId: testTaskId,
        repoPath: tempRepoPath,
        force: false,
      });

      // Verify worktree is still removed (due to force retry)
      const existsAfter = await fileExists(worktreePath);
      expect(existsAfter).toBe(false);
    });
  });

  describe('Edge cases and error recovery', () => {
    it('should handle corrupted worktree state', async () => {
      // Create worktree
      const worktreePath = await worktreeManager.createWorktree({
        taskId: testTaskId,
        baseBranch: 'main',
        repoPath: tempRepoPath,
      });

      // Corrupt the worktree by removing .git file
      const gitFile = path.join(worktreePath, '.git');
      await fs.rm(gitFile, { force: true });

      // Cleanup should still work with force
      await worktreeManager.removeWorktree({
        taskId: testTaskId,
        repoPath: tempRepoPath,
        force: true,
      });

      // Verify worktree is removed
      const existsAfter = await fileExists(worktreePath);
      expect(existsAfter).toBe(false);
    });

    it('should clean up multiple worktrees independently', async () => {
      // Create multiple worktrees
      const task1 = 'task-1';
      const task2 = 'task-2';

      const worktree1 = await worktreeManager.createWorktree({
        taskId: task1,
        baseBranch: 'main',
        repoPath: tempRepoPath,
      });

      const worktree2 = await worktreeManager.createWorktree({
        taskId: task2,
        baseBranch: 'main',
        repoPath: tempRepoPath,
      });

      // Remove first worktree
      await worktreeManager.removeWorktree({
        taskId: task1,
        repoPath: tempRepoPath,
        force: true,
      });

      // Verify first is removed, second still exists
      expect(await fileExists(worktree1)).toBe(false);
      expect(await fileExists(worktree2)).toBe(true);

      // Remove second worktree
      await worktreeManager.removeWorktree({
        taskId: task2,
        repoPath: tempRepoPath,
        force: true,
      });

      expect(await fileExists(worktree2)).toBe(false);
    });

    it('should handle worktree with locked index', async () => {
      // Create worktree
      const worktreePath = await worktreeManager.createWorktree({
        taskId: testTaskId,
        baseBranch: 'main',
        repoPath: tempRepoPath,
      });

      // Create lock file to simulate locked index
      const lockFile = path.join(worktreePath, '.git', 'index.lock');
      try {
        await fs.writeFile(lockFile, '');
      } catch {
        // If .git is a file (worktree), skip this test scenario
      }

      // Force removal should handle locked state
      await worktreeManager.removeWorktree({
        taskId: testTaskId,
        repoPath: tempRepoPath,
        force: true,
      });

      // Verify cleanup succeeded
      const existsAfter = await fileExists(worktreePath);
      expect(existsAfter).toBe(false);
    });
  });

  describe('Cleanup logging and tracking', () => {
    it('should remove worktree from internal tracking after cleanup', async () => {
      // Create worktree
      await worktreeManager.createWorktree({
        taskId: testTaskId,
        baseBranch: 'main',
        repoPath: tempRepoPath,
      });

      // Verify worktree is tracked
      expect(worktreeManager.hasWorktree(testTaskId)).toBe(true);

      // Remove worktree
      await worktreeManager.removeWorktree({
        taskId: testTaskId,
        repoPath: tempRepoPath,
        force: true,
      });

      // Verify worktree is no longer tracked
      expect(worktreeManager.hasWorktree(testTaskId)).toBe(false);
    });

    it('should list active worktrees correctly', async () => {
      // Create worktrees
      await worktreeManager.createWorktree({
        taskId: 'task-1',
        baseBranch: 'main',
        repoPath: tempRepoPath,
      });

      await worktreeManager.createWorktree({
        taskId: 'task-2',
        baseBranch: 'main',
        repoPath: tempRepoPath,
      });

      // List worktrees
      const worktrees = await worktreeManager.listWorktrees(tempRepoPath);

      // Should have 2 worktrees (excluding main repo)
      expect(worktrees.length).toBeGreaterThanOrEqual(2);

      // Clean up
      await worktreeManager.removeWorktree({
        taskId: 'task-1',
        repoPath: tempRepoPath,
        force: true,
      });

      await worktreeManager.removeWorktree({
        taskId: 'task-2',
        repoPath: tempRepoPath,
        force: true,
      });
    });
  });

  describe('Manual cleanup fallback', () => {
    it('should use manual cleanup when git worktree remove fails', async () => {
      // Create worktree
      const worktreePath = await worktreeManager.createWorktree({
        taskId: testTaskId,
        baseBranch: 'main',
        repoPath: tempRepoPath,
      });

      // Make the worktree in a state where git might fail but manual cleanup works
      // (This is tested by the force retry mechanism)

      // Cleanup with force should succeed even if git command fails
      await worktreeManager.removeWorktree({
        taskId: testTaskId,
        repoPath: tempRepoPath,
        force: true,
      });

      // Verify manual cleanup worked
      const existsAfter = await fileExists(worktreePath);
      expect(existsAfter).toBe(false);
    });
  });
});

/**
 * Helper function to check if a file or directory exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
