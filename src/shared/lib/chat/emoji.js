const EMOJI_CLUSTER =
  /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\p{Emoji_Modifier}|\u200D(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\p{Emoji_Modifier})?)*$/u;

export function getEmojiOnlyCount(content) {
  const value = typeof content === 'string' ? content.trim() : '';
  if (!value || typeof Intl === 'undefined' || !Intl.Segmenter) return 0;
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)]
    .map((part) => part.segment)
    .filter((part) => !/^\s+$/u.test(part));
  if (segments.length === 0 || segments.length > 3) return 0;
  return segments.every((part) => EMOJI_CLUSTER.test(part)) ? segments.length : 0;
}

export function splitEmojiGraphemes(content) {
  if (typeof content !== 'string' || typeof Intl === 'undefined' || !Intl.Segmenter) return [];
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(content.trim())]
    .map((part) => part.segment)
    .filter((part) => !/^\s+$/u.test(part));
}
