/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  generateBuildId: async () => {
    if (process.env.BUILD_ID) {
      return process.env.BUILD_ID;
    }
    return `build-${Date.now()}`;
  },

  poweredByHeader: false,

  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl && (apiUrl.startsWith('http://') || apiUrl.startsWith('https://'))) {
      return [
        {
          source: '/api/:path*',
          destination: `${apiUrl.replace(/\/$/, '')}/:path*`,
        },
      ];
    }
    return [];
  },

  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Для next/image с внешними URL (аватарки, CDN). В продакшене лучше сузить до конкретных доменов.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**', pathname: '**' },
      { protocol: 'http', hostname: '**', pathname: '**' },
    ],
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  swcMinify: true,
};

module.exports = nextConfig;
