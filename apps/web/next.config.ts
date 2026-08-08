/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ hostname: '**' }] },
  // Optimization flags for faster builds
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['framer-motion', 'react', 'react-dom'],
  },
  // Parallel builds
  compress: true,
};
module.exports = nextConfig;
