import { describe, expect, it } from "vitest";
import { calculateReadiness, pointsToPass, weakestDomain, type DomainTally } from "./readiness";

// The four CCA-F domains at their seeded weights.
const WEIGHTS = [0.27, 0.25, 0.25, 0.23];

function tallies(rows: Array<{ answered: number; correct: number }>): DomainTally[] {
  return rows.map((row, i) => ({
    domainId: `d${i}`,
    slug: `domain-${i}`,
    name: `Domain ${i}`,
    weight: WEIGHTS[i] ?? 0.25,
    answered: row.answered,
    correct: row.correct,
  }));
}

const EXAM = { passingScore: 720, scoreScaleMax: 1000 };

describe("calculateReadiness", () => {
  it("returns the neutral prior at LOW confidence when nothing is answered", () => {
    const result = calculateReadiness({
      domains: tallies([
        { answered: 0, correct: 0 },
        { answered: 0, correct: 0 },
        { answered: 0, correct: 0 },
        { answered: 0, correct: 0 },
      ]),
      ...EXAM,
    });

    expect(result.score).toBe(500);
    expect(result.confidence).toBe("LOW");
    expect(result.coverage).toBe(0);
    expect(result.totalAnswered).toBe(0);
    // No verdict on zero evidence.
    expect(result.passed).toBeNull();
    expect(result.answersNeeded).toBe(60);
  });

  it("does not let one perfect domain carry the whole score", () => {
    // Perfect in the 27% domain, nothing anywhere else.
    const result = calculateReadiness({
      domains: tallies([
        { answered: 20, correct: 20 },
        { answered: 0, correct: 0 },
        { answered: 0, correct: 0 },
        { answered: 0, correct: 0 },
      ]),
      ...EXAM,
    });

    // 0.27*((20+4)/28) + 0.73*0.5 = 0.5964...
    expect(result.score).toBe(596);
    expect(result.score).toBeLessThan(EXAM.passingScore);
    expect(result.domains[0]?.observedAccuracy).toBe(1);
  });

  it("normalizes weights that do not sum to 1", () => {
    const domains: DomainTally[] = [
      { domainId: "a", slug: "a", name: "A", weight: 2, answered: 10, correct: 10 },
      { domainId: "b", slug: "b", name: "B", weight: 2, answered: 10, correct: 0 },
    ];

    const result = calculateReadiness({ domains, ...EXAM });

    // Equal weights, one perfect and one empty, shrunk symmetrically → 500.
    expect(result.score).toBe(500);
  });

  it("lets shrinkage dominate a single answer", () => {
    const result = calculateReadiness({
      domains: [{ domainId: "a", slug: "a", name: "A", weight: 1, answered: 1, correct: 1 }],
      ...EXAM,
    });

    // (1 + 8*0.5) / (1 + 8) = 0.5555... — one right answer is not mastery.
    expect(result.score).toBe(556);
    expect(result.domains[0]?.observedAccuracy).toBe(1);
    expect(result.domains[0]?.shrunkAccuracy).toBeCloseTo(5 / 9, 10);
  });

  it("treats exactly the passing score as a pass", () => {
    // No shrinkage: this stands in for a completed exam scored on its own.
    const result = calculateReadiness({
      domains: [{ domainId: "a", slug: "a", name: "A", weight: 1, answered: 100, correct: 72 }],
      ...EXAM,
      options: { shrinkage: 0 },
    });

    expect(result.score).toBe(720);
    expect(result.passed).toBe(true);
    expect(pointsToPass(result)).toBe(0);
  });

  it("fails one point below the line", () => {
    const result = calculateReadiness({
      domains: [{ domainId: "a", slug: "a", name: "A", weight: 1, answered: 1000, correct: 719 }],
      ...EXAM,
      options: { shrinkage: 0 },
    });

    expect(result.score).toBe(719);
    expect(result.passed).toBe(false);
    expect(pointsToPass(result)).toBe(1);
  });

  it("withholds a verdict at LOW confidence even when the score clears the line", () => {
    // Three right answers in one domain is not grounds for "you'd pass".
    const result = calculateReadiness({
      domains: [{ domainId: "a", slug: "a", name: "A", weight: 1, answered: 3, correct: 3 }],
      ...EXAM,
      options: { shrinkage: 0 },
    });

    expect(result.score).toBe(1000);
    expect(result.confidence).toBe("LOW");
    expect(result.passed).toBeNull();
  });

  it("raises confidence as coverage accumulates", () => {
    const at = (answered: number) =>
      calculateReadiness({
        domains: tallies([
          { answered, correct: answered },
          { answered, correct: answered },
          { answered, correct: answered },
          { answered, correct: answered },
        ]),
        ...EXAM,
      });

    expect(at(2).confidence).toBe("LOW");
    expect(at(8).confidence).toBe("MEDIUM");
    expect(at(15).confidence).toBe("GOOD");
    expect(at(15).coverage).toBeCloseTo(1, 10);
    expect(at(15).answersNeeded).toBe(0);
  });

  it("reports observed accuracy separately from the shrunk value", () => {
    const result = calculateReadiness({
      domains: [{ domainId: "a", slug: "a", name: "A", weight: 1, answered: 4, correct: 3 }],
      ...EXAM,
    });

    expect(result.domains[0]?.observedAccuracy).toBe(0.75);
    expect(result.domains[0]?.shrunkAccuracy).toBeCloseTo(7 / 12, 10);
  });

  it("survives an empty domain list", () => {
    const result = calculateReadiness({ domains: [], ...EXAM });

    expect(result.score).toBe(500);
    expect(result.coverage).toBe(0);
    expect(result.confidence).toBe("LOW");
    expect(result.passed).toBeNull();
  });
});

describe("weakestDomain", () => {
  it("picks the biggest weighted shortfall, not the lowest accuracy", () => {
    const result = calculateReadiness({
      domains: [
        // Lower accuracy, but only 5% of the exam.
        { domainId: "small", slug: "small", name: "Small", weight: 0.05, answered: 20, correct: 2 },
        // Higher accuracy, but 95% of the exam — far more points on the table.
        { domainId: "big", slug: "big", name: "Big", weight: 0.95, answered: 20, correct: 12 },
      ],
      ...EXAM,
    });

    expect(weakestDomain(result)?.domainId).toBe("big");
  });

  it("returns null until some domain has enough answers to act on", () => {
    const result = calculateReadiness({
      domains: tallies([
        { answered: 2, correct: 1 },
        { answered: 1, correct: 0 },
        { answered: 0, correct: 0 },
        { answered: 0, correct: 0 },
      ]),
      ...EXAM,
    });

    expect(weakestDomain(result)).toBeNull();
  });
});
