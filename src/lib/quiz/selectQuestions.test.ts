import { describe, expect, it } from "vitest";
import { allocateByWeight, selectQuestions, type Candidate } from "./selectQuestions";

const DOMAINS = [
  { domainId: "agentic", weight: 0.27 },
  { domainId: "tools", weight: 0.25 },
  { domainId: "prompting", weight: 0.25 },
  { domainId: "claude-code", weight: 0.23 },
];

// Deterministic "shuffle" so selection order is assertable.
const identity = <T>(items: T[]) => items;

function bank(domainId: string, count: number, overrides: Partial<Candidate> = {}): Candidate[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${domainId}-${i}`,
    domainId,
    timesAnswered: 0,
    lastCorrect: null,
    lastAnsweredAt: null,
    ...overrides,
  }));
}

describe("allocateByWeight", () => {
  it("sums to exactly the requested total", () => {
    for (const total of [10, 20, 37, 60]) {
      const allocation = allocateByWeight(DOMAINS, total);
      const sum = [...allocation.values()].reduce((a, b) => a + b, 0);
      expect(sum).toBe(total);
    }
  });

  it("matches the exam blueprint at 60 questions", () => {
    const allocation = allocateByWeight(DOMAINS, 60);
    expect(allocation.get("agentic")).toBe(16); // 16.2
    expect(allocation.get("tools")).toBe(15);
    expect(allocation.get("prompting")).toBe(15);
    expect(allocation.get("claude-code")).toBe(14); // 13.8
  });

  it("distributes leftovers to the largest fractional parts", () => {
    // 10 * 0.27 = 2.7 and 10 * 0.23 = 2.3 — the .7 gets the spare seat first.
    const allocation = allocateByWeight(DOMAINS, 10);
    expect([...allocation.values()].reduce((a, b) => a + b, 0)).toBe(10);
    expect(allocation.get("agentic")).toBe(3);
    expect(allocation.get("claude-code")).toBe(2);
  });

  it("falls back to an even split when every weight is zero", () => {
    const allocation = allocateByWeight(
      DOMAINS.map((d) => ({ ...d, weight: 0 })),
      10,
    );
    expect([...allocation.values()].reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("returns nothing for a non-positive total", () => {
    expect(allocateByWeight(DOMAINS, 0).size).toBe(0);
  });
});

describe("selectQuestions", () => {
  it("returns exactly the requested count when supply allows", () => {
    const candidates = DOMAINS.flatMap((d) => bank(d.domainId, 20));
    const picked = selectQuestions({ candidates, domains: DOMAINS, count: 20, shuffle: identity });
    expect(picked).toHaveLength(20);
  });

  it("never repeats a question within one attempt", () => {
    const candidates = DOMAINS.flatMap((d) => bank(d.domainId, 20));
    const picked = selectQuestions({ candidates, domains: DOMAINS, count: 40, shuffle: identity });
    expect(new Set(picked.map((c) => c.id)).size).toBe(picked.length);
  });

  it("prefers unseen questions, then previously missed, then least recently seen", () => {
    const candidates: Candidate[] = [
      { id: "mastered", domainId: "a", timesAnswered: 3, lastCorrect: true, lastAnsweredAt: 500 },
      { id: "missed", domainId: "a", timesAnswered: 1, lastCorrect: false, lastAnsweredAt: 900 },
      { id: "unseen", domainId: "a", timesAnswered: 0, lastCorrect: null, lastAnsweredAt: null },
    ];

    const picked = selectQuestions({
      candidates,
      domains: [{ domainId: "a", weight: 1 }],
      count: 3,
      shuffle: identity,
    });

    expect(picked.map((c) => c.id)).toEqual(["unseen", "missed", "mastered"]);
  });

  it("orders mastered questions least-recently-seen first", () => {
    const candidates: Candidate[] = [
      { id: "recent", domainId: "a", timesAnswered: 1, lastCorrect: true, lastAnsweredAt: 900 },
      { id: "stale", domainId: "a", timesAnswered: 1, lastCorrect: true, lastAnsweredAt: 100 },
    ];

    const picked = selectQuestions({
      candidates,
      domains: [{ domainId: "a", weight: 1 }],
      count: 2,
      shuffle: identity,
    });

    expect(picked.map((c) => c.id)).toEqual(["stale", "recent"]);
  });

  it("redistributes the shortfall when a domain lacks enough questions", () => {
    // 'claude-code' has only one question; its remaining quota must be filled
    // from the other domains rather than shortening the attempt.
    const candidates = [
      ...bank("agentic", 20),
      ...bank("tools", 20),
      ...bank("prompting", 20),
      ...bank("claude-code", 1),
    ];

    const picked = selectQuestions({ candidates, domains: DOMAINS, count: 20, shuffle: identity });

    expect(picked).toHaveLength(20);
    expect(picked.filter((c) => c.domainId === "claude-code")).toHaveLength(1);
    expect(new Set(picked.map((c) => c.id)).size).toBe(20);
  });

  it("caps the attempt at the size of the bank", () => {
    const candidates = bank("agentic", 5);
    const picked = selectQuestions({
      candidates,
      domains: DOMAINS,
      count: 60,
      shuffle: identity,
    });
    expect(picked).toHaveLength(5);
  });

  it("returns nothing when there are no candidates", () => {
    expect(selectQuestions({ candidates: [], domains: DOMAINS, count: 10 })).toEqual([]);
  });
});
