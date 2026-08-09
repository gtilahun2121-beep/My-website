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
};
module.exports = nextConfig;
