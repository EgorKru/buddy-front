import Head from 'next/head';
import { useRegistration } from '@/features/auth/lib/useRegistration';
import { RegistrationForm } from '@/features/auth/ui/RegistrationForm';
import { AuthLayout } from '@/surface/auth';

export default function Register() {
  const registration = useRegistration();

  return (
    <>
      <Head>
        <title>Get started — Pager</title>
      </Head>
      <AuthLayout
        title="Create your account"
        subtitle="Start with a secure workspace for messaging and calls."
      >
        <RegistrationForm {...registration} />
      </AuthLayout>
    </>
  );
}
