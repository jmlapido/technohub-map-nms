/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow cross-origin requests from Cloudflare tunnel domain
  allowedDevOrigins: [
    'map.jmlapido.com',
    'https://map.jmlapido.com',
  ],
}

module.exports = nextConfig



