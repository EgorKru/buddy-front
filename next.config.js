/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Проксируем API запросы через Next.js сервер для обхода CORS
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    
    // Если используем production URL, настраиваем прокси
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
}

module.exports = nextConfig
