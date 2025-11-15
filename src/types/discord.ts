/**
 * Discord Types
 * Types for Discord bot integration, message polling, and keyword detection
 */

/**
 * Discord message structure
 */
export interface DiscordMessage {
  readonly id: string;
  readonly channelId: string;
  readonly guildId: string;
  readonly content: string;
  readonly author: {
    readonly id: string;
    readonly username: string;
    readonly bot: boolean;
  };
  readonly timestamp: Date;
  readonly mentions: string[];
  readonly attachments: DiscordAttachment[];
}

/**
 * Discord attachment (images, files, etc.)
 */
export interface DiscordAttachment {
  readonly id: string;
  readonly filename: string;
  readonly url: string;
  readonly size: number;
  readonly contentType?: string;
}

/**
 * Discord channel information
 */
export interface DiscordChannel {
  readonly id: string;
  readonly name: string;
  readonly guildId: string;
  readonly type: ChannelType;
}

/**
 * Discord channel types
 */
export enum ChannelType {
  TEXT = 'TEXT',
  VOICE = 'VOICE',
  CATEGORY = 'CATEGORY',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  THREAD = 'THREAD',
}

/**
 * Discord guild (server) information
 */
export interface DiscordGuild {
  readonly id: string;
  readonly name: string;
  readonly channels: DiscordChannel[];
}

/**
 * Keyword match result
 */
export interface KeywordMatch {
  readonly keyword: string;
  readonly context: string;
  readonly position: number;
}

/**
 * Analyzed message with keyword matches
 */
export interface AnalyzedMessage {
  readonly message: DiscordMessage;
  readonly matches: KeywordMatch[];
  readonly priority: MessagePriority;
  readonly extractedContext: string;
}

/**
 * Message priority based on keyword matches
 */
export enum MessagePriority {
  HIGH = 'HIGH',     // Critical issues (bug, crash, error)
  MEDIUM = 'MEDIUM', // Issues (issue, problem, fix)
  LOW = 'LOW',       // General feedback (feature, suggestion)
}

/**
 * Discord bot configuration
 */
export interface DiscordBotConfig {
  readonly token: string;
  readonly guildId: string;
  readonly channelIds: string[];
  readonly keywords: string[];
  readonly pollIntervalMs: number;
  readonly enabled: boolean;
}

/**
 * Message polling options
 */
export interface MessagePollOptions {
  readonly channelIds: string[];
  readonly limit?: number;
  readonly after?: string;
  readonly before?: string;
}

/**
 * Processed message tracking
 */
export interface ProcessedMessage {
  readonly messageId: string;
  readonly channelId: string;
  readonly processedAt: Date;
  readonly keywords: string[];
}

/**
 * Discord service events
 */
export interface DiscordServiceEvents {
  onMessageDetected?: (message: AnalyzedMessage) => void | Promise<void>;
  onError?: (error: Error) => void;
  onReady?: () => void;
}
