/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/zap/:path*",
          destination: "https://healapi.vercel.app/api/zap/:path*",
        },
      ];
    }
    return [];
  },
};
export default nextConfig;
