/**
 * Discord to ClickUp Bridge
 * Converts Discord messages into ClickUp tasks with AI reasoning
 */

import type { AnalyzedMessage, DiscordMessage } from '@/types/discord';
import type { ClickUpTask } from '@/types/clickup';
import { ClickUpClient } from '@/infrastructure/api/clickup.client';
import { DiscordClient } from '@/infrastructure/api/discord.client';
import { aiBrainService } from '@/core/ai-services/ai-brain.service';
import config from '@/shared/config';
import { CLICKUP_STATUS } from '@/shared/constants';
import { logger } from '@/shared/utils/logger.util';

export interface DiscordTaskCreationResult {
  success: boolean;
  task?: ClickUpTask;
  error?: string;
}

export interface AIAnalysisResult {
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  relatedContext: string[];
}

/**
 * Extract task title from Discord message
 * Looks for patterns like "Bug: title" or "Issue: title"
 * Falls back to first sentence or truncated content
 */
function extractTitle(message: AnalyzedMessage): string {
  const content = message.message.content;

  // Remove all Discord mentions (users and roles) from title
  const cleanContent = content
    .replace(/<@!?\d+>/g, '')      // Remove user mentions
    .replace(/<@&\d+>/g, '')       // Remove role mentions
    .replace(/<#\d+>/g, '')        // Remove channel mentions
    .trim();

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
 * Includes full message content and Discord link
 */
function extractDescription(message: AnalyzedMessage): string {
  const { message: msg } = message;

  // Remove Discord mentions from content
  const cleanContent = msg.content
    .replace(/<@!?\d+>/g, '')      // Remove user mentions
    .replace(/<@&\d+>/g, '')       // Remove role mentions
    .replace(/<#\d+>/g, '')        // Remove channel mentions
    .trim();

  return `
**Reported via Discord**

**Message Link:** https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id}

---

${cleanContent}

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
 * Determine task status based on message content
 * Returns 'bot in progress' if action keywords detected, otherwise 'to do'
 */
function determineTaskStatus(message: string): string {
  const content = message.toLowerCase();

  // Action keywords that indicate immediate work should start
  const actionKeywords = [
    'start working',
    'start work',
    'begin working',
    'begin work',
    'get started',
    'work on this',
    'work on it',
    'start this',
    'start it',
    'do this now',
    'do it now',
    'implement now',
    'fix now',
  ];

  // Check if any action keyword is present
  const hasActionKeyword = actionKeywords.some(keyword => content.includes(keyword));

  // Return appropriate status
  return hasActionKeyword ? CLICKUP_STATUS.BOT_IN_PROGRESS : CLICKUP_STATUS.TO_DO;
}

/**
 * Fetch conversation history for context
 * Gets previous messages from the same channel to understand the discussion
 */
async function fetchConversationHistory(
  discordClient: DiscordClient,
  channelId: string,
  currentMessageId: string,
  limit: number = 20
): Promise<DiscordMessage[]> {
  try {
    // Fetch messages before the current message
    const messages = await discordClient.fetchMessages(channelId, {
      channelIds: [channelId],
      limit,
      before: currentMessageId,
    });

    // Return in chronological order (oldest first)
    return messages.reverse();
  } catch (error) {
    logger.error('Failed to fetch conversation history', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Use AI to analyze the issue with conversation context
 * Returns structured analysis with reasoning
 */
async function analyzeIssueWithAI(
  currentMessage: DiscordMessage,
  conversationHistory: DiscordMessage[]
): Promise<AIAnalysisResult> {
  try {
    // Build conversation context
    const contextMessages = conversationHistory
      .filter(msg => !msg.author.bot) // Exclude bot messages
      .slice(-10) // Last 10 user messages for context
      .map(msg => `[${msg.author.username}]: ${msg.content}`)
      .join('\n');

    // Build prompt for AI analysis
    const analysisPrompt = `You are Timmy, an AI assistant that helps create well-structured development tasks from Discord conversations.

**Current Message:**
[${currentMessage.author.username}]: ${currentMessage.content}

${contextMessages ? `**Previous Conversation Context:**
${contextMessages}

` : ''}**Your Task:**
Analyze this message and the conversation context to understand the REAL issue being reported. Then create a structured task.

**Instructions:**
1. Read the conversation history to understand the full context
2. Identify the root problem (not just symptoms)
3. Determine if this is a bug, feature request, or improvement
4. Extract technical details mentioned in the conversation
5. Set appropriate priority based on severity

**Respond in this EXACT JSON format:**
{
  "title": "Clear, concise task title (max 100 chars)",
  "description": "Detailed description including:\n- What is the issue?\n- What was discussed in the conversation?\n- Technical details mentioned\n- Expected vs actual behavior (if bug)",
  "priority": "HIGH|MEDIUM|LOW",
  "reasoning": "Explain why you chose this title, priority, and what context clues you used",
  "relatedContext": ["Key quote 1 from conversation", "Key quote 2 from conversation"]
}

**Priority Guidelines:**
- HIGH: Crashes, data loss, security issues, blocking bugs
- MEDIUM: Bugs affecting functionality, important features
- LOW: Minor issues, enhancements, nice-to-haves

Respond ONLY with valid JSON, no other text.`;

    // Get AI analysis
    const response = await aiBrainService.chat(
      currentMessage.author.id,
      currentMessage.channelId,
      analysisPrompt
    );

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI did not return valid JSON');
    }

    const analysis: AIAnalysisResult = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!analysis.title || !analysis.description || !analysis.priority) {
      throw new Error('AI analysis missing required fields');
    }

    return analysis;

  } catch (error) {
    logger.error('AI analysis failed, falling back to basic extraction', error instanceof Error ? error : new Error(String(error)));

    // Fallback to basic extraction
    const cleanContent = currentMessage.content
      .replace(/<@!?\d+>/g, '')
      .replace(/<@&\d+>/g, '')
      .replace(/<#\d+>/g, '')
      .trim();

    return {
      title: cleanContent.substring(0, 100) || 'Untitled Discord Task',
      description: cleanContent,
      priority: 'MEDIUM',
      reasoning: 'Fallback: AI analysis failed, used basic extraction',
      relatedContext: [],
    };
  }
}

/**
 * Create ClickUp task from Discord message with AI reasoning
 */
export async function createTaskFromDiscordMessage(
  analyzedMessage: AnalyzedMessage,
  discordClient?: DiscordClient
): Promise<DiscordTaskCreationResult> {
  try {
    // Validate configuration
    if (!config.clickup.listId) {
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

    let title: string;
    let description: string;
    let priority: number;
    let aiReasoning = '';

    // Use AI analysis if Discord client is available (for fetching history)
    if (discordClient && config.discord.enabled) {
      logger.info('Fetching conversation context for AI analysis...');

      // Fetch conversation history
      const conversationHistory = await fetchConversationHistory(
        discordClient,
        analyzedMessage.message.channelId,
        analyzedMessage.message.id,
        20 // Last 20 messages
      );

      logger.info(`Fetched ${conversationHistory.length} messages for context`);

      // Get AI analysis
      const aiAnalysis = await analyzeIssueWithAI(
        analyzedMessage.message,
        conversationHistory
      );

      // Use AI-generated content
      title = aiAnalysis.title;
      priority = getPriorityValue(aiAnalysis.priority);
      aiReasoning = aiAnalysis.reasoning;

      // Build enhanced description with AI analysis
      const { message: msg } = analyzedMessage;
      const messageLink = `https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id}`;

      description = `**Reported via Discord**
**Message Link:** ${messageLink}

---

## AI Analysis

${aiAnalysis.description}

${aiAnalysis.relatedContext.length > 0 ? `
### Related Context from Conversation:
${aiAnalysis.relatedContext.map(ctx => `- "${ctx}"`).join('\n')}
` : ''}

### AI Reasoning:
${aiReasoning}

---

## Original Message

**Author:** ${msg.author.username}
**Content:**
${msg.content}

${msg.attachments.length > 0 ? `
**Attachments:**
${msg.attachments.map(a => `- [${a.filename}](${a.url})`).join('\n')}
` : ''}`;

      logger.info('AI analysis complete', {
        title,
        priority: aiAnalysis.priority,
        contextMessages: conversationHistory.length,
      });

    } else {
      // Fallback to basic extraction if Discord client not available
      logger.info('Using basic extraction (no Discord client for AI analysis)');
      title = extractTitle(analyzedMessage);
      description = extractDescription(analyzedMessage);
      priority = getPriorityValue(analyzedMessage.priority);
    }

    const tags = ['discord', 'ai-analyzed'];

    // Determine status based on message content
    const status = determineTaskStatus(analyzedMessage.message.content);

    // Create ClickUp client
    const clickupClient = new ClickUpClient({
      apiKey: config.clickup.apiKey,
    });

    // Prepare task payload
    const taskPayload = {
      name: title,
      description,
      assignees: [config.clickup.botUserId],
      status,
      priority,
      tags,
    };

    // Create task
    const task = await clickupClient.createTask(config.clickup.listId, taskPayload);

    logger.info('ClickUp task created successfully', {
      taskId: task.id,
      title: task.name,
      withAI: !!discordClient,
    });

    return { success: true, task };

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to create ClickUp task from Discord', err);

    return {
      success: false,
      error: err.message,
    };
  }
}
