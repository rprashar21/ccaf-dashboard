import Link from "next/link";
import type { CertificationCoverage } from "@/server/queries/profile";

/**
 * Lifetime bank coverage per domain — how much of the question bank this
 * user has ever seen, not their current accuracy. A separate visual language
 * from DomainBars (no pass/fail colour) since "seen" and "correct" are
 * different claims and conflating them would misstate the learner's position.
 */
export function CoverageBars({
  coverage,
  certSlug,
}: {
  coverage: CertificationCoverage[];
  certSlug: string;
}) {
  const ordered = [...coverage].sort((a, b) => b.questionsInBank - a.questionsInBank);

  return (
    <div className="space-y-5">
      {ordered.map((domain) => {
        const percent =
          domain.questionsInBank > 0
            ? Math.round((domain.questionsSeen / domain.questionsInBank) * 100)
            : 0;
        const accuracy =
          domain.lifetimeAnswered > 0
            ? Math.round((domain.lifetimeCorrect / domain.lifetimeAnswered) * 100)
            : null;

        return (
          <div key={domain.domainId}>
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <Link
                href={`/c/${certSlug}/domains/${domain.slug}`}
                className="font-display hover:text-gate text-sm"
              >
                {domain.name}
              </Link>
              <span className="tabular text-graphite text-xs">
                {domain.questionsSeen} of {domain.questionsInBank} seen
              </span>
            </div>

            <div className="bg-hairline/50 h-2 w-full overflow-hidden rounded-full">
              <div className="bg-gate/70 h-full rounded-full" style={{ width: `${percent}%` }} />
            </div>

            <p className="text-graphite mt-1.5 text-xs">
              {accuracy === null
                ? "Not answered yet"
                : `${accuracy}% correct lifetime (${domain.lifetimeCorrect} of ${domain.lifetimeAnswered})`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
