/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@mcp-obs/database'],
  },
  transpilePackages: ['@mcp-obs/database', '@mcp-obs/server-sdk', '@mcp-obs/client-sdk'],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Webpack configuration to handle server-only modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude server-only modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        buffer: false,
        stream: false,
        dns: false,
        net: false,
        tls: false,
        child_process: false,
        readline: false,
        zlib: false,
        events: false,
        util: false,
        assert: false,
        url: false,
        querystring: false,
      }

      // More aggressive exclusion of server-only packages
      config.externals = config.externals || []
      config.externals.push({
        'pg': 'commonjs pg',
        'pg-native': 'commonjs pg-native',
        'pgpass': 'commonjs pgpass',
        'sst': 'commonjs sst',
        'database': 'commonjs database',
        'better-auth/adapters/drizzle': 'commonjs better-auth/adapters/drizzle',
      })

      // Ignore specific packages that cause issues
      config.resolve.alias = {
        ...config.resolve.alias,
        'pgpass': false,
        'pg-native': false,
        'pg': false,
        'sst': false,
      }
    }
    return config
  },
  // Load environment variables from project root (except DATABASE_URL which comes from SST)
  env: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    APP_STAGE: process.env.APP_STAGE,
  },
}

module.exports = nextConfig