import { useState, useRef } from 'react';
import Link from 'next/link';
import InteractiveBackground from '@/component/InteractiveBackground';
import { usePagerEyes } from '@/shared/lib/hooks/usePagerEyes';
import { PagerEyes } from '@/shared/ui/PagerEyes';
import { useRegistration } from '@/features/auth/lib/useRegistration';
import { useAuthTheme } from '@/features/auth/lib/useAuthTheme';
import { RegistrationForm } from '@/features/auth/ui/RegistrationForm';
import { AuthThemeToggle } from '@/features/auth/ui/AuthThemeToggle';
import styles from '@/styles/login.module.css';

export default function Register() {
  const logoRef = useRef(null);
  const [isPagerEyesClosed, setIsPagerEyesClosed] = useState(false);
  const { theme, toggleTheme } = useAuthTheme();

  const pupilOffset = usePagerEyes(logoRef, isPagerEyesClosed);
  const registration = useRegistration();

  return (
    <div className={styles.container} data-theme={theme}>
      <AuthThemeToggle theme={theme} onToggle={toggleTheme} />
      <InteractiveBackground />
      <div className={styles.decorativeElements}>
        <div className={styles.floatingCircle} style={{ '--delay': '0s', '--duration': '20s' }} />
        <div className={styles.floatingCircle} style={{ '--delay': '5s', '--duration': '25s' }} />
        <div className={styles.floatingCircle} style={{ '--delay': '10s', '--duration': '30s' }} />
      </div>
      <div className={styles.formContainer}>
        <div className={styles.logoContainer}>
          <div className={styles.logoIcon} ref={logoRef}>
            <PagerEyes styles={styles} isClosed={isPagerEyesClosed} pupilOffset={pupilOffset} />
          </div>
        </div>
        <div className={styles.authHeader}>
          <h1>Регистрация</h1>
          <p className={styles.authSubtitle}>Создайте аккаунт — это займёт пару минут</p>
        </div>
        <RegistrationForm
          {...registration}
          onPasswordFocus={() => setIsPagerEyesClosed(true)}
          onPasswordBlur={() => setIsPagerEyesClosed(false)}
        />
        <p className={styles.link}>
          Уже есть аккаунт? <Link href="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}
