/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: require('path').join(__dirname, '..', '..'),
  },
  reactStrictMode: true,
  images: { remotePatterns: [{ hostname: '**' }] },
  // Optimization flags for faster builds
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['framer-motion', 'react', 'react-dom'],
  },
  // Parallel builds
  compress: true,

  // ── API Proxy ────────────────────────────────────────────────────────────────
  // Rewrites all /api/* requests to the NestJS backend.
  // This means the browser never sends cross-origin requests — Next.js acts as
  // a reverse proxy, so CORS headers from the backend are irrelevant for
  // browser-to-frontend requests.
  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
