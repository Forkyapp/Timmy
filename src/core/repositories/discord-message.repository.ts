/**
 * Discord Message Repository
 * Manages processed Discord messages cache to prevent duplicate processing
 */

import fs from 'fs/promises';
import type { ProcessedMessage } from '@/types/discord';
import { FileReadError, FileWriteError } from '@/shared/errors';
import { logger } from '@/shared/utils/logger.util';

export interface IDiscordMessageRepository {
  load(): Promise<ProcessedMessage[]>;
  save(messages: ProcessedMessage[]): Promise<void>;
  has(messageId: string): Promise<boolean>;
  add(message: ProcessedMessage): Promise<void>;
  getAll(): Promise<ProcessedMessage[]>;
  clear(): Promise<void>;
  cleanup(olderThanDays: number): Promise<void>;
}

export class DiscordMessageRepository implements IDiscordMessageRepository {
  private messages: ProcessedMessage[] = [];
  private messageIds: Set<string> = new Set();

  constructor(private readonly filePath: string) {}

  /**
   * Load processed messages from file
   */
  async load(): Promise<ProcessedMessage[]> {
    try {
      // Check if file exists
      try {
        await fs.access(this.filePath);
      } catch {
        // File doesn't exist, return empty array
        return [];
      }

      const data = await fs.readFile(this.filePath, 'utf8');
      this.messages = JSON.parse(data);
      this.messageIds = new Set(this.messages.map((m) => m.messageId));

      return this.messages;
    } catch (error) {
      throw new FileReadError(this.filePath, error as Error);
    }
  }

  /**
   * Save processed messages to file
   */
  async save(messages: ProcessedMessage[]): Promise<void> {
    try {
      this.messages = messages;
      this.messageIds = new Set(messages.map((m) => m.messageId));

      // Ensure directory exists
      const dir = this.filePath.substring(0, this.filePath.lastIndexOf('/'));
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(this.filePath, JSON.stringify(messages, null, 2));
    } catch (error) {
      throw new FileWriteError(this.filePath, error as Error);
    }
  }

  /**
   * Check if message ID exists in cache
   */
  async has(messageId: string): Promise<boolean> {
    return this.messageIds.has(messageId);
  }

  /**
   * Add message to cache
   */
  async add(message: ProcessedMessage): Promise<void> {
    if (this.messageIds.has(message.messageId)) {
      return; // Already cached
    }

    this.messages.push(message);
    this.messageIds.add(message.messageId);

    await this.save(this.messages);
  }

  /**
   * Get all processed messages
   */
  async getAll(): Promise<ProcessedMessage[]> {
    return [...this.messages];
  }

  /**
   * Clear all processed messages
   */
  async clear(): Promise<void> {
    this.messages = [];
    this.messageIds.clear();
    await this.save([]);
  }

  /**
   * Clean up old processed messages
   * @param olderThanDays Remove messages older than this many days
   */
  async cleanup(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const before = this.messages.length;
    this.messages = this.messages.filter((msg) => {
      const processedDate = new Date(msg.processedAt);
      return processedDate >= cutoffDate;
    });

    const removed = before - this.messages.length;
    if (removed > 0) {
      logger.info(`Cleaned up ${removed} old Discord messages`, {
        cutoffDate: cutoffDate.toISOString(),
      });
      await this.save(this.messages);
    }
  }

  /**
   * Initialize repository (load from file)
   */
  async init(): Promise<void> {
    await this.load();
  }
}
