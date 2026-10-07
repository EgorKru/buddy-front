import { useState } from 'react';

export function emojiToAssetName(emoji) {
  return [...emoji]
    .map((character) => character.codePointAt(0))
    .filter((codePoint) => codePoint !== 0xfe0f)
    .map((codePoint) => codePoint.toString(16))
    .join('-');
}

export function EmojiGlyph({ emoji, className, decorative = true }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={className} aria-hidden={decorative || undefined}>
        {emoji}
      </span>
    );
  }
  return (
    // Локальный SVG-ассет должен оставаться обычным img: next/image здесь добавляет лишний wrapper.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/emoji/twemoji/${emojiToAssetName(emoji)}.svg`}
      alt={decorative ? '' : emoji}
      aria-hidden={decorative || undefined}
      draggable="false"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
