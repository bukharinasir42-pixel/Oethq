/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2gb",
    },
  },
  // /api/* is proxied at runtime by src/app/api/[...path]/route.ts (reads API_URL per request).
  // Do not add next.config rewrites here — they bake the ECS IP at build time and break after redeploys.
  transpilePackages: [
    "@tiptap/react",
    "@tiptap/starter-kit",
    "@tiptap/extension-placeholder",
    "@tiptap/extension-link",
    "@tiptap/pm",
    "@tiptap/core"
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "slateblue-emu-464729.hostingersite.com",
      },
    ],
  },
};

export default nextConfig;
