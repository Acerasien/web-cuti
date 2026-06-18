import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For VPS deployment: output standalone build
  // Uncomment when deploying to production:
  // output: "standalone",

  // Allow serving uploaded files from /public/uploads
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

// Reload triggered for Prisma client updates.
export default nextConfig;
