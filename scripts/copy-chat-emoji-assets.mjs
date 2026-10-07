import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pickerSource = await readFile(
  path.join(root, 'components/chat/components/messageInput/EmojiPicker.jsx'),
  'utf8'
);
const emojiSegments = [
  ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(pickerSource),
]
  .map(({ segment }) => segment)
  .filter((segment) => /\p{Extended_Pictographic}/u.test(segment));

const toAssetName = (emoji) =>
  [...emoji]
    .map((character) => character.codePointAt(0))
    .filter((codePoint) => codePoint !== 0xfe0f)
    .map((codePoint) => codePoint.toString(16))
    .join('-');

const names = [...new Set(emojiSegments.map(toAssetName))];
const sourceDir = path.join(root, 'node_modules/@twemoji/svg');
const outputDir = path.join(root, 'public/emoji/twemoji');
await mkdir(outputDir, { recursive: true });

const missing = [];
for (const name of names) {
  try {
    await copyFile(path.join(sourceDir, `${name}.svg`), path.join(outputDir, `${name}.svg`));
  } catch {
    missing.push(name);
  }
}
await copyFile(path.join(sourceDir, 'license'), path.join(outputDir, 'LICENSE'));

if (missing.length) {
  throw new Error(`Missing Twemoji assets: ${missing.join(', ')}`);
}
console.log(`Copied ${names.length} local Twemoji SVG assets.`);
