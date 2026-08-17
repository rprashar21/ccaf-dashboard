import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Footer, Nav } from "@/components/Nav";
import { getCertification, getPublishedQuestionCount } from "@/server/queries/certifications";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ certSlug: string }>;
}): Promise<Metadata> {
  const { certSlug } = await params;
  const certification = await getCertification(certSlug);
  if (!certification) return { title: "Not found" };

  return {
    title: certification.name,
    description: certification.description,
  };
}

/** Public and crawlable: "what is on this exam" is the top search intent. */
export default async function CertificationPage({
  params,
}: {
  params: Promise<{ certSlug: string }>;
}) {
  const { certSlug } = await params;
  const certification = await getCertification(certSlug);
  if (!certification) notFound();

  const [session, questionCount] = await Promise.all([
    auth(),
    getPublishedQuestionCount(certification.id),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Nav signedIn={Boolean(session?.user)} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <span className="tick">{certification.vendor}</span>
        <h1 className="font-display mt-2 text-3xl">{certification.name}</h1>
        <p className="text-graphite mt-4 max-w-2xl">{certification.description}</p>

        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
          {[
            { label: "questions on the exam", value: certification.examQuestionCount },
            { label: "minutes", value: certification.examDurationMinutes },
            {
              label: "to pass",
              value: `${certification.passingScore}/${certification.scoreScaleMax}`,
            },
            { label: "in this question bank", value: questionCount },
          ].map((stat) => (
            <div key={stat.label}>
              <dt className="tick">{stat.label}</dt>
              <dd className="tabular mt-1 text-xl font-bold">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <Link
          href={`/c/${certSlug}/practice`}
          className="bg-gate mt-8 inline-block rounded-md px-5 py-3 font-semibold text-white"
        >
          Start practice
        </Link>

        <section className="border-hairline mt-14 border-t pt-10">
          <h2 className="font-display text-2xl">Domains</h2>
          <div className="mt-8 space-y-8">
            {certification.domains.map((domain) => (
              <div key={domain.id}>
                <div className="flex items-baseline gap-4">
                  <span className="tabular text-lg font-bold">
                    {Math.round(domain.weight * 100)}%
                  </span>
                  <Link
                    href={`/c/${certSlug}/domains/${domain.slug}`}
                    className="font-display hover:text-gate text-lg"
                  >
                    {domain.name}
                  </Link>
                </div>
                <p className="text-graphite mt-2">{domain.description}</p>
                <ul className="text-graphite mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {domain.subtopics.map((subtopic) => (
                    <li key={subtopic.id}>{subtopic.name}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {certification.sourceNote ? (
          <p className="border-under bg-under-soft mt-10 rounded-md border-l-2 px-4 py-3 text-sm">
            {certification.sourceNote}
          </p>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
