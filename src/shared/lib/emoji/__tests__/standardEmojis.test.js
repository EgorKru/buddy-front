import { QUICK_REACTIONS, formatCustomEmojiKey, isCustomEmojiKey } from '../standardEmojis';

describe('standardEmojis', () => {
  it('exports quick reactions', () => {
    expect(QUICK_REACTIONS).toContain('👍');
    expect(QUICK_REACTIONS.length).toBeGreaterThan(3);
  });

  it('formats custom emoji keys', () => {
    expect(formatCustomEmojiKey(42)).toBe('custom:42');
    expect(isCustomEmojiKey('custom:42')).toBe(true);
    expect(isCustomEmojiKey('👍')).toBe(false);
  });
});
