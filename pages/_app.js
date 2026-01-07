import "@/styles/globals.css";

import { useMemo, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { StompProvider } from "@/context/socket";
import { MessagingProvider } from "@/context/messaging";
import { VoicePlayerProvider } from "@/context/voicePlayer";
import GlobalNotifications from "@/component/GlobalNotifications";
import { isAuthenticated } from "@/utils/api";

// Telegram Web подход: регистрация Service Worker для кеширования
function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Service Worker registered:', registration.scope);
          
          // Проверяем обновления (как в Telegram Web)
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Новый Service Worker доступен
                console.log('[SW] New Service Worker available');
              }
            });
          });
        })
        .catch((error) => {
          console.error('[SW] Service Worker registration failed:', error);
        });
      
      // Обработка сообщений от Service Worker (как в Telegram Web)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_READY') {
          console.log('[SW] Service Worker ready');
        }
      });
    });
  }
}

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isPublicRoute = useMemo(() => {
    const path = router?.pathname || "";
    return path === "/login" || path === "/register";
  }, [router?.pathname]);

  const authed = isAuthenticated();

  // Регистрируем Service Worker при монтировании (Telegram Web подход)
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
      </Head>
      {isPublicRoute || !authed ? (
        <Component {...pageProps} />
      ) : (
        <StompProvider>
          <MessagingProvider>
            <VoicePlayerProvider>
              <Component {...pageProps} />
              <GlobalNotifications />
            </VoicePlayerProvider>
          </MessagingProvider>
        </StompProvider>
      )}
    </>
  );
}
