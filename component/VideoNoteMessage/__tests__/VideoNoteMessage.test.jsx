import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VideoNoteMessage from '..';
import { fetchChatFileBlob } from '@/shared/lib/chat/fetchChatFileBlob';

jest.mock('@/shared/lib/chat/fetchChatFileBlob', () => ({
  fetchChatFileBlob: jest.fn(),
}));

describe('VideoNoteMessage', () => {
  beforeEach(() => {
    fetchChatFileBlob.mockResolvedValue(new Blob(['video'], { type: 'video/webm' }));
    URL.createObjectURL = jest.fn(() => 'blob:video-note');
    URL.revokeObjectURL = jest.fn();
    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = jest.fn();
  });

  it('загружает защищённый файл и оставляет Play доступным без hover', async () => {
    render(<VideoNoteMessage fileUrl="files/1/2/note.webm" isOwn />);

    const playButton = screen.getByRole('button', { name: 'Воспроизвести видеокружок' });
    expect(playButton).toBeInTheDocument();
    await waitFor(() => expect(fetchChatFileBlob).toHaveBeenCalledWith('files/1/2/note.webm'));
    await waitFor(() =>
      expect(playButton.querySelector('video')).toHaveAttribute('src', 'blob:video-note')
    );

    fireEvent.click(playButton);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it('освобождает blob URL при закрытии сообщения', async () => {
    const { unmount } = render(<VideoNoteMessage fileUrl="files/1/2/note.webm" />);
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:video-note');
  });
});
