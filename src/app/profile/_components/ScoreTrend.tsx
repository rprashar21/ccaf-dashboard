type TrendPoint = { completedAt: Date | null; scaledScore: number | null };

/**
 * A small server-rendered trend line over completed-attempt scores. No
 * charting library: the project has none installed, and a dozen or so points
 * doesn't warrant adding one. State is never colour-only — the same trend is
 * restated in words via aria-label, matching ReadinessRail's convention.
 */
export function ScoreTrend({
  history,
  passingScore,
  scaleMax,
}: {
  history: TrendPoint[];
  passingScore: number;
  scaleMax: number;
}) {
  const points = history
    .filter((h): h is { completedAt: Date; scaledScore: number } =>
      Boolean(h.completedAt && h.scaledScore !== null),
    )
    .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());

  if (points.length < 2) {
    return (
      <p className="text-graphite text-sm">
        {points.length === 0
          ? "No completed attempts yet."
          : "One attempt so far — trend needs two."}
      </p>
    );
  }

  const width = 240;
  const height = 56;
  const first = points[0]!.scaledScore;
  const last = points[points.length - 1]!.scaledScore;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - (p.scaledScore / scaleMax) * height;
    return `${x.toFixed(1)},${Math.max(0, Math.min(height, y)).toFixed(1)}`;
  });

  const passY = height - (passingScore / scaleMax) * height;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-14 w-full"
        role="img"
        aria-label={`Score trend: ${first} to ${last} over ${points.length} attempts.`}
      >
        <line
          x1={0}
          x2={width}
          y1={passY}
          y2={passY}
          className="stroke-hairline"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <polyline
          points={coords.join(" ")}
          fill="none"
          className={last >= passingScore ? "stroke-gate" : "stroke-under"}
          strokeWidth={2}
        />
      </svg>
      <p className="text-graphite mt-1 text-xs">
        {first} → {last} over {points.length} attempts
      </p>
    </div>
  );
}
