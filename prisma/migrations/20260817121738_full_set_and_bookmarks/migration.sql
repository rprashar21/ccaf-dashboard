-- AlterEnum
ALTER TYPE "AttemptMode" ADD VALUE 'FULL_SET';

-- AlterTable
ALTER TABLE "QuizAttemptQuestion" ADD COLUMN     "bookmarked" BOOLEAN NOT NULL DEFAULT false;
