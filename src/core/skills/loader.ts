import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/shared/utils/logger.util';

const SKILLS_DIR = path.join(__dirname);

/**
 * In-memory skill cache to avoid repeated file reads
 */
const skillCache = new Map<string, { content: string; loadedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load a single skill file by path relative to skills directory.
 * e.g. loadSkill('analysis/SKILL.md') or loadSkill('review/SKILL.md')
 */
async function loadSkill(relativePath: string): Promise<string> {
  const cached = skillCache.get(relativePath);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.content;
  }

  const skillPath = path.join(SKILLS_DIR, relativePath);
  try {
    const content = await fs.readFile(skillPath, 'utf8');
    skillCache.set(relativePath, { content, loadedAt: Date.now() });
    return content;
  } catch (error) {
    logger.error(`Failed to load skill: ${relativePath}`, error as Error);
    throw new Error(`Skill not found: ${relativePath}`);
  }
}

/**
 * Load a skill's SKILL.md and resolve all @include directives.
 * Includes are relative to the skill's directory.
 *
 * e.g. loadSkillWithDeps('analysis') loads analysis/SKILL.md
 * and resolves any @include directives within it.
 */
async function loadSkillWithDeps(skillName: string): Promise<string> {
  const mainSkill = await loadSkill(path.join(skillName, 'SKILL.md'));
  return resolveIncludes(mainSkill, skillName);
}

/**
 * Resolve @include directives in skill content.
 * Supports: @include filename.md (relative to skill dir or skills root)
 */
async function resolveIncludes(content: string, skillDir: string): Promise<string> {
  const includePattern = /^@include\s+(.+)$/gm;
  const matches = [...content.matchAll(includePattern)];

  if (matches.length === 0) {
    return content;
  }

  let resolved = content;

  for (const match of matches) {
    const includePath = match[1].trim();
    try {
      // Try relative to skills root first (e.g. "analysis/templates/feature-spec.md")
      const included = await loadSkill(includePath);
      resolved = resolved.replace(match[0], included);
    } catch {
      try {
        // Try relative to current skill directory
        const included = await loadSkill(path.join(skillDir, includePath));
        resolved = resolved.replace(match[0], included);
      } catch {
        logger.warn(`Could not resolve @include: ${includePath} (in skill ${skillDir})`);
        resolved = resolved.replace(match[0], `<!-- Missing include: ${includePath} -->`);
      }
    }
  }

  return resolved;
}

/**
 * Apply template variables to a skill string.
 * Replaces {{varName}} with the corresponding value.
 */
function applyVariables(skill: string, variables: Record<string, string>): string {
  let result = skill;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Load a skill, resolve dependencies, and apply template variables.
 * This is the main entry point for services.
 */
async function loadAndApplySkill(
  skillName: string,
  variables: Record<string, string> = {}
): Promise<string> {
  const skill = await loadSkillWithDeps(skillName);
  return applyVariables(skill, variables);
}

/**
 * Load a single skill file (not SKILL.md) and apply variables.
 * Useful for loading templates like fallback.md directly.
 */
async function loadTemplate(
  relativePath: string,
  variables: Record<string, string> = {}
): Promise<string> {
  const content = await loadSkill(relativePath);
  return applyVariables(content, variables);
}

/**
 * Invalidate cache for a specific skill or all skills.
 */
function invalidateCache(relativePath?: string): void {
  if (relativePath) {
    skillCache.delete(relativePath);
  } else {
    skillCache.clear();
  }
}

/**
 * List available skills (directories containing SKILL.md).
 */
async function listSkills(): Promise<string[]> {
  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
  const skills: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      try {
        await fs.access(path.join(SKILLS_DIR, entry.name, 'SKILL.md'));
        skills.push(entry.name);
      } catch {
        // No SKILL.md in this directory, skip
      }
    }
  }

  return skills;
}

export {
  loadSkill,
  loadSkillWithDeps,
  loadAndApplySkill,
  loadTemplate,
  applyVariables,
  invalidateCache,
  listSkills,
  SKILLS_DIR,
};
