import Link from "next/link";
import type { DomainReadiness } from "@/lib/scoring/readiness";

/**
 * One row per domain, heaviest first.
 *
 * A domain with no answers renders hatched and labelled rather than showing
 * 0% — an unmeasured domain and a domain you are failing are different things,
 * and conflating them would misrepresent the learner's position.
 */
export function DomainBars({
  domains,
  certSlug,
}: {
  domains: DomainReadiness[];
  certSlug: string;
}) {
  const ordered = [...domains].sort((a, b) => b.weight - a.weight);

  return (
    <div className="space-y-5">
      {ordered.map((domain) => {
        const measured = domain.answered > 0;
        const percent = measured ? Math.round((domain.observedAccuracy ?? 0) * 100) : 0;

        return (
          <div key={domain.domainId}>
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <Link
                href={`/c/${certSlug}/domains/${domain.slug}`}
                className="font-display hover:text-gate text-sm"
              >
                {domain.name}
              </Link>
              <div className="flex items-baseline gap-3">
                <span className="tabular text-graphite text-xs">
                  {Math.round(domain.weight * 100)}% of exam
                </span>
                <span className="tabular text-sm font-bold">{measured ? `${percent}%` : "—"}</span>
              </div>
            </div>

            <div className="bg-hairline/50 h-2 w-full overflow-hidden rounded-full">
              {measured ? (
                <div
                  className={`h-full rounded-full ${percent >= 72 ? "bg-gate" : "bg-under"}`}
                  style={{ width: `${percent}%` }}
                />
              ) : (
                <div className="hatched h-full w-full" />
              )}
            </div>

            <p className="text-graphite mt-1.5 text-xs">
              {measured
                ? `${domain.correct} of ${domain.answered} answered correctly`
                : "Not enough data — answer some questions in this domain"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
