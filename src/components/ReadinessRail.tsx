type ReadinessRailProps = {
  /** Current score, or null for the empty "no data yet" state. */
  score: number | null;
  scaleMax: number;
  passingScore: number;
  /** Muted rendering for a provisional estimate. */
  provisional?: boolean;
  label?: string;
  size?: "hero" | "compact";
};

/**
 * The page's signature element: a 0–scaleMax rail with a hard tick at the pass
 * mark. It renders empty in the marketing hero and filled on the dashboard —
 * reusing the same instrument is what makes the dashboard feel like the promise
 * kept, and it is the only place motion is spent.
 *
 * Colour never carries the state alone: the gate is a labelled tick and the
 * status is also stated in text.
 */
export function ReadinessRail({
  score,
  scaleMax,
  passingScore,
  provisional = false,
  label,
  size = "hero",
}: ReadinessRailProps) {
  const gatePercent = (passingScore / scaleMax) * 100;
  const filled = score === null ? 0 : Math.max(0, Math.min(100, (score / scaleMax) * 100));
  const cleared = score !== null && score >= passingScore;

  const fillColor = cleared ? "bg-gate" : "bg-under";
  const trackHeight = size === "hero" ? "h-3" : "h-2.5";

  return (
    <div className="w-full">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          {score === null ? (
            // Empty state: a word, not a dash. A grey bar next to "/ 1000" reads
            // as a broken element rather than an invitation.
            <span
              className={`font-display text-graphite ${size === "hero" ? "text-3xl" : "text-2xl"}`}
            >
              Not measured
            </span>
          ) : (
            <>
              <span
                className={`tabular font-bold ${size === "hero" ? "text-5xl" : "text-4xl"} ${
                  provisional ? "text-graphite" : "text-ink"
                }`}
              >
                {score}
              </span>
              <span className="tabular text-graphite text-sm">/ {scaleMax}</span>
            </>
          )}
        </div>
        {label ? <span className="tick">{label}</span> : null}
      </div>

      <div
        className={`relative w-full ${trackHeight} bg-hairline/60 rounded-full`}
        role="img"
        aria-label={
          score === null
            ? `Readiness meter, no data yet. Pass mark is ${passingScore} out of ${scaleMax}.`
            : `Estimated score ${score} out of ${scaleMax}. Pass mark is ${passingScore}.`
        }
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out ${fillColor} ${
            provisional ? "opacity-45" : ""
          }`}
          style={{ width: `${filled}%` }}
        />

        {/* The gate. A labelled tick, so pass/fail is never colour-only. */}
        <div
          className="bg-ink absolute -top-1.5 -bottom-1.5 w-0.5"
          style={{ left: `${gatePercent}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="relative mt-2 h-4">
        <span className="tick absolute left-0">0</span>
        <span
          className="tick text-ink absolute -translate-x-1/2 font-semibold"
          style={{ left: `${gatePercent}%` }}
        >
          {passingScore} pass
        </span>
        <span className="tick absolute right-0">{scaleMax}</span>
      </div>
    </div>
  );
}
