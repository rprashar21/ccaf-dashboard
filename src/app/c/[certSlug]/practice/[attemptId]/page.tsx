import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getGuestUserId } from "@/lib/guest";
import { Nav } from "@/components/Nav";
import { FullSetRunner } from "./_components/FullSetRunner";
import { QuestionRunner } from "./_components/QuestionRunner";

export const metadata: Metadata = { title: "Practice" };

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ certSlug: string; attemptId: string }>;
}) {
  const { certSlug, attemptId } = await params;

  const userId = await getGuestUserId();

  // A light lookup first: the two modes need different shapes of the same
  // attempt (full-set needs correctness data for already-answered slots so a
  // resumed session can reveal them; the linear runner deliberately never
  // fetches isCorrect at all, so that guarantee stays a query-level fact, not
  // something enforced only by careful prop-passing).
  const attemptMeta = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId },
    select: { mode: true, status: true, certification: { select: { slug: true } } },
  });

  if (!attemptMeta || attemptMeta.certification.slug !== certSlug) notFound();
  if (attemptMeta.status === "COMPLETED") {
    redirect(`/c/${certSlug}/practice/${attemptId}/results`);
  }

  if (
    attemptMeta.mode === "FULL_SET" ||
    attemptMeta.mode === "IMPORTED_SET" ||
    attemptMeta.mode === "MOCK_EXAM"
  ) {
    const attempt = await db.quizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: {
        certification: { select: { code: true, name: true } },
        responses: { select: { questionId: true, selectedOptionIds: true, isCorrect: true } },
        slots: {
          orderBy: { position: "asc" },
          include: {
            question: {
              include: {
                domain: { select: { name: true } },
                options: {
                  orderBy: { sortOrder: "asc" },
                  select: { id: true, label: true, body: true, isCorrect: true },
                },
              },
            },
          },
        },
      },
    });

    const responseByQuestionId = new Map(attempt.responses.map((r) => [r.questionId, r]));

    const slots = attempt.slots.map((slot) => {
      const response = responseByQuestionId.get(slot.questionId) ?? null;
      return {
        questionId: slot.questionId,
        position: slot.position,
        stem: slot.question.stem,
        domainName: slot.question.domain.name,
        explanation: slot.question.explanation,
        bookmarked: slot.bookmarked,
        // The answer key is only ever included once this slot has a response
        // on record — an unanswered question's options never carry isCorrect.
        options: slot.question.options.map(({ id, label, body }) => ({ id, label, body })),
        response: response
          ? {
              selectedOptionIds: response.selectedOptionIds,
              isCorrect: response.isCorrect,
              correctOptionIds: slot.question.options.filter((o) => o.isCorrect).map((o) => o.id),
            }
          : null,
      };
    });

    const domainNames = [...new Set(slots.map((s) => s.domainName))];

    return (
      <div className="flex min-h-screen flex-col">
        <Nav signedIn />
        <main className="quiz-dark flex-1 px-5 py-7">
          <div className="mx-auto w-full max-w-4xl">
            <FullSetRunner
              attemptId={attempt.id}
              certCode={attempt.certification.code}
              certName={attempt.certification.name}
              domainNames={domainNames}
              slots={slots}
            />
          </div>
        </main>
      </div>
    );
  }

  const attempt = await db.quizAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      responses: { select: { questionId: true } },
      slots: {
        orderBy: { position: "asc" },
        include: {
          question: {
            include: {
              domain: { select: { name: true } },
              // isCorrect is deliberately not selected: the answer key must not
              // reach the browser before the learner commits to a choice.
              options: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, label: true, body: true },
              },
            },
          },
        },
      },
    },
  });

  const answeredIds = new Set(attempt.responses.map((r) => r.questionId));

  const slots = attempt.slots.map((slot) => ({
    questionId: slot.questionId,
    position: slot.position,
    stem: slot.question.stem,
    domainName: slot.question.domain.name,
    options: slot.question.options,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <Nav signedIn />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <QuestionRunner
          attemptId={attempt.id}
          slots={slots}
          answeredPositions={attempt.slots
            .filter((s) => answeredIds.has(s.questionId))
            .map((s) => s.position)}
        />
      </main>
    </div>
  );
}
