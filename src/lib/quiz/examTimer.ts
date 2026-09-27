// Pure. No database access, no Prisma types — both the server actions and the
// client timer UI derive the same numbers from these four fields so neither
// side can drift from the other.

export type ExamClock = {
  status: "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "ABANDONED";
  startedAt: Date;
  pausedAt: Date | null;
  pausedSeconds: number;
};

/**
 * Seconds actually spent working on the attempt: wall-clock time since it
 * started, minus every second spent paused. While paused, this is frozen at
 * the instant the pause began rather than continuing to grow with `now`.
 */
export function activeElapsedSeconds(attempt: ExamClock, now: Date): number {
  const reference = attempt.status === "PAUSED" ? (attempt.pausedAt ?? now) : now;
  const wallClockSeconds = (reference.getTime() - attempt.startedAt.getTime()) / 1000;
  return Math.max(0, Math.round(wallClockSeconds - attempt.pausedSeconds));
}

/** Null when the attempt has no time limit (every mode but TIMED_EXAM). */
export function remainingSeconds(
  attempt: ExamClock,
  timeLimitSeconds: number | null,
  now: Date,
): number | null {
  if (timeLimitSeconds === null) return null;
  return Math.max(0, timeLimitSeconds - activeElapsedSeconds(attempt, now));
}

export function isExpired(attempt: ExamClock, timeLimitSeconds: number | null, now: Date): boolean {
  if (timeLimitSeconds === null) return false;
  return activeElapsedSeconds(attempt, now) >= timeLimitSeconds;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
