import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { QuestionRunner } from "./_components/QuestionRunner";

export const metadata: Metadata = { title: "Practice" };

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ certSlug: string; attemptId: string }>;
}) {
  const { certSlug, attemptId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/c/${certSlug}/practice/${attemptId}`);
  }

  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId: session.user.id },
    include: {
      certification: { select: { slug: true } },
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

  if (!attempt || attempt.certification.slug !== certSlug) notFound();
  if (attempt.status === "COMPLETED") {
    redirect(`/c/${certSlug}/practice/${attemptId}/results`);
  }

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
