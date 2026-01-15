import "@/styles/globals.css";

import { useMemo, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { StompProvider } from "@/context/socket";
import { MessagingProvider } from "@/context/messaging";
import { VoicePlayerProvider } from "@/context/voicePlayer";
import { CallProvider } from "@/context/CallContext";
import GlobalNotifications from "@/component/GlobalNotifications";
import GlobalCallHandler from "@/component/GlobalCallHandler";
import { isAuthenticated } from "@/utils/api";

// Telegram Web подход: регистрация Service Worker для кеширования
function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
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
        .catch((error) => {
        });
      
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_READY') {
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
