import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Link from 'next/link';
import { User, Mail, Save, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile';
import styles from '@/styles/settings.module.css';

export default function Settings() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { formData, loading, saving, error, success, handleChange, handleSubmit } =
    useProfile(user);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.backButton}>
            <ArrowLeft size={20} />
            Назад
          </Link>
          <h1>Настройки профиля</h1>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.avatarSection}>
            <div className={styles.avatar}>
              {formData.avatarUrl ? (
                <Image src={formData.avatarUrl} alt="Аватар" width={96} height={96} />
              ) : (
                <User size={48} />
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="username">
              <User size={16} />
              Имя пользователя
            </label>
            <input
              type="text"
              id="username"
              value={user?.username || ''}
              disabled
              className={styles.disabledInput}
            />
            <span className={styles.hint}>Имя пользователя нельзя изменить</span>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">
              <Mail size={16} />
              Email
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              disabled
              className={styles.disabledInput}
            />
            <span className={styles.hint}>Email нельзя изменить</span>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="displayName">
              <User size={16} />
              Отображаемое имя
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              placeholder="Как вас называть?"
              maxLength={50}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="avatarUrl">URL аватара</label>
            <input
              type="url"
              id="avatarUrl"
              name="avatarUrl"
              value={formData.avatarUrl}
              onChange={handleChange}
              placeholder="https://example.com/avatar.jpg"
            />
            <span className={styles.hint}>Введите URL изображения для аватара</span>
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <button type="submit" disabled={saving} className={styles.saveButton}>
            <Save size={18} />
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </form>
      </div>
    </div>
  );
}
