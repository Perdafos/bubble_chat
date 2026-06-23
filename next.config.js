/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Turn off strict mode to prevent double execution in dev mode (useful for socket connections)
};

module.exports = nextConfig;
