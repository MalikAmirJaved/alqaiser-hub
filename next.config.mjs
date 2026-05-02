/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true, // ignoring during initial migration build
  },
  typescript: {
    ignoreBuildErrors: true, // ignoring during initial migration build
  }
};

export default nextConfig;
