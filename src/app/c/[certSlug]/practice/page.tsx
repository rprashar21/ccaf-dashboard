import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer, Nav } from "@/components/Nav";
import {
  getCertification,
  getImportedQuestionCount,
  getPublishedQuestionCount,
} from "@/server/queries/certifications";
import { StartPracticeButton } from "@/app/dashboard/_components/StartPracticeButton";

export const metadata: Metadata = { title: "Start practice" };

export default async function PracticeConfigPage({
  params,
}: {
  params: Promise<{ certSlug: string }>;
}) {
  const { certSlug } = await params;

  const certification = await getCertification(certSlug);
  if (!certification) notFound();

  const [questionCount, importedQuestionCount] = await Promise.all([
    getPublishedQuestionCount(certification.id),
    getImportedQuestionCount(certification.id),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Nav signedIn />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <span className="tick">{certification.code}</span>
        <h1 className="font-display mt-2 text-3xl">Start a practice run</h1>
        <p className="text-graphite mt-3">
          Questions are drawn across domains in the same proportions as the exam, favouring ones you
          have not seen and ones you previously missed.
        </p>

        <section className="border-hairline bg-raise mt-8 rounded-lg border p-6">
          <h2 className="tick mb-5">Mixed set</h2>
          <div className="flex flex-wrap gap-3">
            {[5, 10, 20].map((count, i) => (
              <StartPracticeButton
                key={count}
                certSlug={certSlug}
                questionCount={count}
                variant={i === 1 ? "primary" : "secondary"}
              >
                {count} questions
              </StartPracticeButton>
            ))}
          </div>
        </section>

        <section className="border-hairline bg-raise mt-6 rounded-lg border p-6">
          <h2 className="tick mb-5">Drill one domain</h2>
          <div className="space-y-3">
            {certification.domains.map((domain) => (
              <div
                key={domain.id}
                className="border-hairline flex flex-wrap items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-display text-sm">{domain.name}</p>
                  <p className="tick mt-1">{Math.round(domain.weight * 100)}% of exam</p>
                </div>
                <StartPracticeButton
                  certSlug={certSlug}
                  questionCount={10}
                  domainId={domain.id}
                  mode="DOMAIN_DRILL"
                  variant="secondary"
                >
                  Drill 10
                </StartPracticeButton>
              </div>
            ))}
          </div>
        </section>

        <section className="border-hairline bg-raise mt-6 rounded-lg border p-6">
          <h2 className="tick mb-5">Take a mock exam</h2>
          <p className="text-graphite mb-5 text-sm">
            A weighted sample drawn from the whole bank, with the same map to jump around, filters,
            and bookmarks as the full set — pick how many questions you want to attempt.
          </p>
          <div className="flex flex-wrap gap-3">
            {[20, 40, 60].map((count, i) => (
              <StartPracticeButton
                key={count}
                certSlug={certSlug}
                questionCount={count}
                mode="MOCK_EXAM"
                variant={i === 0 ? "primary" : "secondary"}
              >
                {count} questions
              </StartPracticeButton>
            ))}
          </div>
        </section>

        <section className="border-hairline bg-raise mt-6 rounded-lg border p-6">
          <h2 className="tick mb-5">Exam mode</h2>
          <p className="text-graphite mb-5 text-sm">
            The full simulation: {certification.examQuestionCount} questions in{" "}
            {certification.examDurationMinutes} minutes, weighted across domains like the real exam.
            The clock pauses when you do and picks up exactly where you left off.
          </p>
          <StartPracticeButton certSlug={certSlug} mode="TIMED_EXAM" variant="primary">
            Take the exam ({certification.examQuestionCount} questions ·{" "}
            {certification.examDurationMinutes} min)
          </StartPracticeButton>
        </section>

        <section className="border-hairline bg-raise mt-6 rounded-lg border p-6">
          <h2 className="tick mb-5">Full set</h2>
          <p className="text-graphite mb-5 text-sm">
            Every published question, once, with a map to jump around, filters for
            unanswered/correct/incorrect/bookmarked, and a bookmark on any question you want to come
            back to.
          </p>
          <StartPracticeButton certSlug={certSlug} bulkMode="FULL_SET" variant="secondary">
            Practice full set ({questionCount} questions)
          </StartPracticeButton>
        </section>

        {importedQuestionCount > 0 ? (
          <section className="border-hairline bg-raise mt-6 rounded-lg border p-6">
            <h2 className="tick mb-5">Imported set</h2>
            <p className="text-graphite mb-5 text-sm">
              Just the questions imported from the certyiq.com practice paper (the same set in{" "}
              <code>docs/cca-f-quiz-dashboard.html</code> and the companion PDF) — none of the
              hand-written questions in the rest of the bank.
            </p>
            <StartPracticeButton certSlug={certSlug} bulkMode="IMPORTED_SET" variant="secondary">
              Practice imported set ({importedQuestionCount} questions)
            </StartPracticeButton>
          </section>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
