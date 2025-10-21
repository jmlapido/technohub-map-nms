/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

// Use PORT environment variable if set
if (process.env.PORT) {
  nextConfig.server = {
    port: parseInt(process.env.PORT, 10),
  }
}

module.exports = nextConfig



