import { db } from "@/lib/db";
import type { DomainTally } from "@/lib/scoring/readiness";

type CertificationWithDomains = {
  id: string;
  domains: Array<{ id: string; slug: string; name: string; weight: unknown }>;
};

/**
 * Windowed current-mastery tally: only the most recent response per question
 * inside the window counts, so re-answering a previously-missed question
 * actually moves the number. Shared between the dashboard (single cert) and
 * the profile page (one cert at a time, across all attempted certs).
 */
export async function getDomainTallies(
  userId: string,
  certification: CertificationWithDomains,
  since: Date,
): Promise<DomainTally[]> {
  const responses = await db.questionResponse.findMany({
    where: {
      userId,
      answeredAt: { gte: since },
      question: { certificationId: certification.id },
    },
    orderBy: { answeredAt: "desc" },
    select: { questionId: true, domainId: true, isCorrect: true },
  });

  const latest = new Map<string, { domainId: string; isCorrect: boolean }>();
  for (const response of responses) {
    if (!latest.has(response.questionId)) {
      latest.set(response.questionId, {
        domainId: response.domainId,
        isCorrect: response.isCorrect,
      });
    }
  }

  const tallyByDomain = new Map<string, { answered: number; correct: number }>();
  for (const { domainId, isCorrect } of latest.values()) {
    const tally = tallyByDomain.get(domainId) ?? { answered: 0, correct: 0 };
    tally.answered += 1;
    if (isCorrect) tally.correct += 1;
    tallyByDomain.set(domainId, tally);
  }

  return certification.domains.map((domain) => {
    const tally = tallyByDomain.get(domain.id) ?? { answered: 0, correct: 0 };
    return {
      domainId: domain.id,
      slug: domain.slug,
      name: domain.name,
      weight: Number(domain.weight),
      answered: tally.answered,
      correct: tally.correct,
    };
  });
}
