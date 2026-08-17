import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Footer, Nav } from "@/components/Nav";
import { ReadinessRail } from "@/components/ReadinessRail";
import { SampleQuestion } from "./(marketing)/_components/SampleQuestion";
import {
  getCertification,
  getPublishedQuestionCount,
  getSampleQuestion,
} from "@/server/queries/certifications";

const CERT_SLUG = "cca-f";

/** Section marker in the left gutter — the hero rail's tick vocabulary, reused. */
function Section({ tick, id, children }: { tick: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="border-hairline border-t py-14">
      <div className="grid gap-8 md:grid-cols-[7rem_1fr]">
        <span className="tick pt-1">{tick}</span>
        <div>{children}</div>
      </div>
    </section>
  );
}

export default async function LandingPage() {
  const session = await auth();
  // Done here rather than in the proxy: a JWT decode in the proxy would run on
  // every anonymous hit and defeat caching of this page.
  if (session?.user) redirect("/dashboard");

  const certification = await getCertification(CERT_SLUG);
  if (!certification) {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav />
        <main className="mx-auto max-w-5xl flex-1 px-6 py-24">
          <h1 className="font-display text-2xl">No certification is published yet.</h1>
          <p className="text-graphite mt-3">Run the database seed to load CCA-F.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const [questionCount, sample] = await Promise.all([
    getPublishedQuestionCount(certification.id),
    getSampleQuestion(certification.id),
  ]);

  const stats = [
    { value: String(questionCount), label: "questions available" },
    { value: String(certification.domains.length), label: "exam domains" },
    {
      value: `${certification.examQuestionCount} in ${certification.examDurationMinutes}m`,
      label: "real exam format",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6">
        {/* Hero: the instrument itself, empty. */}
        <section className="py-16 md:py-24">
          <div className="grid gap-10 md:grid-cols-[7rem_1fr]">
            <span className="tick pt-2">Readiness</span>
            <div>
              <h1 className="font-display text-4xl leading-tight sm:text-5xl">
                You either clear {certification.passingScore}, or you don&rsquo;t.
              </h1>
              <p className="text-graphite mt-5 max-w-xl text-lg">
                Practice for the {certification.name} exam and watch one number move. A PDF cannot
                tell you whether you are ready. This can.
              </p>

              <div className="mt-10 max-w-2xl">
                <ReadinessRail
                  score={null}
                  scaleMax={certification.scoreScaleMax}
                  passingScore={certification.passingScore}
                  label="No data yet"
                />
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <a
                  href="#sample"
                  className="bg-gate hover:bg-gate/90 rounded-md px-5 py-3 font-semibold text-white"
                >
                  Answer one question
                </a>
                <Link
                  href="/signin"
                  className="border-hairline bg-raise hover:border-graphite rounded-md border px-5 py-3 font-semibold"
                >
                  Sign in with GitHub
                </Link>
              </div>

              <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="tick">{stat.label}</dt>
                    <dd className="tabular text-ink mt-1 text-xl font-bold">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Prove it before asking for anything. */}
        <section id="sample" className="border-hairline border-t py-14">
          <div className="grid gap-8 md:grid-cols-[7rem_1fr]">
            <span className="tick pt-1">Try it</span>
            <div>
              {sample ? (
                <SampleQuestion
                  questionId={sample.id}
                  stem={sample.stem}
                  domainName={sample.domainName}
                  options={sample.options}
                  scaleMax={certification.scoreScaleMax}
                  passingScore={certification.passingScore}
                  examQuestionCount={certification.examQuestionCount}
                />
              ) : (
                <p className="text-graphite">No published questions yet.</p>
              )}
            </div>
          </div>
        </section>

        <Section tick="What you get">
          <h2 className="font-display text-2xl">Three things, all of them shipping today</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              {
                title: "Practice by domain",
                body: "Draw a mixed set weighted like the real exam, or drill a single domain until it stops being your weak spot.",
              },
              {
                title: "An estimated score",
                body: `A weighted estimate on the same ${certification.scoreScaleMax}-point scale as the exam, with the ${certification.passingScore} line marked.`,
              },
              {
                title: "Every answer explained",
                body: "Each question carries a written explanation. Getting it right without knowing why is not preparation.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="font-display text-base">{item.title}</h3>
                <p className="text-graphite mt-2 text-sm">{item.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section tick="The exam" id="domains">
          <h2 className="font-display text-2xl">What is actually on it</h2>
          <p className="text-graphite mt-3 max-w-2xl">
            Four domains, weighted. The weighting is why a perfect score in your favourite domain
            does not move your estimate very far.
          </p>

          <div
            className="border-hairline mt-8 flex h-3 w-full overflow-hidden rounded-full border"
            role="img"
            aria-label="Relative weight of each exam domain"
          >
            {certification.domains.map((domain, i) => (
              <div
                key={domain.id}
                style={{ width: `${domain.weight * 100}%` }}
                className={i % 2 === 0 ? "bg-gate" : "bg-gate/55"}
              />
            ))}
          </div>

          <dl className="mt-8 space-y-6">
            {certification.domains.map((domain) => (
              <div key={domain.id} className="grid gap-2 sm:grid-cols-[4rem_1fr]">
                <dt className="tabular text-ink text-lg font-bold">
                  {Math.round(domain.weight * 100)}%
                </dt>
                <dd>
                  <p className="font-display text-base">{domain.name}</p>
                  <p className="text-graphite mt-1 text-sm">
                    {domain.subtopics
                      .slice(0, 3)
                      .map((s) => s.name)
                      .join(" · ")}
                  </p>
                </dd>
              </div>
            ))}
          </dl>

          {certification.sourceNote ? (
            <p className="border-under bg-under-soft mt-8 rounded-md border-l-2 px-4 py-3 text-sm">
              {certification.sourceNote}
            </p>
          ) : null}
        </Section>

        <Section tick="How it works" id="how-it-works">
          <h2 className="font-display text-2xl">Three steps, no password</h2>
          <ol className="mt-8 space-y-5">
            {[
              "Sign in with GitHub or Google. No password to forget, no card to enter.",
              "Answer questions, mixed across domains or drilled one domain at a time.",
              "Watch your estimated score, and see which domain is costing you the most points.",
            ].map((step, i) => (
              <li key={step} className="grid gap-4 sm:grid-cols-[2rem_1fr]">
                <span className="tabular text-graphite font-bold">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section tick="Standing">
          <p className="text-lg">
            Built in the open, and honest about what it does not know yet. There are no testimonials
            here because there is no cohort to quote.
          </p>
        </Section>

        <Section tick="Questions">
          <h2 className="font-display text-2xl">Before you ask</h2>
          <dl className="mt-8 space-y-7">
            {[
              {
                q: "Is this official?",
                a: "No. It is an independent study tool, not affiliated with or endorsed by Anthropic.",
              },
              {
                q: "How is the estimated score calculated?",
                a: `Accuracy per domain, weighted by each domain's share of the exam, scaled to ${certification.scoreScaleMax}. Domains with few answers are pulled toward the middle, so three lucky answers cannot manufacture a passing estimate. Below a reliable sample size we show the number as provisional and withhold any pass or fail verdict.`,
              },
              {
                q: "Is it free?",
                a: "Yes. There are no paid tiers.",
              },
              {
                q: "Where do the questions come from?",
                a: "They are written by hand against the published domain outline, each with an explanation.",
              },
              {
                q: "Can I request another certification?",
                a: "The data model is built for more than one, so yes eventually. Only CCA-F is loaded today.",
              },
            ].map((item) => (
              <div key={item.q}>
                <dt className="font-display text-base">{item.q}</dt>
                <dd className="text-graphite mt-2">{item.a}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section tick="Start">
          <h2 className="font-display text-2xl">Move the number off zero</h2>
          <Link
            href="/signin"
            className="bg-gate hover:bg-gate/90 mt-6 inline-block rounded-md px-6 py-3 font-semibold text-white"
          >
            Sign in
          </Link>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
