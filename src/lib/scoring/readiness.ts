import { READINESS_DEFAULTS, type ReadinessOptions } from "./constants";

// Pure. No database access, no Prisma types — the caller aggregates responses
// into DomainTally rows and passes the exam facts in from the certification row.

export type DomainTally = {
  domainId: string;
  slug: string;
  name: string;
  /** Domain weight as a fraction. Not assumed to sum to 1 across domains. */
  weight: number;
  answered: number;
  correct: number;
};

export type ConfidenceBand = "LOW" | "MEDIUM" | "GOOD";

export type DomainReadiness = {
  domainId: string;
  slug: string;
  name: string;
  weight: number;
  answered: number;
  correct: number;
  /** Observed accuracy, or null when nothing has been answered. This is what the UI shows. */
  observedAccuracy: number | null;
  /** Shrunk accuracy actually used in the score. A scoring internal — do not display. */
  shrunkAccuracy: number;
  /** How close this domain is to a reliable sample, 0 to 1. */
  coverage: number;
};

export type ReadinessResult = {
  /** Estimated score on the certification's own scale. */
  score: number;
  scoreScaleMax: number;
  passingScore: number;
  /** Null below MEDIUM confidence: we do not assert pass/fail on thin evidence. */
  passed: boolean | null;
  confidence: ConfidenceBand;
  coverage: number;
  totalAnswered: number;
  /** Additional answers needed to reach a reliable estimate; 0 once covered. */
  answersNeeded: number;
  domains: DomainReadiness[];
};

export type ReadinessInput = {
  domains: DomainTally[];
  passingScore: number;
  scoreScaleMax: number;
  options?: Partial<ReadinessOptions>;
};

export function calculateReadiness({
  domains,
  passingScore,
  scoreScaleMax,
  options,
}: ReadinessInput): ReadinessResult {
  const opts: ReadinessOptions = { ...READINESS_DEFAULTS, ...options };

  const totalWeight = domains.reduce((sum, d) => sum + d.weight, 0);

  const scored: DomainReadiness[] = domains.map((d) => ({
    domainId: d.domainId,
    slug: d.slug,
    name: d.name,
    weight: d.weight,
    answered: d.answered,
    correct: d.correct,
    observedAccuracy: d.answered > 0 ? d.correct / d.answered : null,
    // Beta-binomial shrinkage toward a neutral prior. Replaces a hard minimum
    // sample cutoff: influence of the prior decays smoothly as evidence arrives,
    // so there is no cliff between n=7 and n=8.
    shrunkAccuracy: (d.correct + opts.shrinkage * opts.prior) / (d.answered + opts.shrinkage),
    coverage: Math.min(1, d.answered / opts.minSamplePerDomain),
  }));

  // With no domains at all there is nothing to weight; report the neutral prior
  // rather than dividing by zero.
  const weighted = (pick: (d: DomainReadiness) => number) =>
    totalWeight > 0
      ? scored.reduce((sum, d) => sum + (d.weight / totalWeight) * pick(d), 0)
      : opts.prior;

  const score = Math.round(scoreScaleMax * weighted((d) => d.shrunkAccuracy));
  const coverage = totalWeight > 0 ? weighted((d) => d.coverage) : 0;

  const confidence: ConfidenceBand =
    coverage < opts.coverageBands.low
      ? "LOW"
      : coverage < opts.coverageBands.medium
        ? "MEDIUM"
        : "GOOD";

  const answersNeeded = scored.reduce(
    (sum, d) => sum + Math.max(0, opts.minSamplePerDomain - d.answered),
    0,
  );

  return {
    score,
    scoreScaleMax,
    passingScore,
    // A pass/fail verdict on a provisional estimate would be actively misleading.
    passed: confidence === "LOW" ? null : score >= passingScore,
    confidence,
    coverage,
    totalAnswered: scored.reduce((sum, d) => sum + d.answered, 0),
    answersNeeded,
    domains: scored,
  };
}

/** Distance to the pass line, in points. Negative once the line is cleared. */
export function pointsToPass(result: ReadinessResult): number {
  return result.passingScore - result.score;
}

/**
 * The domain where improvement buys the most score: highest weighted shortfall,
 * not merely the lowest accuracy. Returns null until at least one domain has
 * enough answers to be worth acting on.
 */
export function weakestDomain(result: ReadinessResult, minAnswered = 5): DomainReadiness | null {
  const eligible = result.domains.filter((d) => d.answered >= minAnswered);
  if (eligible.length === 0) return null;

  return eligible.reduce((worst, d) => {
    const recoverable = d.weight * (1 - d.shrunkAccuracy);
    const worstRecoverable = worst.weight * (1 - worst.shrunkAccuracy);
    return recoverable > worstRecoverable ? d : worst;
  });
}
