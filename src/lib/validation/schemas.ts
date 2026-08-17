import { z } from "zod";

// These schemas validate seed JSON today. In phase 3 the ingestion agent emits
// the same shape, so the deterministic checks the vision calls for (four options
// present, exactly one correct, an explanation, no duplicate externalIds) are
// enforced in one place for both paths.

export const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);
export const questionTypeSchema = z.enum(["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "CODING_EXERCISE"]);
export const contentStatusSchema = z.enum([
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
  "ARCHIVED",
  "REJECTED",
]);

export const subtopicSeedSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});

export const domainSeedSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().gt(0).lte(1),
  subtopics: z.array(subtopicSeedSchema).min(1),
});

export const certificationSeedSchema = z
  .object({
    slug: z.string().min(1),
    code: z.string().min(1),
    name: z.string().min(1),
    vendor: z.string().min(1),
    description: z.string().min(1),
    examQuestionCount: z.number().int().positive(),
    examDurationMinutes: z.number().int().positive(),
    passingScore: z.number().int().positive(),
    scoreScaleMax: z.number().int().positive(),
    sourceNote: z.string().min(1),
    isPublished: z.boolean(),
    domains: z.array(domainSeedSchema).min(1),
  })
  .refine((c) => c.passingScore <= c.scoreScaleMax, {
    message: "passingScore cannot exceed scoreScaleMax",
    path: ["passingScore"],
  })
  .refine(
    (c) => {
      const sum = c.domains.reduce((acc, d) => acc + d.weight, 0);
      return Math.abs(sum - 1) < 1e-6;
    },
    { message: "domain weights must sum to 1", path: ["domains"] },
  )
  .refine((c) => new Set(c.domains.map((d) => d.slug)).size === c.domains.length, {
    message: "duplicate domain slug",
    path: ["domains"],
  });

export const questionOptionSeedSchema = z.object({
  label: z.string().min(1).max(4),
  body: z.string().min(1),
  isCorrect: z.boolean(),
});

export const questionSeedSchema = z
  .object({
    externalId: z.string().min(1),
    domainSlug: z.string().min(1),
    subtopicSlugs: z.array(z.string().min(1)).default([]),
    type: questionTypeSchema.default("MULTIPLE_CHOICE"),
    status: contentStatusSchema.default("PUBLISHED"),
    difficulty: difficultySchema.default("MEDIUM"),
    stem: z.string().min(1),
    explanation: z.string().min(20, "an explanation is what makes this better than a flashcard"),
    referenceUrl: z.url().optional(),
    options: z.array(questionOptionSeedSchema).length(4, "every question needs exactly 4 options"),
  })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, {
    message: "multiple choice questions need exactly one correct option",
    path: ["options"],
  })
  .refine((q) => new Set(q.options.map((o) => o.label)).size === q.options.length, {
    message: "duplicate option label",
    path: ["options"],
  })
  .refine((q) => new Set(q.options.map((o) => o.body.trim())).size === q.options.length, {
    message: "duplicate option text",
    path: ["options"],
  });

export const questionBankSeedSchema = z
  .object({
    certificationSlug: z.string().min(1),
    questions: z.array(questionSeedSchema).min(1),
  })
  .refine((b) => new Set(b.questions.map((q) => q.externalId)).size === b.questions.length, {
    message: "duplicate question externalId",
    path: ["questions"],
  })
  .refine(
    (b) => new Set(b.questions.map((q) => q.stem.trim().toLowerCase())).size === b.questions.length,
    { message: "duplicate question stem", path: ["questions"] },
  );

export type CertificationSeed = z.infer<typeof certificationSeedSchema>;
export type DomainSeed = z.infer<typeof domainSeedSchema>;
export type QuestionSeed = z.infer<typeof questionSeedSchema>;
export type QuestionBankSeed = z.infer<typeof questionBankSeedSchema>;
