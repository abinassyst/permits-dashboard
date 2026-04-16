/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,
  ...(isProd && {
    output: 'export',
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
    assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
  }),
}

module.exports = nextConfig
