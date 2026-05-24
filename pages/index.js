import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { isAuthenticated } from '@/utils/api';
import { LandingPage } from '@/surface/marketing';
import { Loader } from '@/shared/ui/Loader';

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/app');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return <Loader fullPage text="Loading..." />;
  }

  return (
    <>
      <Head>
        <title>Pager — Secure messaging and calls</title>
        <meta
          name="description"
          content="Secure messaging and calls for focused teams. Real-time chat, reliable reconnect, and private direct conversations."
        />
      </Head>
      <LandingPage />
    </>
  );
}
