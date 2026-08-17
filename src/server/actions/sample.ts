"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { gradeResponse } from "@/lib/quiz/grade";

const schema = z.object({
  questionId: z.string().min(1),
  optionId: z.string().min(1),
});

export type SampleVerdict = {
  isCorrect: boolean;
  correctOptionIds: string[];
  explanation: string;
};

/**
 * Grades the landing page's demo question.
 *
 * Grading happens here rather than in the browser so the answer key is never
 * shipped to an anonymous visitor. Nothing is written: no attempt row, no
 * response row. Anonymous progress is not persisted.
 */
export async function checkSampleAnswer(input: z.infer<typeof schema>): Promise<SampleVerdict> {
  const { questionId, optionId } = schema.parse(input);

  const question = await db.question.findFirst({
    where: { id: questionId, status: "PUBLISHED" },
    include: { options: { select: { id: true, isCorrect: true } } },
  });

  if (!question) throw new Error("Question not found");

  const grade = gradeResponse(question.options, [optionId]);

  return {
    isCorrect: grade.isCorrect,
    correctOptionIds: grade.correctOptionIds,
    explanation: question.explanation,
  };
}
