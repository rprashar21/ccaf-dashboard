// Tunables for the readiness score. Kept together so the algorithm can be
// re-calibrated without touching the maths, and so tests can override them.

export const READINESS_DEFAULTS = {
  /** Only responses this recent count toward the estimate. */
  windowDays: 90,
  /**
   * Beta-binomial shrinkage strength. A domain with `k` answered questions sits
   * halfway between the neutral prior and its observed accuracy.
   */
  shrinkage: 8,
  /** Neutral prior: with no evidence, a domain contributes an honest "unknown". */
  prior: 0.5,
  /** Answers per domain at which coverage for that domain reaches 1. */
  minSamplePerDomain: 15,
  /** Coverage below this is LOW; below the second value is MEDIUM. */
  coverageBands: { low: 0.34, medium: 0.67 },
} as const;

export type ReadinessOptions = {
  windowDays: number;
  shrinkage: number;
  prior: number;
  minSamplePerDomain: number;
  coverageBands: { low: number; medium: number };
};
