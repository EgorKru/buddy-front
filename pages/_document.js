import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ru">
      <Head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta
          name="description"
          content="Pager - современная платформа для общения и видеозвонков"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
