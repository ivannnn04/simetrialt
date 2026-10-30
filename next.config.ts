import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Catalogue PDFs are uploaded through a server action (Vercel still caps request bodies at ~4.5 MB).
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // pdf.js / sharp must not be bundled by Turbopack
  serverExternalPackages: ["unpdf", "sharp", "@napi-rs/canvas"],
};

export default nextConfig;
