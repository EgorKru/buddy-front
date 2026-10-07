import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Search, Smile, Sparkles, X } from 'lucide-react';
import styles from '@/styles/chat.module.css';
import { EmojiGlyph } from '@/shared/ui/EmojiGlyph';

const RECENT_EMOJI_KEY = 'pager.recent-emojis.v1';
const MAX_RECENT_EMOJI = 18;

export const EMOJI_GROUPS = [
  {
    id: 'popular',
    label: 'Популярные',
    icon: '✨',
    items: ['😂', '❤️', '🥹', '😍', '🔥', '👏', '😁', '🎉', '🤩', '😭', '🙏', '👍'],
  },
  {
    id: 'faces',
    label: 'Эмоции',
    icon: '😊',
    items: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😆',
      '😅',
      '😂',
      '🤣',
      '😊',
      '🙂',
      '🙃',
      '😉',
      '😍',
      '🥰',
      '😘',
      '😎',
      '🤓',
      '🫠',
      '🥹',
      '😮',
      '🤯',
      '😴',
      '😭',
      '😤',
    ],
  },
  {
    id: 'gestures',
    label: 'Жесты',
    icon: '👋',
    items: [
      '👋',
      '🤚',
      '🖐️',
      '✋',
      '👌',
      '🤌',
      '🤞',
      '🫶',
      '🤝',
      '👏',
      '🙌',
      '👍',
      '👎',
      '👊',
      '✌️',
      '💪',
      '🙏',
      '💅',
    ],
  },
  {
    id: 'nature',
    label: 'Животные и природа',
    icon: '🌿',
    items: [
      '🐶',
      '🐱',
      '🐭',
      '🐹',
      '🐰',
      '🦊',
      '🐻',
      '🐼',
      '🐨',
      '🐯',
      '🦁',
      '🐸',
      '🐵',
      '🦄',
      '🦋',
      '🌸',
      '🌈',
      '⭐',
    ],
  },
  {
    id: 'food',
    label: 'Еда',
    icon: '🍓',
    items: [
      '🍏',
      '🍓',
      '🍒',
      '🍉',
      '🍋',
      '🥑',
      '🍕',
      '🍔',
      '🍟',
      '🍣',
      '🍜',
      '🍪',
      '🍩',
      '🍫',
      '☕',
      '🍾',
      '🥂',
      '🧊',
    ],
  },
  {
    id: 'activity',
    label: 'Активности',
    icon: '🚀',
    items: [
      '⚽',
      '🏀',
      '🎾',
      '🎮',
      '🎧',
      '🎸',
      '🎨',
      '🎬',
      '🚀',
      '✈️',
      '🏆',
      '🥇',
      '🎯',
      '🎁',
      '🎉',
      '🎊',
      '💡',
      '💻',
    ],
  },
  {
    id: 'symbols',
    label: 'Символы',
    icon: '💜',
    items: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '💔',
      '💕',
      '💯',
      '🔥',
      '✨',
      '⚡',
      '✅',
      '❌',
      '❗',
      '❓',
    ],
  },
];

const EMOJI_SEARCH = new Map([
  ['любовь сердце love heart', ['❤️', '🥰', '😍', '😘', '💕', '💜', '🫶']],
  ['смех смешно laugh lol', ['😂', '🤣', '😆']],
  ['грусть плач cry sad', ['😭', '🥹', '💔']],
  ['огонь fire hot', ['🔥']],
  ['ок хорошо yes good', ['👌', '👍', '✅']],
  ['праздник party celebration', ['🎉', '🎊', '🥂']],
  ['работа компьютер work computer', ['💻', '💡', '🎯']],
  ['спасибо thanks', ['🙏', '🫶']],
]);

const readRecent = () => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_EMOJI_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const saveRecent = (items) => {
  try {
    window.localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(items));
  } catch {
    // Приватный режим может запрещать localStorage — сам пикер продолжит работать.
  }
};

export function insertEmojiAtSelection(value, emoji, input) {
  const fallbackPosition = value.length;
  const start = Number.isInteger(input?.selectionStart) ? input.selectionStart : fallbackPosition;
  const end = Number.isInteger(input?.selectionEnd) ? input.selectionEnd : start;
  return {
    value: `${value.slice(0, start)}${emoji}${value.slice(end)}`,
    caret: start + emoji.length,
  };
}

export function EmojiPicker({ value, inputRef, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState('popular');
  const [recent, setRecent] = useState([]);
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => setRecent(readRecent()), []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        inputRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [inputRef, open]);

  useEffect(() => {
    if (open) window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  const visibleGroups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru');
    if (!normalized) {
      const groups = [...EMOJI_GROUPS];
      if (recent.length) {
        groups.unshift({ id: 'recent', label: 'Недавние', icon: '🕘', items: recent });
      }
      return groups;
    }

    const directMatches = [];
    for (const [terms, items] of EMOJI_SEARCH.entries()) {
      if (terms.includes(normalized)) directMatches.push(...items);
    }
    const glyphMatches = EMOJI_GROUPS.flatMap((group) => group.items).filter((emoji) =>
      emoji.includes(query.trim())
    );
    const matches = [...new Set([...glyphMatches, ...directMatches])];
    return [{ id: 'search', label: 'Результаты', icon: '🔎', items: matches }];
  }, [query, recent]);

  const selectEmoji = (emoji) => {
    const input = inputRef.current;
    const next = insertEmojiAtSelection(value, emoji, input);
    onChange(next.value);
    const nextRecent = [emoji, ...recent.filter((item) => item !== emoji)].slice(
      0,
      MAX_RECENT_EMOJI
    );
    setRecent(nextRecent);
    saveRecent(nextRecent);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  const scrollToGroup = (id) => {
    setActiveGroup(id);
    rootRef.current?.querySelector(`[data-emoji-group="${id}"]`)?.scrollIntoView({
      block: 'start',
      behavior: 'smooth',
    });
  };

  return (
    <div ref={rootRef} className={styles.emojiPickerRoot}>
      <button
        type="button"
        className={`${styles.composerUtilityButton} ${open ? styles.composerUtilityButtonActive : ''}`}
        aria-label="Открыть эмодзи"
        aria-expanded={open}
        aria-controls="chat-emoji-picker"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <Smile size={21} />
      </button>

      {open && (
        <div
          id="chat-emoji-picker"
          className={styles.emojiPicker}
          role="dialog"
          aria-label="Выбор эмодзи"
          data-testid="emoji-picker"
        >
          <div className={styles.emojiPickerHeader}>
            <div>
              <span className={styles.emojiPickerEyebrow}>
                <Sparkles size={13} /> Живые эмоции
              </span>
              <strong>Эмодзи</strong>
            </div>
            <button
              type="button"
              className={styles.emojiPickerClose}
              aria-label="Закрыть эмодзи"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <label className={styles.emojiSearch}>
            <Search size={16} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Найти эмоцию"
              aria-label="Поиск эмодзи"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          {!query && (
            <div className={styles.emojiCategoryTabs} aria-label="Категории эмодзи">
              {recent.length > 0 && (
                <button
                  type="button"
                  aria-label="Недавние"
                  className={activeGroup === 'recent' ? styles.emojiCategoryActive : ''}
                  onClick={() => scrollToGroup('recent')}
                >
                  <Clock3 size={17} />
                </button>
              )}
              {EMOJI_GROUPS.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  aria-label={group.label}
                  className={activeGroup === group.id ? styles.emojiCategoryActive : ''}
                  onClick={() => scrollToGroup(group.id)}
                >
                  <EmojiGlyph emoji={group.icon} />
                </button>
              ))}
            </div>
          )}

          <div className={styles.emojiGridScroller}>
            {visibleGroups.map((group) => (
              <section key={group.id} data-emoji-group={group.id} className={styles.emojiGroup}>
                <h3>{group.label}</h3>
                {group.items.length ? (
                  <div className={styles.emojiGrid}>
                    {group.items.map((emoji, index) => (
                      <button
                        key={`${group.id}-${emoji}`}
                        type="button"
                        className={styles.emojiChoice}
                        aria-label={`Добавить ${emoji}`}
                        onClick={() => selectEmoji(emoji)}
                        style={{ '--emoji-delay': `${(index % 8) * 18}ms` }}
                      >
                        <EmojiGlyph emoji={emoji} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emojiEmpty}>Ничего не найдено</div>
                )}
              </section>
            ))}
          </div>
          <div className={styles.emojiPickerFooter}>Нажмите на эмодзи — он появится у курсора</div>
        </div>
      )}
    </div>
  );
}
