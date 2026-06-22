
/** @type {import('next').NextConfig} */
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: "true",
});
const nextConfig = {
  reactStrictMode: true,

  // Enable gzip/brotli compression
  compress: true,

  // Standalone output — optimal for Docker / production deployments
  output: "standalone",

  allowedDevOrigins: ['192.168.88.51'],

  // Experimental: enable SWC-based CSS transforms if needed
  experimental: {
    cpus: 4,
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
    ];
  },
};

export default withBundleAnalyzer(nextConfig);

