import { render, screen, waitFor } from '@testing-library/react';
import FileViewerModal from '../index';
import { FILE_PREVIEW_KIND } from '@/component/FileMessage/utils';

jest.mock('@/shared/lib/chat/fetchChatFileBlob', () => ({
  fetchChatFileBlob: jest.fn(),
}));

const { fetchChatFileBlob } = require('@/shared/lib/chat/fetchChatFileBlob');

describe('FileViewerModal', () => {
  beforeEach(() => {
    fetchChatFileBlob.mockReset();
    global.URL.createObjectURL = jest.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = jest.fn();
  });

  it('shows text content for txt files', async () => {
    fetchChatFileBlob.mockResolvedValue({
      text: () => Promise.resolve('hello file'),
    });

    render(
      <FileViewerModal
        fileUrl="files/1/2/note.txt"
        fileName="note.txt"
        mimeType="text/plain"
        previewKind={FILE_PREVIEW_KIND.TEXT}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-file-viewer-text')).toHaveTextContent('hello file');
    });
  });

  it('embeds PDF in iframe', async () => {
    fetchChatFileBlob.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));

    render(
      <FileViewerModal
        fileUrl="files/1/2/doc.pdf"
        fileName="doc.pdf"
        mimeType="application/pdf"
        previewKind={FILE_PREVIEW_KIND.PDF}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-file-viewer-pdf')).toHaveAttribute('src', 'blob:mock');
    });
  });

  it('shows office hint for docx', () => {
    render(
      <FileViewerModal
        fileUrl="files/1/2/report.docx"
        fileName="report.docx"
        mimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        previewKind={FILE_PREVIEW_KIND.OFFICE}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('chat-file-viewer-office')).toBeInTheDocument();
    expect(fetchChatFileBlob).not.toHaveBeenCalled();
  });
});
