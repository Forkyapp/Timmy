/**
 * Discord to ClickUp Bridge
 * Converts Discord messages into ClickUp tasks
 */

import type { AnalyzedMessage } from '@/types/discord';
import type { ClickUpTask } from '@/types/clickup';
import { ClickUpClient } from '@/infrastructure/api/clickup.client';
import config from '@/shared/config';
import { logger } from '@/shared/utils/logger.util';
import { timmy } from '@/shared/ui';

export interface DiscordTaskCreationResult {
  success: boolean;
  task?: ClickUpTask;
  error?: string;
}

/**
 * Extract task title from Discord message
 * Looks for patterns like "Bug: title" or "Issue: title"
 * Falls back to first sentence or truncated content
 */
function extractTitle(message: AnalyzedMessage): string {
  const content = message.message.content;

  // Remove bot mentions from title
  const cleanContent = content.replace(/<@!?\d+>/g, '').trim();

  // Pattern 1: "Bug: Title here" or "Issue: Title here"
  const colonMatch = cleanContent.match(/(?:bug|issue|error|problem|fix):\s*([^\n]+)/i);
  if (colonMatch) {
    return colonMatch[1].trim().substring(0, 100);
  }

  // Pattern 2: First sentence
  const sentenceMatch = cleanContent.match(/^([^.!?\n]+)/);
  if (sentenceMatch) {
    return sentenceMatch[1].trim().substring(0, 100);
  }

  // Fallback: Truncate content
  return cleanContent.substring(0, 100).trim() || 'Untitled Discord Task';
}

/**
 * Extract task description from Discord message
 * Includes full message content, author, and Discord link
 */
function extractDescription(message: AnalyzedMessage): string {
  const { message: msg, priority, matches } = message;

  return `
**Reported via Discord**

**Author:** ${msg.author.username}
**Channel:** <#${msg.channelId}>
**Priority:** ${priority}
**Keywords:** ${matches.map(m => m.keyword).join(', ')}
**Message Link:** https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id}

---

**Issue Description:**

${msg.content}

${msg.attachments.length > 0 ? `\n**Attachments:**\n${msg.attachments.map(a => `- [${a.filename}](${a.url})`).join('\n')}` : ''}
`.trim();
}

/**
 * Convert priority to ClickUp priority value
 * 1 = Urgent, 2 = High, 3 = Normal, 4 = Low
 */
function getPriorityValue(priority: string): number {
  switch (priority) {
    case 'HIGH': return 2;
    case 'MEDIUM': return 3;
    case 'LOW': return 4;
    default: return 3;
  }
}

/**
 * Create ClickUp task from Discord message
 */
export async function createTaskFromDiscordMessage(
  analyzedMessage: AnalyzedMessage
): Promise<DiscordTaskCreationResult> {
  try {
    // Validate configuration
    if (!config.clickup.listId) {
      logger.warn('CLICKUP_LIST_ID not configured - skipping task creation');
      return {
        success: false,
        error: 'CLICKUP_LIST_ID not configured in .env. Discord task creation is disabled.',
      };
    }

    if (!config.clickup.apiKey) {
      throw new Error('CLICKUP_API_KEY not configured in .env');
    }

    if (!config.clickup.botUserId) {
      throw new Error('CLICKUP_BOT_USER_ID not configured in .env');
    }

    // Extract task details
    const title = extractTitle(analyzedMessage);
    const description = extractDescription(analyzedMessage);
    const priority = getPriorityValue(analyzedMessage.priority);

    logger.info('Creating ClickUp task from Discord message', {
      messageId: analyzedMessage.message.id,
      author: analyzedMessage.message.author.username,
      title,
      priority: analyzedMessage.priority,
    });

    // Create ClickUp client
    const clickupClient = new ClickUpClient({
      apiKey: config.clickup.apiKey,
    });

    // Create task
    const task = await clickupClient.createTask(config.clickup.listId, {
      name: title,
      description,
      assignees: [config.clickup.botUserId],
      status: 'bot in progress',  // This triggers the pipeline
      priority,
      tags: ['discord', ...analyzedMessage.matches.map(m => m.keyword)],
    });

    logger.info('Created ClickUp task from Discord message', {
      taskId: task.id,
      messageId: analyzedMessage.message.id,
      author: analyzedMessage.message.author.username,
    });

    console.log(timmy.success(`✓ Created ClickUp task: ${task.id}`));
    console.log(timmy.info(`  Title: ${title}`));
    console.log(timmy.info(`  Priority: ${analyzedMessage.priority}`));

    return { success: true, task };

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to create ClickUp task from Discord message', err);

    return {
      success: false,
      error: err.message,
    };
  }
}
