/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Prevent ESLint warnings/formatting from failing production builds on Vercel
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
