import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getGuestUserId } from "@/lib/guest";
import { Footer, Nav } from "@/components/Nav";
import { ReadinessRail } from "@/components/ReadinessRail";
import { formatClock } from "@/lib/quiz/examTimer";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ certSlug: string; attemptId: string }>;
}) {
  const { certSlug, attemptId } = await params;

  const userId = await getGuestUserId();

  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId },
    include: {
      certification: true,
      domainResults: { include: { domain: true } },
      responses: {
        include: {
          question: {
            include: {
              domain: { select: { name: true } },
              options: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!attempt || attempt.certification.slug !== certSlug) notFound();
  if (attempt.status !== "COMPLETED") redirect(`/c/${certSlug}/practice/${attemptId}`);

  const { certification } = attempt;
  const answered = attempt.responses.length;

  return (
    <div className="flex min-h-screen flex-col">
      <Nav signedIn />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <span className="tick">Attempt complete</span>
        <h1 className="font-display mt-2 text-3xl">
          {attempt.correctCount ?? 0} of {answered} correct
        </h1>
        {attempt.timeLimitSeconds !== null && attempt.durationSeconds !== null ? (
          <p className="text-graphite mt-2 text-sm">
            Finished in {formatClock(attempt.durationSeconds)} of{" "}
            {formatClock(attempt.timeLimitSeconds)} allowed
          </p>
        ) : null}

        <section className="border-hairline bg-raise mt-8 rounded-lg border p-8">
          <ReadinessRail
            score={attempt.scaledScore}
            scaleMax={certification.scoreScaleMax}
            passingScore={certification.passingScore}
            label="This attempt"
          />
          <p className="text-graphite mt-6 text-sm">
            This is this attempt scored on its own, not your overall estimate. Your dashboard blends
            it with everything else you have answered.
          </p>
        </section>

        {attempt.domainResults.length > 0 ? (
          <section className="border-hairline bg-raise mt-8 rounded-lg border p-6">
            <h2 className="tick mb-5">By domain, this attempt</h2>
            <ul className="space-y-3">
              {attempt.domainResults
                .sort((a, b) => Number(b.domain.weight) - Number(a.domain.weight))
                .map((result) => (
                  <li key={result.domainId} className="flex items-baseline justify-between gap-4">
                    <span className="text-sm">{result.domain.name}</span>
                    <span className="tabular text-sm font-bold">
                      {result.correct}/{result.answered}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-10">
          <h2 className="tick mb-5">Review every answer</h2>
          <div className="space-y-4">
            {attempt.responses.map((response) => {
              const selected = new Set(response.selectedOptionIds);
              return (
                <details
                  key={response.id}
                  className="border-hairline bg-raise rounded-lg border p-5"
                >
                  <summary className="flex cursor-pointer items-start gap-3">
                    <span
                      className={`tick shrink-0 ${response.isCorrect ? "text-gate" : "text-under"}`}
                    >
                      {response.isCorrect ? "Correct" : "Missed"}
                    </span>
                    <span className="font-display flex-1 text-base">{response.question.stem}</span>
                  </summary>

                  <div className="mt-5 space-y-2">
                    {response.question.options.map((option) => (
                      <div
                        key={option.id}
                        className={`rounded-md border px-4 py-2.5 text-sm ${
                          option.isCorrect
                            ? "border-gate bg-gate-soft"
                            : selected.has(option.id)
                              ? "border-under bg-under-soft"
                              : "border-hairline"
                        }`}
                      >
                        <span className="tabular text-graphite mr-3 font-semibold">
                          {option.label}
                        </span>
                        {option.body}
                      </div>
                    ))}
                  </div>

                  <p className="text-graphite border-hairline mt-5 border-t pt-4">
                    {response.question.explanation}
                  </p>
                </details>
              );
            })}
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/dashboard"
            className="bg-gate rounded-md px-5 py-2.5 font-semibold text-white"
          >
            Back to dashboard
          </Link>
          <Link
            href={`/c/${certSlug}/practice`}
            className="border-hairline bg-raise hover:border-graphite rounded-md border px-5 py-2.5 font-semibold"
          >
            Practice again
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
