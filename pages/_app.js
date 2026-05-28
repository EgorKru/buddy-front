import '@/styles/globals.css';
import '@/styles/animations.css';

import { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { StompProvider } from '@/context/socket';
import { MessagingProvider } from '@/context/messaging';
import { VoicePlayerProvider } from '@/context/voicePlayer';
import { CallProvider } from '@/context/CallContext';
import GlobalNotifications from '@/component/GlobalNotifications';
import GlobalCallHandler from '@/component/GlobalCallHandler';
import { isAuthenticated } from '@/utils/api';

function unregisterServiceWorkersInDev() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

function registerServiceWorker() {
  if (process.env.NODE_ENV !== 'production') return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            }
          });
        });
      })
      .catch((_error) => {});

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_READY') {
      }
    });
  });
}

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isPublicRoute = useMemo(() => {
    const path = router?.pathname || '';
    return path === '/' || path === '/login' || path === '/register';
  }, [router?.pathname]);

  const [authed, setAuthed] = useState(() =>
    typeof window !== 'undefined' ? isAuthenticated() : false
  );

  useEffect(() => {
    const syncAuthed = () => setAuthed(isAuthenticated());
    syncAuthed();
    router.events.on('routeChangeComplete', syncAuthed);
    return () => router.events.off('routeChangeComplete', syncAuthed);
  }, [router.events]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      unregisterServiceWorkersInDev();
      return;
    }
    registerServiceWorker();
  }, []);

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes"
        />
      </Head>
      {isPublicRoute || !authed ? (
        <Component {...pageProps} />
      ) : (
        <StompProvider>
          <MessagingProvider>
            <VoicePlayerProvider>
              <CallProvider>
                <Component {...pageProps} />
                <GlobalNotifications />
                <GlobalCallHandler />
              </CallProvider>
            </VoicePlayerProvider>
          </MessagingProvider>
        </StompProvider>
      )}
    </>
  );
}
