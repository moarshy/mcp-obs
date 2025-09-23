/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@mcplatform/database'],
  },
  transpilePackages: ['@mcplatform/database', '@mcplatform/server-sdk', '@mcplatform/client-sdk'],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig