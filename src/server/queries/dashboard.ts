import { db } from "@/lib/db";
import { READINESS_DEFAULTS } from "@/lib/scoring/constants";
import { calculateReadiness } from "@/lib/scoring/readiness";
import { calculateStreak } from "@/lib/streak";
import { getDomainTallies } from "@/server/queries/domainTallies";

/**
 * Everything the dashboard renders, in one place.
 *
 * The readiness estimate counts only the most recent response per question
 * inside the window. That measures current mastery rather than a lifetime
 * average, so re-answering a question you previously missed actually moves the
 * number.
 */
export async function getDashboardData(userId: string, certSlug: string) {
  const certification = await db.certification.findFirst({
    where: { slug: certSlug, isPublished: true },
    include: { domains: { orderBy: { sortOrder: "asc" } } },
  });
  if (!certification) return null;

  const since = new Date(Date.now() - READINESS_DEFAULTS.windowDays * 24 * 60 * 60 * 1000);

  const [tallies, recentAttempts, completedDays, inProgress] = await Promise.all([
    getDomainTallies(userId, certification, since),
    db.quizAttempt.findMany({
      where: { userId, certificationId: certification.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 5,
      select: {
        id: true,
        mode: true,
        questionCount: true,
        correctCount: true,
        scaledScore: true,
        passed: true,
        completedAt: true,
      },
    }),
    db.quizAttempt.findMany({
      where: { userId, certificationId: certification.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
    db.quizAttempt.findFirst({
      where: { userId, certificationId: certification.id, status: "IN_PROGRESS" },
      select: { id: true, questionCount: true },
    }),
  ]);

  const readiness = calculateReadiness({
    domains: tallies,
    passingScore: certification.passingScore,
    scoreScaleMax: certification.scoreScaleMax,
  });

  return {
    certification: {
      id: certification.id,
      slug: certification.slug,
      name: certification.name,
      code: certification.code,
      passingScore: certification.passingScore,
      scoreScaleMax: certification.scoreScaleMax,
      sourceNote: certification.sourceNote,
    },
    readiness,
    recentAttempts,
    inProgress,
    streak: calculateStreak(completedDays.map((a) => a.completedAt)),
    hasCompletedAttempt: recentAttempts.length > 0,
  };
}

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
