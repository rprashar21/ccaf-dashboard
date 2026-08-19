import { cache } from "react";
import { db } from "@/lib/db";

// Certification metadata and the domain blueprint. Read on both the marketing
// page and inside the app, so it is request-cached.

// Every question imported from the certyiq.com scrape (docs/cca-f-quiz-dashboard.html
// and the identical docs/claude-certified-architect.pdf) carries this externalId
// prefix — see prisma/seed/questions/cca-f.json. There's exactly one such import
// today, so this stays a literal constant rather than a general "source" system.
export const IMPORTED_SET_EXTERNAL_ID_PREFIX = "cca-f-mockup-";

export const getCertification = cache(async (slug: string) => {
  const certification = await db.certification.findFirst({
    where: { slug, isPublished: true },
    include: {
      domains: {
        orderBy: { sortOrder: "asc" },
        include: { subtopics: { orderBy: { name: "asc" } } },
      },
    },
  });

  if (!certification) return null;

  return {
    ...certification,
    domains: certification.domains.map((d) => ({
      ...d,
      // Decimal keeps the seeded weights exact; the scoring code wants a number.
      weight: Number(d.weight),
    })),
  };
});

export const getPublishedQuestionCount = cache(async (certificationId: string) =>
  db.question.count({ where: { certificationId, status: "PUBLISHED" } }),
);

export const getImportedQuestionCount = cache(async (certificationId: string) =>
  db.question.count({
    where: {
      certificationId,
      status: "PUBLISHED",
      externalId: { startsWith: IMPORTED_SET_EXTERNAL_ID_PREFIX },
    },
  }),
);

/**
 * One published question for the landing page demo. Deliberately excludes the
 * isCorrect flags — the browser must not be able to read the answer key before
 * the visitor commits to a choice.
 */
export async function getSampleQuestion(certificationId: string) {
  const total = await db.question.count({ where: { certificationId, status: "PUBLISHED" } });
  if (total === 0) return null;

  const [question] = await db.question.findMany({
    where: { certificationId, status: "PUBLISHED" },
    skip: Math.floor(Math.random() * total),
    take: 1,
    include: {
      domain: { select: { name: true, slug: true } },
      options: { orderBy: { sortOrder: "asc" }, select: { id: true, label: true, body: true } },
    },
  });

  if (!question) return null;

  return {
    id: question.id,
    stem: question.stem,
    domainName: question.domain.name,
    options: question.options,
  };
}
