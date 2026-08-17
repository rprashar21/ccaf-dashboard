"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ReadinessRail } from "@/components/ReadinessRail";
import { checkSampleAnswer, type SampleVerdict } from "@/server/actions/sample";

type Option = { id: string; label: string; body: string };

type Props = {
  questionId: string;
  stem: string;
  domainName: string;
  options: Option[];
  scaleMax: number;
  passingScore: number;
  examQuestionCount: number;
};

/**
 * The conversion moment: one real question, answerable with no account.
 *
 * Answering moves the hero rail off zero for the first time — the single
 * orchestrated moment of motion on the page, and the whole product argument in
 * one interaction. Pure client state; nothing is written.
 */
export function SampleQuestion({
  questionId,
  stem,
  domainName,
  options,
  scaleMax,
  passingScore,
  examQuestionCount,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<SampleVerdict | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!selected || verdict) return;
    startTransition(async () => {
      setVerdict(await checkSampleAnswer({ questionId, optionId: selected }));
    });
  }

  // One answer out of the full exam length, expressed on the exam's own scale.
  const demoScore = verdict?.isCorrect ? Math.round(scaleMax / examQuestionCount) : 0;

  return (
    <div className="border-hairline bg-raise rounded-lg border p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="tick">Sample question</span>
        <span className="bg-gate-soft text-gate rounded-full px-2.5 py-0.5 text-xs font-semibold">
          {domainName}
        </span>
      </div>

      <fieldset disabled={Boolean(verdict) || pending}>
        <legend className="font-display text-ink mb-5 text-xl">{stem}</legend>

        <div className="space-y-2">
          {options.map((option) => {
            const isChosen = selected === option.id;
            const isAnswer = verdict?.correctOptionIds.includes(option.id) ?? false;
            const isWrongChoice = Boolean(verdict) && isChosen && !isAnswer;

            return (
              <label
                key={option.id}
                className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors ${
                  isAnswer
                    ? "border-gate bg-gate-soft"
                    : isWrongChoice
                      ? "border-under bg-under-soft"
                      : isChosen
                        ? "border-gate"
                        : "border-hairline hover:border-graphite"
                }`}
              >
                <input
                  type="radio"
                  name="sample"
                  value={option.id}
                  checked={isChosen}
                  onChange={() => setSelected(option.id)}
                  className="accent-gate mt-1.5"
                />
                <span className="tabular text-graphite text-sm font-semibold">{option.label}</span>
                <span className="flex-1">{option.body}</span>
                {/* State is never colour-only. */}
                {verdict && isAnswer ? (
                  <span className="tick text-gate self-center">Correct</span>
                ) : null}
                {isWrongChoice ? (
                  <span className="tick text-under self-center">Your answer</span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      {!verdict ? (
        <button
          type="button"
          onClick={submit}
          disabled={!selected || pending}
          className="bg-gate mt-6 rounded-md px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Checking…" : "Check answer"}
        </button>
      ) : (
        <div className="mt-6 space-y-6">
          <div>
            <p className="font-display mb-2 text-base">
              {verdict.isCorrect ? "Correct." : "Not quite."}
            </p>
            <p className="text-graphite">{verdict.explanation}</p>
          </div>

          <div className="border-hairline border-t pt-6">
            <ReadinessRail
              score={demoScore}
              scaleMax={scaleMax}
              passingScore={passingScore}
              provisional
              label="1 answer"
              size="compact"
            />
            <p className="text-graphite mt-4 text-sm">
              That is 1 question. Sign in to answer the rest and watch this number become an
              estimate worth trusting.
            </p>
            <Link
              href="/signin"
              className="bg-gate mt-4 inline-block rounded-md px-5 py-2.5 font-semibold text-white"
            >
              Sign in and keep going
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
