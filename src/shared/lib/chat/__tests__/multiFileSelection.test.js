import {
  appendFilesFromInputEvent,
  fileSelectionKey,
  mergeSelectedFiles,
  MAX_CHAT_ATTACHMENTS,
  filesFromInputEvent,
} from '../multiFileSelection';

function makeFile(name, size = 100, lastModified = 1) {
  return new File([new Uint8Array(size)], name, { type: 'text/plain', lastModified });
}

describe('multiFileSelection', () => {
  it('fileSelectionKey is stable per file identity', () => {
    const a = makeFile('a.txt', 10, 42);
    const b = makeFile('a.txt', 10, 42);
    expect(fileSelectionKey(a)).toBe(fileSelectionKey(b));
  });

  it('mergeSelectedFiles deduplicates and respects max', () => {
    const a = makeFile('a.txt');
    const b = makeFile('b.txt');
    const merged = mergeSelectedFiles([a], [a, b], 10);
    expect(merged).toHaveLength(2);
    expect(merged.map((f) => f.name)).toEqual(['a.txt', 'b.txt']);
  });

  it('mergeSelectedFiles caps at MAX_CHAT_ATTACHMENTS', () => {
    const incoming = Array.from({ length: MAX_CHAT_ATTACHMENTS + 3 }, (_, i) =>
      makeFile(`f${i}.txt`, i + 1, i)
    );
    const merged = mergeSelectedFiles([], incoming);
    expect(merged).toHaveLength(MAX_CHAT_ATTACHMENTS);
  });

  it('filesFromInputEvent returns all selected files', () => {
    const f1 = makeFile('one.png');
    const f2 = makeFile('two.pdf');
    const event = {
      target: {
        files: [f1, f2],
      },
    };
    expect(filesFromInputEvent(event)).toEqual([f1, f2]);
  });

  it('appendFilesFromInputEvent merges with existing', () => {
    const existing = [makeFile('keep.txt')];
    const added = makeFile('new.txt');
    const event = { target: { files: [added] } };
    const result = appendFilesFromInputEvent(event, existing);
    expect(result.map((f) => f.name)).toEqual(['keep.txt', 'new.txt']);
  });
});
