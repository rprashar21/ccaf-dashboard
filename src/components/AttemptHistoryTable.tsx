import Link from "next/link";

type Attempt = {
  id: string;
  mode: "PRACTICE" | "TIMED_EXAM" | "DOMAIN_DRILL" | "FULL_SET" | "IMPORTED_SET" | "MOCK_EXAM";
  questionCount: number;
  correctCount: number | null;
  scaledScore: number | null;
  completedAt: Date | null;
};

export const MODE_LABEL: Record<Attempt["mode"], string> = {
  PRACTICE: "Practice",
  TIMED_EXAM: "Timed exam",
  DOMAIN_DRILL: "Domain drill",
  FULL_SET: "Full set",
  IMPORTED_SET: "Imported set",
  MOCK_EXAM: "Mock exam",
};

/**
 * Shared attempts table used by the dashboard and, per-certification, by the
 * profile page's cert cards — every row here already belongs to one cert, so
 * `certSlug` is a single value, not a per-row lookup. The table scrolls
 * inside its own container so the page body never scrolls horizontally on a
 * narrow screen.
 */
export function AttemptHistoryTable({
  attempts,
  certSlug,
}: {
  attempts: Attempt[];
  certSlug: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[26rem] text-sm">
        <thead>
          <tr className="border-hairline text-graphite border-b text-left">
            <th className="pb-2 font-normal">Date</th>
            <th className="pb-2 font-normal">Type</th>
            <th className="pb-2 font-normal">Questions</th>
            <th className="pb-2 font-normal">Accuracy</th>
            <th className="pb-2 text-right font-normal">Score</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt) => (
            <tr key={attempt.id} className="border-hairline/60 border-b last:border-0">
              <td className="py-3">
                <Link
                  href={`/c/${certSlug}/practice/${attempt.id}/results`}
                  className="hover:text-gate underline-offset-2 hover:underline"
                >
                  {attempt.completedAt?.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </Link>
              </td>
              <td className="py-3">{MODE_LABEL[attempt.mode]}</td>
              <td className="tabular py-3">{attempt.questionCount}</td>
              <td className="tabular py-3">
                {attempt.correctCount ?? 0}/{attempt.questionCount}
              </td>
              <td className="tabular py-3 text-right font-bold">{attempt.scaledScore ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
