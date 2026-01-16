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
