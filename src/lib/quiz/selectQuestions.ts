// Choosing which questions go into an attempt. Pure, so the allocation maths and
// the tiering rules are testable without a database.

export type Candidate = {
  id: string;
  domainId: string;
  /** Times the learner has answered this question. 0 = never seen. */
  timesAnswered: number;
  /** Whether the most recent answer was correct. Null if never answered. */
  lastCorrect: boolean | null;
  /** Epoch ms of the most recent answer. Null if never answered. */
  lastAnsweredAt: number | null;
};

export type DomainAllocation = { domainId: string; weight: number };

/**
 * Split `total` across domains in proportion to weight, using largest-remainder
 * so the parts sum to exactly `total` rather than drifting with rounding.
 */
export function allocateByWeight(domains: DomainAllocation[], total: number): Map<string, number> {
  const allocation = new Map<string, number>();
  if (domains.length === 0 || total <= 0) return allocation;

  const totalWeight = domains.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight <= 0) {
    // Degenerate weights: fall back to an even split rather than dividing by zero.
    const base = Math.floor(total / domains.length);
    domains.forEach((d, i) =>
      allocation.set(d.domainId, base + (i < total % domains.length ? 1 : 0)),
    );
    return allocation;
  }

  const exact = domains.map((d) => ({
    domainId: d.domainId,
    want: (d.weight / totalWeight) * total,
  }));

  let assigned = 0;
  for (const item of exact) {
    const floor = Math.floor(item.want);
    allocation.set(item.domainId, floor);
    assigned += floor;
  }

  // Hand out the remaining seats to the largest fractional parts.
  const byRemainder = [...exact].sort(
    (a, b) => b.want - Math.floor(b.want) - (a.want - Math.floor(a.want)),
  );
  for (let i = 0; assigned < total && i < byRemainder.length; i++, assigned++) {
    const target = byRemainder[i]!;
    allocation.set(target.domainId, (allocation.get(target.domainId) ?? 0) + 1);
  }

  return allocation;
}

/**
 * Rank within a domain: never-answered first, then previously-missed, then
 * least-recently-seen. Lower rank is picked first.
 */
function tier(candidate: Candidate): number {
  if (candidate.timesAnswered === 0) return 0;
  if (candidate.lastCorrect === false) return 1;
  return 2;
}

function orderWithinDomain(candidates: Candidate[], shuffle: <T>(items: T[]) => T[]): Candidate[] {
  const tiers: Candidate[][] = [[], [], []];
  for (const candidate of candidates) tiers[tier(candidate)]!.push(candidate);

  return [
    // Unseen questions carry no ordering signal, so randomize to vary practice.
    ...shuffle(tiers[0]!),
    ...shuffle(tiers[1]!),
    // Among mastered questions, surface whatever has gone longest without review.
    ...tiers[2]!.sort((a, b) => (a.lastAnsweredAt ?? 0) - (b.lastAnsweredAt ?? 0)),
  ];
}

export type SelectionInput = {
  candidates: Candidate[];
  domains: DomainAllocation[];
  count: number;
  /** Injectable so tests are deterministic. */
  shuffle?: <T>(items: T[]) => T[];
};

export function selectQuestions({
  candidates,
  domains,
  count,
  shuffle = defaultShuffle,
}: SelectionInput): Candidate[] {
  if (count <= 0 || candidates.length === 0) return [];

  const byDomain = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const bucket = byDomain.get(candidate.domainId);
    if (bucket) bucket.push(candidate);
    else byDomain.set(candidate.domainId, [candidate]);
  }

  const ordered = new Map<string, Candidate[]>();
  for (const [domainId, bucket] of byDomain) {
    ordered.set(domainId, orderWithinDomain(bucket, shuffle));
  }

  const target = Math.min(count, candidates.length);
  const quota = allocateByWeight(domains, target);

  const picked: Candidate[] = [];
  const taken = new Map<string, number>();

  for (const [domainId, want] of quota) {
    const available = ordered.get(domainId) ?? [];
    const take = Math.min(want, available.length);
    picked.push(...available.slice(0, take));
    taken.set(domainId, take);
  }

  // A domain short on published questions leaves its quota unfilled. Redistribute
  // the shortfall across whatever the other domains still have, rather than
  // silently returning a shorter attempt than the learner asked for.
  if (picked.length < target) {
    const chosen = new Set(picked.map((c) => c.id));
    for (const [domainId, available] of ordered) {
      if (picked.length >= target) break;
      for (const candidate of available.slice(taken.get(domainId) ?? 0)) {
        if (picked.length >= target) break;
        if (chosen.has(candidate.id)) continue;
        picked.push(candidate);
        chosen.add(candidate.id);
      }
    }
  }

  return picked.slice(0, target);
}

function defaultShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
