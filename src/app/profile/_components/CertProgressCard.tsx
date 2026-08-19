import Link from "next/link";
import { AttemptHistoryTable } from "@/components/AttemptHistoryTable";
import { ReadinessRail } from "@/components/ReadinessRail";
import { weakestDomain } from "@/lib/scoring/readiness";
import type { CertProfileSummary } from "@/server/queries/profile";
import { CoverageBars } from "./CoverageBars";
import { ScoreTrend } from "./ScoreTrend";

export function CertProgressCard({ summary }: { summary: CertProfileSummary }) {
  const { certification, readiness, coverage, history } = summary;
  const weakest = weakestDomain(readiness);

  return (
    <section className="border-hairline bg-raise rounded-lg border p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <span className="tick">{certification.code}</span>
          <h2 className="font-display mt-1 text-xl">{certification.name}</h2>
        </div>
        <Link
          href={`/c/${certification.slug}`}
          className="text-gate text-sm font-semibold underline"
        >
          Open certification
        </Link>
      </div>

      <div className="mt-6">
        <ReadinessRail
          score={readiness.totalAnswered > 0 ? readiness.score : null}
          scaleMax={certification.scoreScaleMax}
          passingScore={certification.passingScore}
          provisional={readiness.confidence === "LOW"}
          label={`${readiness.totalAnswered} answered`}
          size="compact"
        />
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="tick mb-4">Bank coverage</h3>
          <CoverageBars coverage={coverage} certSlug={certification.slug} />
        </div>

        <div className="space-y-8">
          {weakest ? (
            <div>
              <h3 className="tick mb-2">Weakest domain</h3>
              <Link
                href={`/c/${certification.slug}/domains/${weakest.slug}`}
                className="font-display hover:text-gate text-base"
              >
                {weakest.name}
              </Link>
            </div>
          ) : null}

          <div>
            <h3 className="tick mb-3">Score trend</h3>
            <ScoreTrend
              history={history}
              passingScore={certification.passingScore}
              scaleMax={certification.scoreScaleMax}
            />
          </div>
        </div>
      </div>

      {history.length > 0 ? (
        <div className="mt-8">
          <h3 className="tick mb-4">Attempt history</h3>
          <AttemptHistoryTable attempts={history} certSlug={certification.slug} />
        </div>
      ) : null}
    </section>
  );
}
