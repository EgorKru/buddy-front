import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmojiPicker from '../index';

jest.mock('@/component/EmojiPicker/index.module.css', () => ({
  overlay: 'overlay',
  panel: 'panel',
  tabs: 'tabs',
  tab: 'tab',
  tabActive: 'tabActive',
  body: 'body',
  grid: 'grid',
  emojiBtn: 'emojiBtn',
  customImg: 'customImg',
  packTabs: 'packTabs',
  packTab: 'packTab',
  packTabActive: 'packTabActive',
  stickerGrid: 'stickerGrid',
  gifItem: 'gifItem',
  stickerImg: 'stickerImg',
  gifImg: 'gifImg',
}));

jest.mock('@/src/shared/api/media', () => ({
  mediaAPI: {
    getEmojiPacks: jest.fn(),
    getStickerPacks: jest.fn(),
    getGifs: jest.fn(),
  },
}));

const { mediaAPI } = require('@/src/shared/api/media');

function makeAnchor() {
  const el = document.createElement('button');
  el.getBoundingClientRect = () => ({
    left: 100,
    top: 200,
    width: 40,
    height: 40,
    right: 140,
    bottom: 240,
  });
  document.body.appendChild(el);
  return { current: el };
}

describe('EmojiPicker', () => {
  beforeEach(() => {
    mediaAPI.getEmojiPacks.mockResolvedValue([]);
    mediaAPI.getStickerPacks.mockResolvedValue([]);
    mediaAPI.getGifs.mockResolvedValue([]);
  });

  it('does not close when clicking inside panel', async () => {
    const onClose = jest.fn();
    const anchorRef = makeAnchor();

    render(<EmojiPicker open onClose={onClose} anchorRef={anchorRef} />);

    await waitFor(() => expect(mediaAPI.getEmojiPacks).toHaveBeenCalled());
    fireEvent.mouseDown(screen.getByTestId('emoji-picker-panel'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close after selecting custom animated emoji', async () => {
    const onClose = jest.fn();
    const onSelectCustomEmoji = jest.fn();
    const anchorRef = makeAnchor();

    mediaAPI.getEmojiPacks.mockResolvedValueOnce([
      {
        id: 1,
        title: 'Test pack',
        emojis: [{ id: 10, fileUrl: '/system/telegram-animated/emoji-people/125.gif' }],
      },
    ]);

    render(
      <EmojiPicker
        open
        onClose={onClose}
        onSelectCustomEmoji={onSelectCustomEmoji}
        anchorRef={anchorRef}
      />
    );

    await waitFor(() => expect(mediaAPI.getEmojiPacks).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('emoji-picker-custom'));

    expect(onSelectCustomEmoji).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('emoji-picker-panel')).toBeInTheDocument();
  });

  it('closes when clicking on overlay', async () => {
    const onClose = jest.fn();
    const anchorRef = makeAnchor();

    render(<EmojiPicker open onClose={onClose} anchorRef={anchorRef} />);

    await waitFor(() => expect(mediaAPI.getEmojiPacks).toHaveBeenCalled());
    fireEvent.click(document.querySelector('.overlay'));

    expect(onClose).toHaveBeenCalled();
  });

  it('loads media packs when opened (integration)', async () => {
    const anchorRef = makeAnchor();
    render(<EmojiPicker open onClose={() => {}} anchorRef={anchorRef} />);

    await waitFor(() => {
      expect(mediaAPI.getEmojiPacks).toHaveBeenCalled();
      expect(mediaAPI.getStickerPacks).toHaveBeenCalled();
      expect(mediaAPI.getGifs).toHaveBeenCalled();
    });
  });
});
