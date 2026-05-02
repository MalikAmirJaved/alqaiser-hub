/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Enable gzip/brotli compression
  compress: true,

  // Standalone output — optimal for Docker / production deployments
  output: "standalone",

  // Experimental: enable SWC-based CSS transforms if needed
  experimental: {
    // optimizePackageImports helps tree-shake large icon/component libraries
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts"],
  },

  // Security & caching headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Aggressive caching for static assets
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
