import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const BASE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const certifications = await db.certification.findMany({
    where: { isPublished: true },
    include: { domains: { select: { slug: true, updatedAt: true } } },
  });

  return [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    ...certifications.flatMap((certification) => [
      {
        url: `${BASE_URL}/c/${certification.slug}`,
        lastModified: certification.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
      ...certification.domains.map((domain) => ({
        url: `${BASE_URL}/c/${certification.slug}/domains/${domain.slug}`,
        lastModified: domain.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ]),
  ];
}
