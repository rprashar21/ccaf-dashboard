import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  certificationSeedSchema,
  questionBankSeedSchema,
  type CertificationSeed,
  type QuestionBankSeed,
} from "../src/lib/validation/schemas";

// Seeding is idempotent: everything upserts on a stable natural key, so this can
// run repeatedly against a dev database and once against a fresh deploy without
// duplicating rows. CI runs it to prove the JSON validates and the schema holds.

const here = new URL(".", import.meta.url);

async function readJson(relativePath: string): Promise<unknown> {
  const path = fileURLToPath(new URL(relativePath, here));
  return JSON.parse(await readFile(path, "utf8"));
}

function checksum(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function connect() {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

async function seedCertification(db: PrismaClient, cert: CertificationSeed) {
  const { domains, ...fields } = cert;

  const certification = await db.certification.upsert({
    where: { slug: cert.slug },
    create: { ...fields },
    update: { ...fields },
  });

  for (const [index, domain] of domains.entries()) {
    const { subtopics, ...domainFields } = domain;

    const saved = await db.domain.upsert({
      where: {
        certificationId_slug: { certificationId: certification.id, slug: domain.slug },
      },
      create: { ...domainFields, sortOrder: index, certificationId: certification.id },
      update: { ...domainFields, sortOrder: index },
    });

    for (const subtopic of subtopics) {
      await db.subtopic.upsert({
        where: { domainId_slug: { domainId: saved.id, slug: subtopic.slug } },
        create: { ...subtopic, domainId: saved.id },
        update: { name: subtopic.name },
      });
    }
  }

  return certification;
}

async function seedQuestions(db: PrismaClient, bank: QuestionBankSeed, certificationId: string) {
  const domains = await db.domain.findMany({
    where: { certificationId },
    include: { subtopics: true },
  });

  const domainBySlug = new Map(domains.map((d) => [d.slug, d]));

  for (const question of bank.questions) {
    const domain = domainBySlug.get(question.domainSlug);
    if (!domain) {
      throw new Error(`${question.externalId}: unknown domain "${question.domainSlug}"`);
    }

    const subtopicIds: string[] = [];
    for (const slug of question.subtopicSlugs) {
      const subtopic = domain.subtopics.find((s) => s.slug === slug);
      if (!subtopic) {
        throw new Error(
          `${question.externalId}: unknown subtopic "${slug}" in domain "${domain.slug}"`,
        );
      }
      subtopicIds.push(subtopic.id);
    }

    const content = checksum(
      JSON.stringify([question.stem, question.options.map((o) => [o.label, o.body, o.isCorrect])]),
    );

    const fields = {
      certificationId,
      domainId: domain.id,
      type: question.type,
      status: question.status,
      difficulty: question.difficulty,
      stem: question.stem,
      explanation: question.explanation,
      referenceUrl: question.referenceUrl ?? null,
      sourceType: "SEED" as const,
      checksum: content,
    };

    const saved = await db.question.upsert({
      where: { externalId: question.externalId },
      create: { ...fields, externalId: question.externalId },
      update: fields,
    });

    // Options and subtopic links are replaced wholesale so an edited seed file
    // converges rather than accumulating stale rows.
    await db.questionOption.deleteMany({ where: { questionId: saved.id } });
    await db.questionOption.createMany({
      data: question.options.map((option, index) => ({
        questionId: saved.id,
        label: option.label,
        body: option.body,
        isCorrect: option.isCorrect,
        sortOrder: index,
      })),
    });

    await db.questionSubtopic.deleteMany({ where: { questionId: saved.id } });
    if (subtopicIds.length > 0) {
      await db.questionSubtopic.createMany({
        data: subtopicIds.map((subtopicId) => ({ questionId: saved.id, subtopicId })),
      });
    }
  }
}

async function main() {
  const db = connect();

  try {
    const cert = certificationSeedSchema.parse(await readJson("./seed/certifications/cca-f.json"));
    const bank = questionBankSeedSchema.parse(await readJson("./seed/questions/cca-f.json"));

    if (bank.certificationSlug !== cert.slug) {
      throw new Error(
        `question bank targets "${bank.certificationSlug}" but the certification is "${cert.slug}"`,
      );
    }

    const certification = await seedCertification(db, cert);
    await seedQuestions(db, bank, certification.id);

    const published = await db.question.count({
      where: { certificationId: certification.id, status: "PUBLISHED" },
    });

    console.log(
      `Seeded ${cert.code}: ${cert.domains.length} domains, ${bank.questions.length} questions (${published} published).`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
