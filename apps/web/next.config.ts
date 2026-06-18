import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@night-shift/shared'],
  experimental: {
    externalDir: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/:path*',
      },
    ]
  },
}

export default nextConfig
