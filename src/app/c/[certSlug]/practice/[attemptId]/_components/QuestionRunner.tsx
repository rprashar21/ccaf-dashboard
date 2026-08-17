"use client";

import { useState, useTransition } from "react";
import { finishAttempt, submitResponse, type SubmitResult } from "@/server/actions/attempts";

type Option = { id: string; label: string; body: string };
type Slot = {
  questionId: string;
  position: number;
  stem: string;
  domainName: string;
  options: Option[];
};

type Props = {
  attemptId: string;
  slots: Slot[];
  /** Positions already answered when the attempt was resumed. */
  answeredPositions: number[];
};

export function QuestionRunner({ attemptId, slots, answeredPositions }: Props) {
  // Resume where the learner left off rather than restarting the slate.
  const firstUnanswered = slots.findIndex((s) => !answeredPositions.includes(s.position));
  const [index, setIndex] = useState(firstUnanswered === -1 ? 0 : firstUnanswered);
  const [selected, setSelected] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<SubmitResult | null>(null);
  const [answered, setAnswered] = useState<number>(answeredPositions.length);
  const [pending, startTransition] = useTransition();

  const slot = slots[index];
  if (!slot) return null;

  const isLast = index === slots.length - 1;

  function submit() {
    if (!selected || verdict || !slot) return;
    startTransition(async () => {
      const result = await submitResponse({
        attemptId,
        questionId: slot.questionId,
        selectedOptionIds: [selected],
      });
      setVerdict(result);
      setAnswered((n) => n + 1);
    });
  }

  function next() {
    setVerdict(null);
    setSelected(null);
    setIndex((i) => Math.min(i + 1, slots.length - 1));
  }

  function finish() {
    startTransition(async () => {
      await finishAttempt({ attemptId });
    });
  }

  return (
    <div>
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="tick">
            Question {index + 1} of {slots.length}
          </span>
          <span className="tick">{answered} answered</span>
        </div>
        <div className="bg-hairline/50 h-1 w-full overflow-hidden rounded-full">
          <div
            className="bg-gate h-full rounded-full transition-[width] duration-300"
            style={{ width: `${(answered / slots.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="border-hairline bg-raise rounded-lg border p-6 sm:p-8">
        <span className="bg-gate-soft text-gate mb-5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold">
          {slot.domainName}
        </span>

        <fieldset disabled={Boolean(verdict) || pending}>
          <legend className="font-display text-ink mb-5 text-xl">{slot.stem}</legend>

          <div className="space-y-2">
            {slot.options.map((option) => {
              const isChosen = selected === option.id;
              const isAnswer = verdict?.correctOptionIds.includes(option.id) ?? false;
              const isWrongChoice = Boolean(verdict) && isChosen && !isAnswer;

              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 ${
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
                    name={`q-${slot.questionId}`}
                    value={option.id}
                    checked={isChosen}
                    onChange={() => setSelected(option.id)}
                    className="accent-gate mt-1.5"
                  />
                  <span className="tabular text-graphite text-sm font-semibold">
                    {option.label}
                  </span>
                  <span className="flex-1">{option.body}</span>
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

        {verdict ? (
          <div className="border-hairline mt-6 border-t pt-6">
            <p className="font-display mb-2 text-base">
              {verdict.isCorrect ? "Correct." : "Not quite."}
            </p>
            <p className="text-graphite">{verdict.explanation}</p>
          </div>
        ) : null}

        <div className="mt-8 flex items-center gap-3">
          {!verdict ? (
            <button
              type="button"
              onClick={submit}
              disabled={!selected || pending}
              className="bg-gate rounded-md px-5 py-2.5 font-semibold text-white disabled:opacity-40"
            >
              {pending ? "Checking…" : "Check answer"}
            </button>
          ) : isLast ? (
            <button
              type="button"
              onClick={finish}
              disabled={pending}
              className="bg-gate rounded-md px-5 py-2.5 font-semibold text-white disabled:opacity-40"
            >
              {pending ? "Scoring…" : "Finish and see results"}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="bg-gate rounded-md px-5 py-2.5 font-semibold text-white"
            >
              Next question
            </button>
          )}

          {verdict && !isLast ? (
            <button
              type="button"
              onClick={finish}
              disabled={pending}
              className="text-graphite hover:text-ink text-sm underline"
            >
              Finish early
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
