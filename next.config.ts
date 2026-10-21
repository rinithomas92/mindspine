import type { NextConfig } from "next";
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["exceljs"],
  // Create Patient / Add Clinician embed a profile picture and (for clinicians) a practice logo
  // as base64 in the same server action submission — two ~2MB images can exceed the 1MB default.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
