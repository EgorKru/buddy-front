const nextConfig = {
  reactStrictMode: true,
  
  // Генерируем buildId на основе git commit hash для правильного кеширования
  generateBuildId: async () => {
    // Используем git commit hash если доступен, иначе timestamp
    // Это обеспечит правильную инвалидацию кеша при деплое
    if (process.env.BUILD_ID) {
      return process.env.BUILD_ID;
    }
    // Fallback на timestamp для стабильности
    return `build-${Date.now()}`;
  },
  
  // Настройки для production
  poweredByHeader: false,
  
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    
    if (apiUrl && apiUrl.includes('pager.website')) {
      return [
        {
          source: '/api/:path*',
          destination: `${apiUrl}/:path*`,
        },
      ];
    }
    
    return [];
  },
  
  // Заголовки для правильного кеширования статических файлов
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
}

module.exports = nextConfig
