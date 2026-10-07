import { getEmojiOnlyCount, splitEmojiGraphemes } from '../emoji';

describe('getEmojiOnlyCount', () => {
  it.each([
    ['🔥', 1],
    ['❤️ ❤️', 2],
    ['👨‍💻✨', 2],
    ['👍🏽', 1],
    ['😀😃😄', 3],
  ])('распознаёт отдельное emoji-сообщение %s', (value, expected) => {
    expect(getEmojiOnlyCount(value)).toBe(expected);
  });

  it.each(['привет 😀', '😀😃😄😁', '', '123'])('не увеличивает обычное сообщение %s', (value) => {
    expect(getEmojiOnlyCount(value)).toBe(0);
  });

  it('делит ZWJ и variation selector как цельные эмодзи', () => {
    expect(splitEmojiGraphemes('👨‍💻 ❤️')).toEqual(['👨‍💻', '❤️']);
  });
});
