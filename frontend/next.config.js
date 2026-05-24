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
}

module.exports = nextConfig
