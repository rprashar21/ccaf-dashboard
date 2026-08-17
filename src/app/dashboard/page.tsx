import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Footer, Nav } from "@/components/Nav";
import { ReadinessRail } from "@/components/ReadinessRail";
import { pointsToPass, weakestDomain } from "@/lib/scoring/readiness";
import { getDashboardData } from "@/server/queries/dashboard";
import { DomainBars } from "./_components/DomainBars";
import { StartPracticeButton } from "./_components/StartPracticeButton";

export const metadata: Metadata = { title: "Dashboard" };

const CERT_SLUG = "cca-f";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/dashboard");

  const data = await getDashboardData(session.user.id, CERT_SLUG);
  if (!data) redirect("/");

  const { certification, readiness, recentAttempts, streak, inProgress } = data;
  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const weakest = weakestDomain(readiness);
  const gap = pointsToPass(readiness);

  return (
    <div className="flex min-h-screen flex-col">
      <Nav signedIn />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="tick">{certification.code}</span>
            <h1 className="font-display mt-2 text-3xl">Welcome back, {firstName}</h1>
          </div>
          <StartPracticeButton certSlug={certification.slug} questionCount={10}>
            Start practice
          </StartPracticeButton>
        </div>

        {inProgress ? (
          <div className="border-gate bg-gate-soft mt-8 flex flex-wrap items-center justify-between gap-4 rounded-md border px-5 py-4">
            <p className="text-sm">
              You have an attempt in progress ({inProgress.questionCount} questions).
            </p>
            <Link
              href={`/c/${certification.slug}/practice/${inProgress.id}`}
              className="text-gate text-sm font-semibold underline"
            >
              Resume it
            </Link>
          </div>
        ) : null}

        {!data.hasCompletedAttempt ? (
          /* Never show a 500/1000 rail to someone who has answered nothing — it
             reads as a failing grade rather than an absence of data. */
          <section className="border-hairline bg-raise mt-10 rounded-lg border p-8">
            <span className="tick">First run</span>
            <h2 className="font-display mt-3 text-2xl">Establish a baseline</h2>
            <p className="text-graphite mt-3 max-w-xl">
              Ten questions, drawn across all {readiness.domains.length} domains in the same
              proportions as the exam. That is enough to put a first number on the board.
            </p>
            <div className="mt-6">
              <StartPracticeButton certSlug={certification.slug} questionCount={10}>
                Take your first 10 questions
              </StartPracticeButton>
            </div>

            <div className="border-hairline mt-10 border-t pt-8">
              <h3 className="tick mb-5">What gets measured</h3>
              <DomainBars domains={readiness.domains} certSlug={certification.slug} />
            </div>
          </section>
        ) : (
          <>
            {/* The same rail as the hero, now filled. Reusing the instrument is
                what makes this feel like the promise kept. */}
            <section className="border-hairline bg-raise mt-10 rounded-lg border p-8">
              <div className="mb-8 flex flex-wrap items-center gap-3">
                <span className="tick">Estimated score</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    readiness.confidence === "LOW"
                      ? "bg-under-soft text-under"
                      : "bg-gate-soft text-gate"
                  }`}
                >
                  {readiness.confidence === "LOW"
                    ? "Provisional estimate"
                    : `${readiness.confidence === "GOOD" ? "Good" : "Moderate"} confidence`}
                </span>
              </div>

              <ReadinessRail
                score={readiness.score}
                scaleMax={certification.scoreScaleMax}
                passingScore={certification.passingScore}
                provisional={readiness.confidence === "LOW"}
                label={`${readiness.totalAnswered} answered`}
              />

              <p className="mt-6 text-lg">
                {readiness.passed === null
                  ? `Answer ${readiness.answersNeeded} more question${readiness.answersNeeded === 1 ? "" : "s"} for an estimate worth acting on.`
                  : readiness.passed
                    ? `You are ${Math.abs(gap)} point${Math.abs(gap) === 1 ? "" : "s"} above the ${certification.passingScore} line.`
                    : `You are ${gap} point${gap === 1 ? "" : "s"} short of the ${certification.passingScore} line.`}
              </p>

              {certification.sourceNote ? (
                <p className="text-graphite mt-4 text-sm">
                  This is an estimate from questions in this app, not an official score.{" "}
                  {certification.sourceNote}
                </p>
              ) : null}
            </section>

            <div className="mt-8 grid gap-8 md:grid-cols-[1fr_16rem]">
              <section className="border-hairline bg-raise rounded-lg border p-6">
                <h2 className="tick mb-6">By domain</h2>
                <DomainBars domains={readiness.domains} certSlug={certification.slug} />
              </section>

              <div className="space-y-8">
                <section className="border-gate bg-gate-soft rounded-lg border p-6">
                  <h2 className="tick mb-3">Do this next</h2>
                  {weakest ? (
                    <>
                      <p className="font-display text-base">{weakest.name}</p>
                      <p className="text-graphite mt-2 text-sm">
                        The most score you can recover per question answered.
                      </p>
                      <div className="mt-4">
                        <StartPracticeButton
                          certSlug={certification.slug}
                          questionCount={10}
                          domainId={weakest.domainId}
                          mode="DOMAIN_DRILL"
                        >
                          Drill this domain
                        </StartPracticeButton>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">
                        Not enough spread yet to name a weak spot. Take a 20-question mixed set to
                        establish a baseline.
                      </p>
                      <div className="mt-4">
                        <StartPracticeButton certSlug={certification.slug} questionCount={20}>
                          Take 20 questions
                        </StartPracticeButton>
                      </div>
                    </>
                  )}
                </section>

                {streak.current > 0 ? (
                  <section className="border-hairline bg-raise rounded-lg border p-6">
                    <h2 className="tick mb-3">Streak</h2>
                    <p className="tabular text-3xl font-bold">{streak.current}</p>
                    <p className="text-graphite mt-1 text-sm">
                      day{streak.current === 1 ? "" : "s"} running · longest {streak.longest}
                    </p>
                  </section>
                ) : null}
              </div>
            </div>

            <section className="border-hairline bg-raise mt-8 rounded-lg border p-6">
              <h2 className="tick mb-5">Recent attempts</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-hairline text-graphite border-b text-left">
                    <th className="pb-2 font-normal">Date</th>
                    <th className="pb-2 font-normal">Questions</th>
                    <th className="pb-2 font-normal">Accuracy</th>
                    <th className="pb-2 text-right font-normal">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAttempts.map((attempt) => (
                    <tr key={attempt.id} className="border-hairline/60 border-b last:border-0">
                      <td className="py-3">
                        <Link
                          href={`/c/${certification.slug}/practice/${attempt.id}/results`}
                          className="hover:text-gate underline-offset-2 hover:underline"
                        >
                          {attempt.completedAt?.toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        </Link>
                      </td>
                      <td className="tabular py-3">{attempt.questionCount}</td>
                      <td className="tabular py-3">
                        {attempt.correctCount ?? 0}/{attempt.questionCount}
                      </td>
                      <td className="tabular py-3 text-right font-bold">
                        {attempt.scaledScore ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
