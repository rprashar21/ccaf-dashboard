import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Footer, Nav } from "@/components/Nav";
import { getCertification } from "@/server/queries/certifications";
import { StartPracticeButton } from "@/app/dashboard/_components/StartPracticeButton";

export const metadata: Metadata = { title: "Start practice" };

export default async function PracticeConfigPage({
  params,
}: {
  params: Promise<{ certSlug: string }>;
}) {
  const { certSlug } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/c/${certSlug}/practice`);

  const certification = await getCertification(certSlug);
  if (!certification) notFound();

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
      </main>

      <Footer />
    </div>
  );
}
