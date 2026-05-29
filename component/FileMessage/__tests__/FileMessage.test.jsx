import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FileMessage from '../index';
import { FILE_PREVIEW_KIND } from '../utils';

jest.mock('@/shared/lib/chat/fetchChatFileBlob', () => ({
  fetchChatFileBlob: jest.fn(),
}));

const { fetchChatFileBlob } = require('@/shared/lib/chat/fetchChatFileBlob');

describe('FileMessage', () => {
  beforeEach(() => {
    fetchChatFileBlob.mockReset();
    fetchChatFileBlob.mockResolvedValue(new Blob(['video-bytes'], { type: 'video/mp4' }));
    global.URL.createObjectURL = jest.fn(() => 'blob:video');
    global.URL.revokeObjectURL = jest.fn();
  });

  it('renders inline video for mp4 attachments', async () => {
    render(
      <FileMessage
        fileUrl="files/1/2/clip.mp4"
        mimeType="video/mp4"
        fileName="clip.mp4"
        fileSize={1200}
        setFileViewerModal={jest.fn()}
      />
    );

    expect(screen.getByTestId('chat-message-file')).toHaveAttribute(
      'data-preview-kind',
      FILE_PREVIEW_KIND.VIDEO
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-message-file-video')).toBeInTheDocument();
    });
  });

  it('opens PDF viewer modal on card click', () => {
    const setFileViewerModal = jest.fn();

    render(
      <FileMessage
        fileUrl="files/1/2/doc.pdf"
        mimeType="application/pdf"
        fileName="doc.pdf"
        fileSize={500}
        setFileViewerModal={setFileViewerModal}
      />
    );

    fireEvent.click(screen.getByTestId('chat-message-file-card'));

    expect(setFileViewerModal).toHaveBeenCalledWith(
      expect.objectContaining({
        fileUrl: 'files/1/2/doc.pdf',
        previewKind: FILE_PREVIEW_KIND.PDF,
      })
    );
  });
});
