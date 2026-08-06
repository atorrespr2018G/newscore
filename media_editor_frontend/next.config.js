/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['react-filerobot-image-editor'],
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', pathname: '/media/**' },
      { protocol: 'http', hostname: '127.0.0.1', pathname: '/media/**' },
    ],
  },
  async rewrites() {
    const mediaEditorApi = (
      process.env.MEDIA_EDITOR_INTERNAL_URL ?? 'http://localhost:5004'
    ).replace(/\/$/, '')
    return [
      {
        source: '/media-editor-files/:path*',
        destination: `${mediaEditorApi}/media/:path*`,
      },
    ]
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    }
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
      path: false,
    }
    return config
  },
}

module.exports = nextConfig
