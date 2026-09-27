-- AlterEnum
ALTER TYPE "AttemptStatus" ADD VALUE 'PAUSED';

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "pausedSeconds" INTEGER NOT NULL DEFAULT 0;
