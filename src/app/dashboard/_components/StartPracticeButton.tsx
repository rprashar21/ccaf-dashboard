"use client";

import { useTransition } from "react";
import { startAttempt } from "@/server/actions/attempts";

type Props = {
  certSlug: string;
  /** Ignored when bulkMode is set — bulk modes always take their whole pool. */
  questionCount?: number;
  domainId?: string;
  mode?: "PRACTICE" | "DOMAIN_DRILL" | "MOCK_EXAM";
  /** Starts a FULL_SET or IMPORTED_SET attempt instead, overriding mode/questionCount/domainId. */
  bulkMode?: "FULL_SET" | "IMPORTED_SET";
  children: React.ReactNode;
  variant?: "primary" | "secondary";
};

export function StartPracticeButton({
  certSlug,
  questionCount,
  domainId,
  mode = "PRACTICE",
  bulkMode,
  children,
  variant = "primary",
}: Props) {
  const [pending, startTransition] = useTransition();

  const styles =
    variant === "primary"
      ? "bg-gate hover:bg-gate/90 text-white"
      : "border border-hairline bg-raise hover:border-graphite";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (bulkMode) {
            await startAttempt({ certSlug, mode: bulkMode });
          } else {
            await startAttempt({ certSlug, mode, questionCount, domainId });
          }
        })
      }
      className={`rounded-md px-5 py-2.5 font-semibold disabled:opacity-50 ${styles}`}
    >
      {pending ? "Starting…" : children}
    </button>
  );
}
