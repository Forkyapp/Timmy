import { ChannelType, MessagePriority } from '../discord';

describe('Discord Types', () => {
  describe('ChannelType', () => {
    it('should have TEXT channel type', () => {
      expect(ChannelType.TEXT).toBe('TEXT');
    });

    it('should have VOICE channel type', () => {
      expect(ChannelType.VOICE).toBe('VOICE');
    });

    it('should have CATEGORY channel type', () => {
      expect(ChannelType.CATEGORY).toBe('CATEGORY');
    });

    it('should have ANNOUNCEMENT channel type', () => {
      expect(ChannelType.ANNOUNCEMENT).toBe('ANNOUNCEMENT');
    });

    it('should have THREAD channel type', () => {
      expect(ChannelType.THREAD).toBe('THREAD');
    });
  });

  describe('MessagePriority', () => {
    it('should have HIGH priority', () => {
      expect(MessagePriority.HIGH).toBe('HIGH');
    });

    it('should have MEDIUM priority', () => {
      expect(MessagePriority.MEDIUM).toBe('MEDIUM');
    });

    it('should have LOW priority', () => {
      expect(MessagePriority.LOW).toBe('LOW');
    });
  });
});
