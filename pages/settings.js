import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getCurrentUser, userAPI, isAuthenticated } from '@/utils/api';
import { Eye, EyeOff, User, Mail, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import styles from '@/styles/settings.module.css';

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    avatarUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Проверка аутентификации
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setFormData({
        displayName: currentUser.displayName || '',
        email: currentUser.email || '',
        avatarUrl: currentUser.avatarUrl || '',
      });
      setLoading(false);
    } else {
      router.push('/login');
    }
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Очистить сообщения при изменении
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      // Подготовить данные для обновления
      const updateData = {};
      
      if (formData.displayName !== user.displayName) {
        updateData.displayName = formData.displayName;
      }
      
      if (formData.avatarUrl !== user.avatarUrl) {
        updateData.avatarUrl = formData.avatarUrl;
      }

      // Если нет изменений
      if (Object.keys(updateData).length === 0) {
        setSuccess('Нет изменений для сохранения');
        setSaving(false);
        return;
      }

      // Отправить обновление
      const updatedUser = await userAPI.updateProfile(updateData);
      
      // Обновить localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      
      setUser(updatedUser);
      setSuccess('Профиль успешно обновлен!');
      
      // Перенаправить на главную через 2 секунды
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Ошибка при обновлении профиля');
    } finally {
      setSaving(false);
    }
  };

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
          {/* Аватар */}
          <div className={styles.avatarSection}>
            <div className={styles.avatar}>
              {formData.avatarUrl ? (
                <img src={formData.avatarUrl} alt="Аватар" />
              ) : (
                <User size={48} />
              )}
            </div>
          </div>

          {/* Имя пользователя (только для чтения) */}
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

          {/* Email (только для чтения) */}
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

          {/* Отображаемое имя */}
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

          {/* URL аватара */}
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
            <span className={styles.hint}>
              Введите URL изображения для аватара
            </span>
          </div>

          {/* Сообщения об ошибках/успехе */}
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          {success && (
            <div className={styles.success}>
              {success}
            </div>
          )}

          {/* Кнопка сохранения */}
          <button
            type="submit"
            disabled={saving}
            className={styles.saveButton}
          >
            <Save size={18} />
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </form>
      </div>
    </div>
  );
}
