import { describe, expect, it } from "vitest";
import { gradeResponse } from "./grade";

const OPTIONS = [
  { id: "a", isCorrect: true },
  { id: "b", isCorrect: false },
  { id: "c", isCorrect: false },
  { id: "d", isCorrect: false },
];

describe("gradeResponse", () => {
  it("marks the correct single choice", () => {
    const grade = gradeResponse(OPTIONS, ["a"]);
    expect(grade.isCorrect).toBe(true);
    expect(grade.correctOptionIds).toEqual(["a"]);
  });

  it("marks a wrong choice incorrect", () => {
    expect(gradeResponse(OPTIONS, ["b"]).isCorrect).toBe(false);
  });

  it("rejects an empty submission", () => {
    expect(gradeResponse(OPTIONS, []).isCorrect).toBe(false);
  });

  it("rejects selecting everything", () => {
    // Shotgunning every option must not count as correct.
    expect(gradeResponse(OPTIONS, ["a", "b", "c", "d"]).isCorrect).toBe(false);
  });

  it("ignores option ids that do not belong to this question", () => {
    const grade = gradeResponse(OPTIONS, ["a", "not-an-option"]);
    expect(grade.isCorrect).toBe(true);
    expect(grade.selectedOptionIds).toEqual(["a"]);
  });

  it("deduplicates repeated selections", () => {
    const grade = gradeResponse(OPTIONS, ["a", "a", "a"]);
    expect(grade.isCorrect).toBe(true);
    expect(grade.selectedOptionIds).toEqual(["a"]);
  });

  it("requires every correct option on a multi-select question", () => {
    const multi = [
      { id: "a", isCorrect: true },
      { id: "b", isCorrect: true },
      { id: "c", isCorrect: false },
    ];

    expect(gradeResponse(multi, ["a", "b"]).isCorrect).toBe(true);
    expect(gradeResponse(multi, ["a"]).isCorrect).toBe(false);
    expect(gradeResponse(multi, ["a", "b", "c"]).isCorrect).toBe(false);
  });
});
