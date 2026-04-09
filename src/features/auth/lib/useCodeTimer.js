/**
 * Хук таймеров для кода подтверждения и повторной отправки. FSD: features/auth
 */
import { useState, useEffect } from 'react';

/**
 * @param {number} codeInitial — начальное время жизни кода в секундах (по умолчанию 600)
 * @param {number} resendInitial — задержка перед повторной отправкой в секундах (по умолчанию 60)
 */
export function useCodeTimer(codeInitial = 600, resendInitial = 60) {
  const [codeTimer, setCodeTimer] = useState(0);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (codeTimer <= 0) return;
    const t = setTimeout(() => setCodeTimer((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [codeTimer]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const startTimers = () => {
    setCodeTimer(codeInitial);
    setResendTimer(resendInitial);
  };

  return { codeTimer, resendTimer, setCodeTimer, setResendTimer, startTimers };
}
