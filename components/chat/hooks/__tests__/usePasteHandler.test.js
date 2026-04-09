import { renderHook, act } from '@testing-library/react';
import { usePasteHandler } from '../usePasteHandler';

describe('usePasteHandler', () => {
  it('should not call onFileSelect when editingMessageId is true', () => {
    const onFileSelect = jest.fn();
    const { result } = renderHook(() => usePasteHandler(true, false, false, onFileSelect));

    const pasteEvent = {
      clipboardData: { items: [] },
      preventDefault: jest.fn(),
    };

    act(() => {
      result.current(pasteEvent);
    });

    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('should not call onFileSelect when isRecording is true', () => {
    const onFileSelect = jest.fn();
    const { result } = renderHook(() => usePasteHandler(false, true, false, onFileSelect));

    const pasteEvent = {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            kind: 'file',
            getAsFile: () => new File(['x'], 'p.png', { type: 'image/png' }),
          },
        ],
      },
      preventDefault: jest.fn(),
    };

    act(() => {
      result.current(pasteEvent);
    });

    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('should not call onFileSelect when clipboard has no image', () => {
    const onFileSelect = jest.fn();
    const { result } = renderHook(() => usePasteHandler(false, false, false, onFileSelect));

    const pasteEvent = {
      clipboardData: {
        items: [{ type: 'text/plain', kind: 'string', getAsString: () => {} }],
      },
      preventDefault: jest.fn(),
    };

    act(() => {
      result.current(pasteEvent);
    });

    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('should call onFileSelect with synthetic event when image is pasted', () => {
    const onFileSelect = jest.fn();
    const { result } = renderHook(() => usePasteHandler(false, false, false, onFileSelect));

    const file = new File(['content'], 'pasted.png', { type: 'image/png' });
    const pasteEvent = {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            kind: 'file',
            getAsFile: () => file,
          },
        ],
      },
      preventDefault: jest.fn(),
    };

    act(() => {
      result.current(pasteEvent);
    });

    expect(pasteEvent.preventDefault).toHaveBeenCalled();
    expect(onFileSelect).toHaveBeenCalledTimes(1);
    const arg = onFileSelect.mock.calls[0][0];
    expect(arg).toHaveProperty('target');
    expect(arg.target).toHaveProperty('files');
    expect(Array.isArray(arg.target.files)).toBe(true);
    expect(arg.target.files[0]).toBeInstanceOf(File);
    expect(arg.target.files[0].name).toMatch(/^pasted-image-\d+\.png$/);
  });
});
