import { describe, expect, it } from "vitest";
import { calculateStreak } from "./streak";

const DAY = 24 * 60 * 60 * 1000;

/** N whole days before today, in UTC. */
function daysAgo(n: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - n * DAY);
}

describe("calculateStreak", () => {
  it("returns zero for no activity", () => {
    expect(calculateStreak([])).toEqual({ current: 0, longest: 0 });
  });

  it("counts a run ending today", () => {
    expect(calculateStreak([daysAgo(0), daysAgo(1), daysAgo(2)]).current).toBe(3);
  });

  it("keeps the streak alive when the last activity was yesterday", () => {
    expect(calculateStreak([daysAgo(1), daysAgo(2)]).current).toBe(2);
  });

  it("breaks the current streak once a day is missed", () => {
    const streak = calculateStreak([daysAgo(3), daysAgo(4), daysAgo(5)]);
    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(3);
  });

  it("counts several attempts on one day only once", () => {
    const today = daysAgo(0);
    expect(calculateStreak([today, today, today]).current).toBe(1);
  });

  it("reports the longest historical run alongside the current one", () => {
    const streak = calculateStreak([
      daysAgo(0),
      daysAgo(1),
      // gap
      daysAgo(5),
      daysAgo(6),
      daysAgo(7),
      daysAgo(8),
    ]);
    expect(streak.current).toBe(2);
    expect(streak.longest).toBe(4);
  });

  it("ignores null completion timestamps", () => {
    expect(calculateStreak([null, daysAgo(0), null]).current).toBe(1);
  });
});
