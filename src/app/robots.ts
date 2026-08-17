import type { MetadataRoute } from "next";

const BASE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing behind sign-in is useful to a crawler.
      disallow: ["/dashboard", "/signin", "/api/"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
