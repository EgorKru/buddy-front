/** @type {import('next').NextConfig} */
const prodLike = process.env.NODE_ENV === 'production';

const nextConfig = {
  env: {
    NEXT_PUBLIC_E2EE_ENABLED: process.env.NEXT_PUBLIC_E2EE_ENABLED ?? (prodLike ? 'false' : 'true'),
  },
};

module.exports = nextConfig;
