/** @type {import('next').NextConfig} */
const prodLike = process.env.NODE_ENV === 'production';
const e2eDev =
  process.env.PLAYWRIGHT_TEST === '1' ||
  process.env.E2E_DISABLE_E2EE === '1' ||
  process.env.NEXT_PUBLIC_E2EE_ENABLED === 'false';

const nextConfig = {
  env: {
    NEXT_PUBLIC_E2EE_ENABLED:
      process.env.NEXT_PUBLIC_E2EE_ENABLED ?? (prodLike || e2eDev ? 'false' : 'true'),
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api',
    NEXT_PUBLIC_WS_NATIVE_URL:
      process.env.NEXT_PUBLIC_WS_NATIVE_URL || 'ws://localhost:8080/ws-native',
  },
};

module.exports = nextConfig;
