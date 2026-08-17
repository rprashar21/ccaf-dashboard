import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

// Development only. Creates a demo learner with a few completed attempts so the
// dashboard can be built and checked without clicking through quizzes by hand.
// Never run against production: it writes fabricated responses.

const DEMO_EMAIL = "demo@example.test";

async function main() {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("dev-user seed must not run in production");
  }

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const certification = await db.certification.findFirstOrThrow({
      where: { slug: "cca-f" },
      include: { domains: { orderBy: { sortOrder: "asc" } } },
    });

    const user = await db.user.upsert({
      where: { email: DEMO_EMAIL },
      create: { email: DEMO_EMAIL, name: "Demo Learner" },
      update: {},
    });

    // Start clean so re-running does not pile up attempts.
    await db.quizAttempt.deleteMany({ where: { userId: user.id } });

    const questions = await db.question.findMany({
      where: { certificationId: certification.id, status: "PUBLISHED" },
      include: { options: { select: { id: true, isCorrect: true } } },
      orderBy: { externalId: "asc" },
    });

    // Deliberately uneven accuracy per domain, so the weakest-domain nudge and
    // the hatched "not enough data" state both have something to render.
    const accuracyByDomainSlug: Record<string, number> = {
      "agentic-architecture": 0.85,
      "tools-mcp": 0.5,
      "tool-design-mcp": 0.5,
      "prompting-context": 0.7,
      "claude-code": 0.4,
    };

    const domainSlugById = new Map(certification.domains.map((d) => [d.id, d.slug]));

    let index = 0;
    for (const [attemptIndex, daysAgo] of [4, 2, 0].entries()) {
      const slice = questions.slice(attemptIndex * 12, attemptIndex * 12 + 12);
      if (slice.length === 0) break;

      const completedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const attempt = await db.quizAttempt.create({
        data: {
          userId: user.id,
          certificationId: certification.id,
          mode: "PRACTICE",
          status: "COMPLETED",
          questionCount: slice.length,
          startedAt: new Date(completedAt.getTime() - 10 * 60 * 1000),
          completedAt,
        },
      });

      let correctCount = 0;
      const tally = new Map<string, { answered: number; correct: number }>();

      for (const [position, question] of slice.entries()) {
        const slug = domainSlugById.get(question.domainId) ?? "";
        const rate = accuracyByDomainSlug[slug] ?? 0.6;
        // Deterministic rather than random, so the demo dashboard is stable.
        const isCorrect = index % 100 < Math.round(rate * 100);
        index += 17;

        const chosen = isCorrect
          ? (question.options.find((o) => o.isCorrect) ?? question.options[0])
          : (question.options.find((o) => !o.isCorrect) ?? question.options[0]);
        if (!chosen) continue;

        await db.quizAttemptQuestion.create({
          data: { attemptId: attempt.id, questionId: question.id, position },
        });

        await db.questionResponse.create({
          data: {
            attemptId: attempt.id,
            questionId: question.id,
            userId: user.id,
            domainId: question.domainId,
            selectedOptionIds: [chosen.id],
            isCorrect,
            answeredAt: completedAt,
          },
        });

        if (isCorrect) correctCount += 1;
        const row = tally.get(question.domainId) ?? { answered: 0, correct: 0 };
        row.answered += 1;
        if (isCorrect) row.correct += 1;
        tally.set(question.domainId, row);
      }

      await db.attemptDomainResult.createMany({
        data: [...tally.entries()].map(([domainId, row]) => ({
          attemptId: attempt.id,
          domainId,
          answered: row.answered,
          correct: row.correct,
        })),
      });

      const accuracy = correctCount / slice.length;
      await db.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          correctCount,
          rawAccuracy: accuracy,
          scaledScore: Math.round(accuracy * certification.scoreScaleMax),
          passed: accuracy * certification.scoreScaleMax >= certification.passingScore,
          durationSeconds: 600,
        },
      });
    }

    console.log(`Demo user ready: ${DEMO_EMAIL}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
