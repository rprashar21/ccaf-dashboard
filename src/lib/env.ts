import { z } from "zod";

// Validated at import time so a missing secret fails loudly rather than
// surfacing later as a confusing OAuth error.
//
// OAuth credentials are required in production but optional in development:
// contributors can run migrations, the seed, the test suite, and the public
// marketing page without registering two OAuth apps first. Sign-in itself will
// fail without them, which is the correct and obvious consequence.
const isProduction = process.env["NODE_ENV"] === "production";
const credential = (name: string) =>
  isProduction ? z.string().min(1, `${name} is required in production`) : z.string().optional();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_GITHUB_ID: credential("AUTH_GITHUB_ID"),
  AUTH_GITHUB_SECRET: credential("AUTH_GITHUB_SECRET"),
  AUTH_GOOGLE_ID: credential("AUTH_GOOGLE_ID"),
  AUTH_GOOGLE_SECRET: credential("AUTH_GOOGLE_SECRET"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
