import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { mediaAPI } from '@/src/shared/api/media';
import styles from '@/styles/settings.module.css';

export default function MediaPacksPage() {
  const [emojiPacks, setEmojiPacks] = useState([]);
  const [stickerPacks, setStickerPacks] = useState([]);
  const [gifs, setGifs] = useState([]);
  const [emojiForm, setEmojiForm] = useState({ name: '', title: '' });
  const [stickerForm, setStickerForm] = useState({ name: '', title: '' });
  const [gifForm, setGifForm] = useState({ fileUrl: '', title: '' });
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const [ep, sp, gifList] = await Promise.all([
      mediaAPI.getEmojiPacks(),
      mediaAPI.getStickerPacks(),
      mediaAPI.getGifs(),
    ]);
    setEmojiPacks(ep || []);
    setStickerPacks(sp || []);
    setGifs(gifList || []);
  }, []);

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [reload]);

  const handleCreateEmojiPack = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await mediaAPI.createEmojiPack(emojiForm);
      setEmojiForm({ name: '', title: '' });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateStickerPack = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await mediaAPI.createStickerPack(stickerForm);
      setStickerForm({ name: '', title: '' });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddGif = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await mediaAPI.createGif(gifForm);
      setGifForm({ fileUrl: '', title: '' });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <Head>
        <title>Медиа-паки — Pager</title>
      </Head>
      <div className={styles.page}>
        <Link href="/">← Назад</Link>
        <h1 data-testid="media-packs-title">Управление эмодзи, стикерами и GIF</h1>
        {error && <p className={styles.error}>{error}</p>}

        <section data-testid="emoji-packs-section">
          <h2>Паки кастомных эмодзи</h2>
          <form onSubmit={handleCreateEmojiPack}>
            <input
              placeholder="name (латиница)"
              value={emojiForm.name}
              onChange={(e) => setEmojiForm((f) => ({ ...f, name: e.target.value }))}
              data-testid="emoji-pack-name"
            />
            <input
              placeholder="Название"
              value={emojiForm.title}
              onChange={(e) => setEmojiForm((f) => ({ ...f, title: e.target.value }))}
              data-testid="emoji-pack-title"
            />
            <button type="submit" data-testid="emoji-pack-create">
              Создать пак
            </button>
          </form>
          <ul>
            {emojiPacks.map((p) => (
              <li key={p.id} data-testid={`emoji-pack-${p.id}`}>
                {p.title} ({p.emojis?.length || 0} эмодзи)
                {!p.system && (
                  <button
                    type="button"
                    data-testid={`emoji-pack-delete-${p.id}`}
                    onClick={() => mediaAPI.deleteEmojiPack(p.id).then(reload)}
                  >
                    Удалить
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section data-testid="sticker-packs-section">
          <h2>Стикер-паки</h2>
          <form onSubmit={handleCreateStickerPack}>
            <input
              placeholder="name"
              value={stickerForm.name}
              onChange={(e) => setStickerForm((f) => ({ ...f, name: e.target.value }))}
              data-testid="sticker-pack-name"
            />
            <input
              placeholder="Название"
              value={stickerForm.title}
              onChange={(e) => setStickerForm((f) => ({ ...f, title: e.target.value }))}
              data-testid="sticker-pack-title"
            />
            <button type="submit" data-testid="sticker-pack-create">
              Создать пак
            </button>
          </form>
          <ul>
            {stickerPacks.map((p) => (
              <li key={p.id}>
                {p.title} ({p.stickers?.length || 0})
                {!p.system && (
                  <button
                    type="button"
                    onClick={() => mediaAPI.deleteStickerPack(p.id).then(reload)}
                  >
                    Удалить
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section data-testid="gifs-section">
          <h2>GIF</h2>
          <form onSubmit={handleAddGif}>
            <input
              placeholder="URL файла"
              value={gifForm.fileUrl}
              onChange={(e) => setGifForm((f) => ({ ...f, fileUrl: e.target.value }))}
              data-testid="gif-file-url"
            />
            <input
              placeholder="Название"
              value={gifForm.title}
              onChange={(e) => setGifForm((f) => ({ ...f, title: e.target.value }))}
            />
            <button type="submit" data-testid="gif-create">
              Добавить GIF
            </button>
          </form>
          <ul>
            {gifs.map((g) => (
              <li key={g.id}>
                {g.title || g.fileUrl}
                <button type="button" onClick={() => mediaAPI.deleteGif(g.id).then(reload)}>
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
