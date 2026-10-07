import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { TextInputRow } from '../TextInputRow';

const renderRow = (newMessage) =>
  render(
    <TextInputRow
      newMessage={newMessage}
      editingMessageId={null}
      editingContent=""
      messageInputRef={createRef()}
      fileInputRef={createRef()}
      buttonRef={createRef()}
      sending={false}
      uploadingFile={false}
      isRecording={false}
      isLocked={false}
      isHolding={false}
      dragDistance={0}
      reachedLockThreshold={false}
      lockThreshold={80}
      onMessageChange={jest.fn()}
      onEditingContentChange={jest.fn()}
      onKeyDown={jest.fn()}
      onFileSelect={jest.fn()}
      onMouseDown={jest.fn()}
      onTouchStart={jest.fn()}
    />
  );

describe('TextInputRow', () => {
  it('не прячет эмодзи и вложения, когда пользователь уже печатает', () => {
    renderRow('готовый текст');

    expect(screen.getByRole('button', { name: 'Открыть эмодзи' })).toBeInTheDocument();
    expect(screen.getByTitle('Прикрепить файл или изображение')).toBeInTheDocument();
    expect(
      screen.queryByTitle('Удерживайте для записи голосового сообщения')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Записать видеокружок' })).not.toBeInTheDocument();
  });

  it('показывает микрофон для пустого сообщения', () => {
    renderRow('');
    expect(screen.getByTitle('Удерживайте для записи голосового сообщения')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Записать видеокружок' })).toBeInTheDocument();
  });
});
