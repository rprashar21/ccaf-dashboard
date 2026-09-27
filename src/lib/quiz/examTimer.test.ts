import { describe, expect, it } from "vitest";
import { activeElapsedSeconds, formatClock, isExpired, remainingSeconds } from "./examTimer";

const start = new Date("2026-01-01T10:00:00.000Z");

describe("activeElapsedSeconds", () => {
  it("counts wall-clock time for a fresh, never-paused attempt", () => {
    const attempt = {
      status: "IN_PROGRESS" as const,
      startedAt: start,
      pausedAt: null,
      pausedSeconds: 0,
    };
    const now = new Date(start.getTime() + 30 * 1000);
    expect(activeElapsedSeconds(attempt, now)).toBe(30);
  });

  it("freezes at the moment paused, ignoring how long ago that was", () => {
    const pausedAt = new Date(start.getTime() + 60 * 1000);
    const attempt = { status: "PAUSED" as const, startedAt: start, pausedAt, pausedSeconds: 0 };
    const muchLater = new Date(start.getTime() + 10 * 60 * 1000);
    expect(activeElapsedSeconds(attempt, muchLater)).toBe(60);
  });

  it("subtracts accumulated pause time once resumed", () => {
    // Started at 10:00, paused for 5 minutes, resumed, now 2 minutes later.
    const attempt = {
      status: "IN_PROGRESS" as const,
      startedAt: start,
      pausedAt: null,
      pausedSeconds: 5 * 60,
    };
    const now = new Date(start.getTime() + 7 * 60 * 1000);
    expect(activeElapsedSeconds(attempt, now)).toBe(2 * 60);
  });

  it("never goes negative", () => {
    const attempt = {
      status: "IN_PROGRESS" as const,
      startedAt: start,
      pausedAt: null,
      pausedSeconds: 999_999,
    };
    expect(activeElapsedSeconds(attempt, start)).toBe(0);
  });
});

describe("remainingSeconds", () => {
  it("is null without a time limit", () => {
    const attempt = {
      status: "IN_PROGRESS" as const,
      startedAt: start,
      pausedAt: null,
      pausedSeconds: 0,
    };
    expect(remainingSeconds(attempt, null, start)).toBeNull();
  });

  it("counts down against the limit", () => {
    const attempt = {
      status: "IN_PROGRESS" as const,
      startedAt: start,
      pausedAt: null,
      pausedSeconds: 0,
    };
    const now = new Date(start.getTime() + 100 * 1000);
    expect(remainingSeconds(attempt, 7200, now)).toBe(7100);
  });

  it("clamps at zero once expired", () => {
    const attempt = {
      status: "IN_PROGRESS" as const,
      startedAt: start,
      pausedAt: null,
      pausedSeconds: 0,
    };
    const now = new Date(start.getTime() + 8000 * 1000);
    expect(remainingSeconds(attempt, 7200, now)).toBe(0);
  });

  it("stays frozen while paused, even past the limit's clock time", () => {
    const pausedAt = new Date(start.getTime() + 100 * 1000);
    const attempt = { status: "PAUSED" as const, startedAt: start, pausedAt, pausedSeconds: 0 };
    const muchLater = new Date(start.getTime() + 20_000 * 1000);
    expect(remainingSeconds(attempt, 7200, muchLater)).toBe(7100);
  });
});

describe("isExpired", () => {
  it("is false without a time limit no matter how much time has passed", () => {
    const attempt = {
      status: "IN_PROGRESS" as const,
      startedAt: start,
      pausedAt: null,
      pausedSeconds: 0,
    };
    const now = new Date(start.getTime() + 1_000_000 * 1000);
    expect(isExpired(attempt, null, now)).toBe(false);
  });

  it("is true once active elapsed time reaches the limit", () => {
    const attempt = {
      status: "IN_PROGRESS" as const,
      startedAt: start,
      pausedAt: null,
      pausedSeconds: 0,
    };
    const now = new Date(start.getTime() + 7200 * 1000);
    expect(isExpired(attempt, 7200, now)).toBe(true);
  });

  it("is false while paused before hitting the limit, even much later", () => {
    const pausedAt = new Date(start.getTime() + 100 * 1000);
    const attempt = { status: "PAUSED" as const, startedAt: start, pausedAt, pausedSeconds: 0 };
    const muchLater = new Date(start.getTime() + 50_000 * 1000);
    expect(isExpired(attempt, 7200, muchLater)).toBe(false);
  });
});

describe("formatClock", () => {
  it("formats under an hour as MM:SS", () => {
    expect(formatClock(65)).toBe("01:05");
  });

  it("formats an hour or more as H:MM:SS", () => {
    expect(formatClock(3661)).toBe("1:01:01");
  });

  it("formats zero", () => {
    expect(formatClock(0)).toBe("00:00");
  });
});
