import Head from 'next/head';
import { useRegistration } from '@/features/auth/lib/useRegistration';
import { RegistrationForm } from '@/features/auth/ui/RegistrationForm';
import { AuthLayout } from '@/surface/auth';

export default function Register() {
  const registration = useRegistration();

  return (
    <>
      <Head>
        <title>Регистрация — Pager</title>
      </Head>
      <AuthLayout
        mode="register"
        title="Создайте аккаунт"
        subtitle="Начните с безопасного workspace для сообщений и звонков."
      >
        <RegistrationForm {...registration} />
      </AuthLayout>
    </>
  );
}
