import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { EmojiPicker, insertEmojiAtSelection } from '../EmojiPicker';

describe('EmojiPicker', () => {
  beforeEach(() => window.localStorage.clear());

  it('вставляет эмодзи в позицию курсора и сохраняет недавний выбор', async () => {
    const inputRef = createRef();
    const onChange = jest.fn();
    render(
      <div>
        <textarea ref={inputRef} defaultValue="Привет мир" />
        <EmojiPicker value="Привет мир" inputRef={inputRef} onChange={onChange} />
      </div>
    );
    inputRef.current.setSelectionRange(6, 6);

    fireEvent.click(screen.getByRole('button', { name: 'Открыть эмодзи' }));
    const heartButton = screen.getAllByRole('button', { name: 'Добавить ❤️' })[0];
    expect(heartButton.querySelector('img')).toHaveAttribute(
      'src',
      '/emoji/twemoji/2764.svg'
    );
    fireEvent.click(heartButton);

    expect(onChange).toHaveBeenCalledWith('Привет❤️ мир');
    expect(JSON.parse(window.localStorage.getItem('pager.recent-emojis.v1'))).toEqual(['❤️']);
    await waitFor(() => expect(inputRef.current.selectionStart).toBe(8));
  });

  it('находит эмодзи по русскому слову и закрывается по Escape', () => {
    const inputRef = createRef();
    render(
      <div>
        <textarea ref={inputRef} />
        <EmojiPicker value="" inputRef={inputRef} onChange={jest.fn()} />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Открыть эмодзи' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск эмодзи' }), {
      target: { value: 'огонь' },
    });
    expect(screen.getByRole('button', { name: 'Добавить 🔥' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument();
    expect(inputRef.current).toHaveFocus();
  });

  it('заменяет выделенный текст выбранным эмодзи', () => {
    expect(
      insertEmojiAtSelection('один два', '✨', { selectionStart: 5, selectionEnd: 8 })
    ).toEqual({
      value: 'один ✨',
      caret: 6,
    });
  });
});
