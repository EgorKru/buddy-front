import {
  FILE_PREVIEW_KIND,
  getFilePreviewKind,
  canOpenInViewer,
  isInlineVideoPreview,
} from '../utils';

describe('FileMessage utils', () => {
  it('classifies common chat attachment types', () => {
    expect(getFilePreviewKind('text/plain', 'txt')).toBe(FILE_PREVIEW_KIND.TEXT);
    expect(getFilePreviewKind('application/pdf', 'pdf')).toBe(FILE_PREVIEW_KIND.PDF);
    expect(getFilePreviewKind('video/mp4', 'mp4')).toBe(FILE_PREVIEW_KIND.VIDEO);
    expect(getFilePreviewKind('image/jpeg', 'jpg')).toBe(FILE_PREVIEW_KIND.NONE);
    expect(
      getFilePreviewKind(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'docx'
      )
    ).toBe(FILE_PREVIEW_KIND.OFFICE);
    expect(getFilePreviewKind('application/zip', 'zip')).toBe(FILE_PREVIEW_KIND.NONE);
  });

  it('detects preview by extension when mime is missing', () => {
    expect(getFilePreviewKind(null, 'pdf')).toBe(FILE_PREVIEW_KIND.PDF);
    expect(getFilePreviewKind(null, 'mp4')).toBe(FILE_PREVIEW_KIND.VIDEO);
    expect(getFilePreviewKind(null, 'txt')).toBe(FILE_PREVIEW_KIND.TEXT);
    expect(getFilePreviewKind(null, 'docx')).toBe(FILE_PREVIEW_KIND.OFFICE);
  });

  it('maps preview kinds to UI capabilities', () => {
    expect(canOpenInViewer(FILE_PREVIEW_KIND.PDF)).toBe(true);
    expect(canOpenInViewer(FILE_PREVIEW_KIND.OFFICE)).toBe(true);
    expect(canOpenInViewer(FILE_PREVIEW_KIND.VIDEO)).toBe(false);
    expect(isInlineVideoPreview(FILE_PREVIEW_KIND.VIDEO)).toBe(true);
  });
});
