import {
  createVideoNoteFile,
  getSupportedVideoNoteMimeType,
  isVideoNoteMessage,
} from '../videoNote';

describe('video note helpers', () => {
  it('распознаёт только файл видеокружка с безопасным маркером', () => {
    expect(
      isVideoNoteMessage({
        type: 'FILE',
        fileName: 'pager-video-note-42.webm',
        mimeType: 'video/webm',
      })
    ).toBe(true);
    expect(
      isVideoNoteMessage({ type: 'FILE', fileName: 'movie.webm', mimeType: 'video/webm' })
    ).toBe(false);
    expect(
      isVideoNoteMessage({
        type: 'FILE',
        fileName: 'pager-video-note-42.webm',
        mimeType: 'text/plain',
      })
    ).toBe(false);
  });

  it('создаёт файл с ожидаемым именем и MIME', () => {
    const file = createVideoNoteFile(new Blob(['video'], { type: 'video/webm' }), 123);
    expect(file.name).toBe('pager-video-note-123.webm');
    expect(file.type).toBe('video/webm');
  });

  it('выбирает первый поддерживаемый современный кодек', () => {
    const FakeMediaRecorder = {
      isTypeSupported: jest.fn((type) => type === 'video/webm;codecs=vp8,opus'),
    };
    expect(getSupportedVideoNoteMimeType(FakeMediaRecorder)).toBe('video/webm;codecs=vp8,opus');
  });
});
