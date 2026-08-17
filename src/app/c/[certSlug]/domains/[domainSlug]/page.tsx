import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Footer, Nav } from "@/components/Nav";
import { getCertification } from "@/server/queries/certifications";
import { StartPracticeButton } from "@/app/dashboard/_components/StartPracticeButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ certSlug: string; domainSlug: string }>;
}): Promise<Metadata> {
  const { certSlug, domainSlug } = await params;
  const certification = await getCertification(certSlug);
  const domain = certification?.domains.find((d) => d.slug === domainSlug);
  return domain ? { title: domain.name, description: domain.description } : { title: "Not found" };
}

export default async function DomainPage({
  params,
}: {
  params: Promise<{ certSlug: string; domainSlug: string }>;
}) {
  const { certSlug, domainSlug } = await params;

  const certification = await getCertification(certSlug);
  const domain = certification?.domains.find((d) => d.slug === domainSlug);
  if (!certification || !domain) notFound();

  const questionCount = await db.question.count({
    where: { domainId: domain.id, status: "PUBLISHED" },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Nav signedIn />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <Link href={`/c/${certSlug}`} className="tick hover:text-ink">
          ← {certification.code}
        </Link>

        <div className="mt-4 flex items-baseline gap-4">
          <span className="tabular text-2xl font-bold">{Math.round(domain.weight * 100)}%</span>
          <h1 className="font-display text-3xl">{domain.name}</h1>
        </div>

        <p className="text-graphite mt-4">{domain.description}</p>

        <p className="text-graphite mt-6 text-sm">
          <span className="tabular font-bold">{questionCount}</span> question
          {questionCount === 1 ? "" : "s"} in this domain.
        </p>

        {questionCount > 0 ? (
          <div className="mt-6">
            <StartPracticeButton
              certSlug={certSlug}
              questionCount={Math.min(10, questionCount)}
              domainId={domain.id}
              mode="DOMAIN_DRILL"
            >
              Drill this domain
            </StartPracticeButton>
          </div>
        ) : null}

        <section className="border-hairline mt-12 border-t pt-8">
          <h2 className="tick mb-5">Subtopics</h2>
          <ul className="space-y-2">
            {domain.subtopics.map((subtopic) => (
              <li key={subtopic.id} className="border-hairline/60 border-b pb-2 last:border-0">
                {subtopic.name}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <Footer />
    </div>
  );
}
