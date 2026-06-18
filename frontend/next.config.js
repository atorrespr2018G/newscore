const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const cdnHost = process.env.NEXT_PUBLIC_MEDIA_CDN_HOST

const remotePatterns = [
  {
    protocol: 'http',
    hostname: 'localhost',
    pathname: '/media/**',
  },
  {
    protocol: 'http',
    hostname: '127.0.0.1',
    pathname: '/media/**',
  },
]

if (cdnHost) {
  remotePatterns.push({
    protocol: 'https',
    hostname: cdnHost,
    pathname: '/**',
  })
}

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns,
  },
  async rewrites() {
    const mediaProxyTarget = (
      process.env.MEDIA_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_NEWS_API_URL ??
      'http://localhost:5002'
    ).replace(/\/$/, '')
    return [
      {
        source: '/media/:path*',
        destination: `${mediaProxyTarget}/media/:path*`,
      },
    ]
  },
}

module.exports = withNextIntl(nextConfig)
