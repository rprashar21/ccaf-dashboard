// Grading is pure and lives server-side only. Correct-answer flags must never
// reach the browser before the learner has answered.

export type GradableOption = { id: string; isCorrect: boolean };

export type Grade = {
  isCorrect: boolean;
  correctOptionIds: string[];
  selectedOptionIds: string[];
};

export function gradeResponse(options: GradableOption[], selectedOptionIds: string[]): Grade {
  const correctOptionIds = options.filter((o) => o.isCorrect).map((o) => o.id);

  const valid = new Set(options.map((o) => o.id));
  // Deduplicate and drop anything that is not an option on this question, so a
  // malformed submission cannot be graded correct by repetition or by padding.
  const selected = [...new Set(selectedOptionIds)].filter((id) => valid.has(id));

  const correct = new Set(correctOptionIds);
  const isCorrect = selected.length === correct.size && selected.every((id) => correct.has(id));

  return { isCorrect, correctOptionIds, selectedOptionIds: selected };
}
