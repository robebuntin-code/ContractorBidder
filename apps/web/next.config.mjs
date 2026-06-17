/** @type {import('next').NextConfig} */
const apiOrigin =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ?? 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  // Allow importing the shared workspace packages (TS source) directly.
  transpilePackages: ['@contractor-bidder/types', '@contractor-bidder/ui'],
  async rewrites() {
    // Proxy dev-media uploads through Next so browser PUTs are same-origin (no CORS).
    return [
      {
        source: '/api/v1/dev-media/:path*',
        destination: `${apiOrigin}/api/v1/dev-media/:path*`,
      },
    ];
  },
};

export default nextConfig;
