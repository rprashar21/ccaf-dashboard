/**
 * Consecutive days with at least one completed attempt.
 *
 * Pure, and deliberately separate from the dashboard query module so it is
 * testable without a database connection.
 *
 * Uses UTC calendar days. A per-user timezone would be more accurate near
 * midnight; that is a deliberate simplification, not an oversight.
 */
export function calculateStreak(dates: Array<Date | null>): { current: number; longest: number } {
  const days = [
    ...new Set(
      dates
        .filter((d): d is Date => d !== null)
        .map((d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
    ),
  ].sort((a, b) => b - a);

  if (days.length === 0) return { current: 0, longest: 0 };

  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // A streak stays alive if the last activity was today or yesterday.
  let current = 0;
  if (days[0] === today || days[0] === today - DAY) {
    current = 1;
    for (let i = 1; i < days.length; i++) {
      if (days[i - 1]! - days[i]! === DAY) current += 1;
      else break;
    }
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1]! - days[i]! === DAY) run += 1;
    else run = 1;
    if (run > longest) longest = run;
  }

  return { current, longest };
}
