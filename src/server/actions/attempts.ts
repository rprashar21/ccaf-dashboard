"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { gradeResponse } from "@/lib/quiz/grade";
import { selectQuestions, type Candidate } from "@/lib/quiz/selectQuestions";
import { calculateReadiness, type DomainTally } from "@/lib/scoring/readiness";
import { getGuestUserId } from "@/lib/guest";
import { IMPORTED_SET_EXTERNAL_ID_PREFIX } from "@/server/queries/certifications";

const startSchema = z.object({
  certSlug: z.string().min(1),
  mode: z.enum(["PRACTICE", "DOMAIN_DRILL", "MOCK_EXAM", "FULL_SET", "IMPORTED_SET"]),
  // Only meaningful for PRACTICE/DOMAIN_DRILL — FULL_SET/IMPORTED_SET always
  // take every question in their pool, so they have none to request.
  questionCount: z.number().int().min(1).max(60).optional(),
  domainId: z.string().min(1).optional(),
});

export async function startAttempt(input: z.infer<typeof startSchema>) {
  const userId = await getGuestUserId();
  const { certSlug, mode, questionCount, domainId } = startSchema.parse(input);

  const certification = await db.certification.findFirst({
    where: { slug: certSlug, isPublished: true },
    include: { domains: { orderBy: { sortOrder: "asc" } } },
  });
  if (!certification) throw new Error(`Unknown certification "${certSlug}"`);

  // One attempt at a time per certification *and mode*: resume rather than
  // stacking up half-finished attempts of the same kind the learner will
  // never come back to. Scoped by mode (not just certification) so starting
  // a mock exam while a full-set run is still open doesn't silently dump the
  // learner into the unrelated in-progress attempt.
  const existing = await db.quizAttempt.findFirst({
    where: { userId, certificationId: certification.id, status: "IN_PROGRESS", mode },
  });
  if (existing) redirect(`/c/${certSlug}/practice/${existing.id}`);

  const attemptId =
    mode === "FULL_SET" || mode === "IMPORTED_SET"
      ? await startBulkAttempt(userId, certification.id, mode)
      : await startSampledAttempt(userId, certification, mode, questionCount, domainId);

  redirect(`/c/${certSlug}/practice/${attemptId}`);
}

/**
 * Every question in the mode's pool, once, in a stable order. Deliberately
 * bypasses selectQuestions: that function is for weighted sampling of a
 * subset, and both bulk modes want completeness, not a share of each domain.
 */
async function startBulkAttempt(
  userId: string,
  certificationId: string,
  mode: "FULL_SET" | "IMPORTED_SET",
): Promise<string> {
  const pool = await db.question.findMany({
    where: {
      certificationId,
      status: "PUBLISHED",
      ...(mode === "IMPORTED_SET"
        ? { externalId: { startsWith: IMPORTED_SET_EXTERNAL_ID_PREFIX } }
        : {}),
    },
    select: { id: true },
    orderBy: [{ domain: { sortOrder: "asc" } }, { externalId: "asc" }],
  });
  if (pool.length === 0) throw new Error("No published questions available");

  return db.$transaction(async (tx) => {
    const created = await tx.quizAttempt.create({
      data: { userId, certificationId, mode, questionCount: pool.length },
    });

    await tx.quizAttemptQuestion.createMany({
      data: pool.map((question, position) => ({
        attemptId: created.id,
        questionId: question.id,
        position,
      })),
    });

    return created.id;
  });
}

async function startSampledAttempt(
  userId: string,
  certification: { id: string; domains: Array<{ id: string; weight: unknown }> },
  mode: "PRACTICE" | "DOMAIN_DRILL" | "MOCK_EXAM",
  questionCount: number | undefined,
  domainId: string | undefined,
): Promise<string> {
  if (!questionCount) throw new Error("questionCount is required for this mode");

  const pool = await db.question.findMany({
    where: {
      certificationId: certification.id,
      status: "PUBLISHED",
      ...(domainId ? { domainId } : {}),
    },
    select: { id: true, domainId: true },
  });
  if (pool.length === 0) throw new Error("No published questions available");

  // Prior answers drive the unseen / previously-missed / least-recently-seen
  // tiering in the selector.
  const history = await db.questionResponse.findMany({
    where: { userId, questionId: { in: pool.map((q) => q.id) } },
    orderBy: { answeredAt: "desc" },
    select: { questionId: true, isCorrect: true, answeredAt: true },
  });

  const seen = new Map<string, { count: number; lastCorrect: boolean; lastAt: number }>();
  for (const row of history) {
    const prior = seen.get(row.questionId);
    if (prior) prior.count += 1;
    else
      seen.set(row.questionId, {
        count: 1,
        lastCorrect: row.isCorrect,
        lastAt: row.answeredAt.getTime(),
      });
  }

  const candidates: Candidate[] = pool.map((q) => {
    const prior = seen.get(q.id);
    return {
      id: q.id,
      domainId: q.domainId,
      timesAnswered: prior?.count ?? 0,
      lastCorrect: prior?.lastCorrect ?? null,
      lastAnsweredAt: prior?.lastAt ?? null,
    };
  });

  const domains = domainId
    ? [{ domainId, weight: 1 }]
    : certification.domains.map((d) => ({ domainId: d.id, weight: Number(d.weight) }));

  const picked = selectQuestions({ candidates, domains, count: questionCount });

  return db.$transaction(async (tx) => {
    const created = await tx.quizAttempt.create({
      data: {
        userId,
        certificationId: certification.id,
        mode,
        questionCount: picked.length,
        domainFilterId: domainId ?? null,
      },
    });

    await tx.quizAttemptQuestion.createMany({
      data: picked.map((question, position) => ({
        attemptId: created.id,
        questionId: question.id,
        position,
      })),
    });

    return created.id;
  });
}

const submitSchema = z.object({
  attemptId: z.string().min(1),
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string().min(1)).min(1),
  timeSpentSeconds: z.number().int().min(0).max(86_400).optional(),
});

export type SubmitResult = {
  isCorrect: boolean;
  correctOptionIds: string[];
  explanation: string;
};

export async function submitResponse(input: z.infer<typeof submitSchema>): Promise<SubmitResult> {
  const userId = await getGuestUserId();
  const { attemptId, questionId, selectedOptionIds, timeSpentSeconds } = submitSchema.parse(input);

  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { certification: { select: { slug: true } } },
  });
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.status !== "IN_PROGRESS") throw new Error("This attempt is already finished");

  // The question must be on this attempt's slate; a client cannot answer
  // something that was never dealt to it.
  const slot = await db.quizAttemptQuestion.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } },
  });
  if (!slot) throw new Error("That question is not part of this attempt");

  const question = await db.question.findUniqueOrThrow({
    where: { id: questionId },
    include: { options: { select: { id: true, isCorrect: true } } },
  });

  // Graded server-side. Correct-answer flags are never sent to the browser
  // before the learner has committed to a choice.
  const grade = gradeResponse(question.options, selectedOptionIds);

  await db.questionResponse.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: {
      attemptId,
      questionId,
      userId,
      domainId: question.domainId,
      selectedOptionIds: grade.selectedOptionIds,
      isCorrect: grade.isCorrect,
      timeSpentSeconds: timeSpentSeconds ?? null,
    },
    update: {
      selectedOptionIds: grade.selectedOptionIds,
      isCorrect: grade.isCorrect,
      timeSpentSeconds: timeSpentSeconds ?? null,
      answeredAt: new Date(),
    },
  });

  return {
    isCorrect: grade.isCorrect,
    correctOptionIds: grade.correctOptionIds,
    explanation: question.explanation,
  };
}

const finishSchema = z.object({ attemptId: z.string().min(1) });

export async function finishAttempt(input: z.infer<typeof finishSchema>) {
  const userId = await getGuestUserId();
  const { attemptId } = finishSchema.parse(input);

  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId },
    include: {
      certification: { include: { domains: { orderBy: { sortOrder: "asc" } } } },
      responses: { select: { domainId: true, isCorrect: true } },
    },
  });
  if (!attempt) throw new Error("Attempt not found");

  const slug = attempt.certification.slug;

  // Idempotent: finishing an already-finished attempt just goes to its results.
  if (attempt.status === "COMPLETED") redirect(`/c/${slug}/practice/${attemptId}/results`);

  const tallyByDomain = new Map<string, { answered: number; correct: number }>();
  for (const response of attempt.responses) {
    const tally = tallyByDomain.get(response.domainId) ?? { answered: 0, correct: 0 };
    tally.answered += 1;
    if (response.isCorrect) tally.correct += 1;
    tallyByDomain.set(response.domainId, tally);
  }

  const answered = attempt.responses.length;
  const correctCount = attempt.responses.filter((r) => r.isCorrect).length;

  const tallies: DomainTally[] = attempt.certification.domains.map((domain) => {
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

  // No shrinkage here: a completed attempt is scored on its own evidence, unlike
  // the dashboard estimate which has to stay honest about thin samples.
  const scored = calculateReadiness({
    domains: tallies,
    passingScore: attempt.certification.passingScore,
    scoreScaleMax: attempt.certification.scoreScaleMax,
    options: { shrinkage: 0 },
  });

  const completedAt = new Date();

  await db.$transaction(async (tx) => {
    await tx.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: "COMPLETED",
        completedAt,
        durationSeconds: Math.round((completedAt.getTime() - attempt.startedAt.getTime()) / 1000),
        correctCount,
        rawAccuracy: answered > 0 ? correctCount / answered : 0,
        scaledScore: scored.score,
        passed: scored.score >= attempt.certification.passingScore,
      },
    });

    await tx.attemptDomainResult.deleteMany({ where: { attemptId } });
    await tx.attemptDomainResult.createMany({
      data: [...tallyByDomain.entries()].map(([domainId, tally]) => ({
        attemptId,
        domainId,
        answered: tally.answered,
        correct: tally.correct,
      })),
    });
  });

  revalidatePath("/dashboard");
  redirect(`/c/${slug}/practice/${attemptId}/results`);
}

export async function abandonAttempt(input: z.infer<typeof finishSchema>) {
  const userId = await getGuestUserId();
  const { attemptId } = finishSchema.parse(input);

  await db.quizAttempt.updateMany({
    where: { id: attemptId, userId, status: "IN_PROGRESS" },
    data: { status: "ABANDONED", completedAt: new Date() },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

const bookmarkSchema = z.object({
  attemptId: z.string().min(1),
  questionId: z.string().min(1),
});

export async function toggleBookmark(
  input: z.infer<typeof bookmarkSchema>,
): Promise<{ bookmarked: boolean }> {
  const userId = await getGuestUserId();
  const { attemptId, questionId } = bookmarkSchema.parse(input);

  const attempt = await db.quizAttempt.findFirst({ where: { id: attemptId, userId } });
  if (!attempt) throw new Error("Attempt not found");

  // A slot exists as soon as the attempt starts, whether or not it's been
  // answered — bookmarking must not require a QuestionResponse row to exist.
  const slot = await db.quizAttemptQuestion.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } },
  });
  if (!slot) throw new Error("That question is not part of this attempt");

  const updated = await db.quizAttemptQuestion.update({
    where: { id: slot.id },
    data: { bookmarked: !slot.bookmarked },
    select: { bookmarked: true },
  });

  return updated;
}
