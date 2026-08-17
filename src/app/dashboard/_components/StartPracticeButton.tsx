"use client";

import { useTransition } from "react";
import { startAttempt } from "@/server/actions/attempts";

type Props = {
  certSlug: string;
  questionCount: number;
  domainId?: string;
  mode?: "PRACTICE" | "DOMAIN_DRILL";
  children: React.ReactNode;
  variant?: "primary" | "secondary";
};

export function StartPracticeButton({
  certSlug,
  questionCount,
  domainId,
  mode = "PRACTICE",
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
          await startAttempt({ certSlug, mode, questionCount, domainId });
        })
      }
      className={`rounded-md px-5 py-2.5 font-semibold disabled:opacity-50 ${styles}`}
    >
      {pending ? "Starting…" : children}
    </button>
  );
}
