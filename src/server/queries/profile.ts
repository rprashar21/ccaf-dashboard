import { db } from "@/lib/db";
import { READINESS_DEFAULTS } from "@/lib/scoring/constants";
import { calculateReadiness } from "@/lib/scoring/readiness";
import { calculateStreak } from "@/lib/streak";
import { getDomainTallies } from "@/server/queries/domainTallies";

/**
 * Certifications the user has touched, most recently active first. Derived
 * from QuizAttempt rather than QuestionResponse — every response traces back
 * through an attempt, so attempts alone are sufficient to find them.
 */
async function getAttemptedCertifications(userId: string) {
  const attempts = await db.quizAttempt.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    select: {
      certification: {
        include: { domains: { orderBy: { sortOrder: "asc" } } },
      },
    },
    distinct: ["certificationId"],
  });
  return attempts.map((a) => a.certification);
}

type CertificationWithDomains = Awaited<ReturnType<typeof getAttemptedCertifications>>[number];

/**
 * Lifetime bank coverage per domain: how much of the published question bank
 * this user has ever seen, and their all-time accuracy on it. Deliberately
 * distinct from readiness's recency-windowed mastery estimate — coverage is a
 * cumulative measure of exposure, so it should not shrink just because a
 * domain was studied heavily a while ago and then left alone.
 */
async function getCertificationCoverage(userId: string, certification: CertificationWithDomains) {
  const [bankCounts, everAnswered, lifetimeTotals] = await Promise.all([
    db.question.groupBy({
      by: ["domainId"],
      where: { certificationId: certification.id, status: "PUBLISHED" },
      _count: { _all: true },
    }),
    db.questionResponse.findMany({
      where: { userId, question: { certificationId: certification.id } },
      select: { domainId: true, questionId: true },
      distinct: ["questionId"],
    }),
    db.attemptDomainResult.groupBy({
      by: ["domainId"],
      where: { attempt: { userId, certificationId: certification.id } },
      _sum: { answered: true, correct: true },
    }),
  ]);

  const bankByDomain = new Map(bankCounts.map((row) => [row.domainId, row._count._all]));
  const seenByDomain = new Map<string, number>();
  for (const response of everAnswered) {
    seenByDomain.set(response.domainId, (seenByDomain.get(response.domainId) ?? 0) + 1);
  }
  const lifetimeByDomain = new Map(
    lifetimeTotals.map((row) => [
      row.domainId,
      { answered: row._sum.answered ?? 0, correct: row._sum.correct ?? 0 },
    ]),
  );

  return certification.domains.map((domain) => {
    const lifetime = lifetimeByDomain.get(domain.id) ?? { answered: 0, correct: 0 };
    return {
      domainId: domain.id,
      slug: domain.slug,
      name: domain.name,
      questionsInBank: bankByDomain.get(domain.id) ?? 0,
      questionsSeen: seenByDomain.get(domain.id) ?? 0,
      lifetimeAnswered: lifetime.answered,
      lifetimeCorrect: lifetime.correct,
    };
  });
}

export type CertificationCoverage = Awaited<ReturnType<typeof getCertificationCoverage>>[number];

/** Full completed-attempt history for one certification, most recent first. */
async function getCertificationHistory(userId: string, certificationId: string, limit = 25) {
  return db.quizAttempt.findMany({
    where: { userId, certificationId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: limit,
    select: {
      id: true,
      mode: true,
      questionCount: true,
      correctCount: true,
      scaledScore: true,
      passed: true,
      completedAt: true,
    },
  });
}

export type CertificationHistoryEntry = Awaited<ReturnType<typeof getCertificationHistory>>[number];

export type CertProfileSummary = {
  certification: CertificationWithDomains;
  readiness: ReturnType<typeof calculateReadiness>;
  coverage: CertificationCoverage[];
  history: CertificationHistoryEntry[];
};

/** Everything the profile page renders, in one place. */
export async function getProfileData(userId: string) {
  const [user, certifications, completedDates] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true },
    }),
    getAttemptedCertifications(userId),
    db.quizAttempt.findMany({
      where: { userId, status: "COMPLETED" },
      select: { completedAt: true },
    }),
  ]);

  const since = new Date(Date.now() - READINESS_DEFAULTS.windowDays * 24 * 60 * 60 * 1000);

  const certSummaries: CertProfileSummary[] = await Promise.all(
    certifications.map(async (certification) => {
      const [tallies, coverage, history] = await Promise.all([
        getDomainTallies(userId, certification, since),
        getCertificationCoverage(userId, certification),
        getCertificationHistory(userId, certification.id),
      ]);

      const readiness = calculateReadiness({
        domains: tallies,
        passingScore: certification.passingScore,
        scoreScaleMax: certification.scoreScaleMax,
      });

      return { certification, readiness, coverage, history };
    }),
  );

  const completedAttempts = certSummaries.reduce((sum, c) => sum + c.history.length, 0);
  const questionsAnsweredEver = certSummaries.reduce(
    (sum, c) => sum + c.coverage.reduce((s, d) => s + d.questionsSeen, 0),
    0,
  );

  return {
    user,
    // Global, unlike the dashboard's per-certification streak: a learner
    // studying two certs on alternating days should not see their streak
    // reset just because yesterday's activity was on the other one.
    streak: calculateStreak(completedDates.map((a) => a.completedAt)),
    certifications: certSummaries,
    totalAttemptsCompleted: completedAttempts,
    totalQuestionsAnsweredEver: questionsAnsweredEver,
  };
}

export type ProfileData = Awaited<ReturnType<typeof getProfileData>>;
