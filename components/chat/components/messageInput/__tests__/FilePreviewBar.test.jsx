import { render, screen } from '@testing-library/react';
import { FilePreviewBar } from '../FilePreviewBar';

jest.mock('@/styles/chat.module.css', () => ({
  filePreviewList: 'filePreviewList',
  filePreview: 'filePreview',
  imagePreview: 'imagePreview',
  previewImage: 'previewImage',
  removeFileButton: 'removeFileButton',
  filePreviewInfo: 'filePreviewInfo',
  filePreviewDetails: 'filePreviewDetails',
  filePreviewName: 'filePreviewName',
  filePreviewSize: 'filePreviewSize',
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => <img alt={props.alt} />,
}));

function makeFile(name, type = 'text/plain') {
  return new File(['x'], name, { type });
}

describe('FilePreviewBar', () => {
  it('renders one preview item per selected file', () => {
    const files = [makeFile('a.txt'), makeFile('b.png', 'image/png')];
    render(<FilePreviewBar selectedFiles={files} previewUrlsRef={{ current: new Map() }} />);

    expect(screen.getByTestId('chat-file-preview-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('chat-file-preview-item')).toHaveLength(2);
    expect(screen.getByText('a.txt')).toBeInTheDocument();
    expect(screen.getByAltText('b.png')).toBeInTheDocument();
  });
});
