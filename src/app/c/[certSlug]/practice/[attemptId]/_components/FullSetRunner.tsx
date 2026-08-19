"use client";

import { useEffect, useState, useTransition } from "react";
import {
  abandonAttempt,
  finishAttempt,
  submitResponse,
  toggleBookmark,
} from "@/server/actions/attempts";

type Option = { id: string; label: string; body: string };
type SlotResponse = { selectedOptionIds: string[]; isCorrect: boolean; correctOptionIds: string[] };
type Slot = {
  questionId: string;
  position: number;
  stem: string;
  domainName: string;
  explanation: string;
  bookmarked: boolean;
  options: Option[];
  response: SlotResponse | null;
};

type Filter = "all" | "unanswered" | "missed" | "correct" | "bookmarked";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unanswered", label: "Unanswered" },
  { key: "missed", label: "Missed" },
  { key: "correct", label: "Correct" },
  { key: "bookmarked", label: "★ Bookmarked" },
];

function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function storageKey(attemptId: string): string {
  return `mock-runner:${attemptId}`;
}

function matchesFilter(slot: Slot, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "unanswered":
      return !slot.response;
    case "correct":
      return slot.response?.isCorrect === true;
    case "missed":
      return slot.response ? !slot.response.isCorrect : false;
    case "bookmarked":
      return slot.bookmarked;
  }
}

export function FullSetRunner({
  attemptId,
  certCode,
  certName,
  domainNames,
  slots: initialSlots,
}: {
  attemptId: string;
  certCode: string;
  certName: string;
  domainNames: string[];
  slots: Slot[];
}) {
  const [slots, setSlots] = useState(initialSlots);
  const [filter, setFilter] = useState<Filter>("all");
  const firstUnanswered = slots.findIndex((s) => !s.response);
  const [currentIndex, setCurrentIndex] = useState(firstUnanswered === -1 ? 0 : firstUnanswered);
  const [selected, setSelected] = useState<string | null>(null);
  const [order, setOrder] = useState<number[]>(() => initialSlots.map((_, i) => i));
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();

  const answered = slots.filter((s) => s.response).length;
  const correct = slots.filter((s) => s.response?.isCorrect).length;
  const accuracy = answered > 0 ? Math.round((100 * correct) / answered) : null;

  // Restore the last-viewed question and filter after a reload — answers and
  // bookmarks already persist server-side, this just keeps navigation state
  // from resetting to "first unanswered" every time the page is revisited.
  useEffect(() => {
    // One-time rehydration from localStorage on mount, not a sync loop — the
    // lint rule against setState-in-effect is aimed at effects that re-derive
    // state from props/state on every render, which this isn't.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(storageKey(attemptId));
      if (raw) {
        const saved = JSON.parse(raw) as { currentIndex?: number; filter?: Filter };
        if (
          typeof saved.currentIndex === "number" &&
          saved.currentIndex >= 0 &&
          saved.currentIndex < slots.length
        ) {
          setCurrentIndex(saved.currentIndex);
        }
        if (saved.filter && FILTERS.some((f) => f.key === saved.filter)) {
          setFilter(saved.filter);
        }
      }
    } catch {
      // Storage unavailable (private browsing, quota, etc.) — fall back to defaults.
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Only ever re-run if the attempt itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey(attemptId), JSON.stringify({ currentIndex, filter }));
    } catch {
      // Ignore — this is a convenience, not the source of truth.
    }
  }, [attemptId, currentIndex, filter, hydrated]);

  const filteredIndices = order.filter((i) => matchesFilter(slots[i]!, filter));

  const posInFiltered = filteredIndices.indexOf(currentIndex);
  const current = posInFiltered >= 0 ? slots[currentIndex] : undefined;

  function selectFilter(next: Filter) {
    setFilter(next);
    setSelected(null);
    const nextFiltered = order.filter((i) => matchesFilter(slots[i]!, next));
    if (!nextFiltered.includes(currentIndex) && nextFiltered.length > 0) {
      setCurrentIndex(nextFiltered[0]!);
    }
  }

  function shuffle() {
    setOrder((prev) => shuffleArray(prev));
    setSelected(null);
  }

  function reset() {
    if (pending) return;
    if (!window.confirm("Reset? This abandons your progress on this attempt.")) return;
    startTransition(async () => {
      await abandonAttempt({ attemptId });
    });
  }

  function jumpTo(index: number) {
    setSelected(null);
    setCurrentIndex(index);
  }

  function moveBy(delta: number) {
    const pos = filteredIndices.indexOf(currentIndex);
    const nextPos = pos + delta;
    if (nextPos < 0 || nextPos >= filteredIndices.length) return;
    jumpTo(filteredIndices[nextPos]!);
  }

  function submit() {
    if (!selected || !current || current.response || pending) return;
    const questionId = current.questionId;
    startTransition(async () => {
      const result = await submitResponse({ attemptId, questionId, selectedOptionIds: [selected] });
      setSlots((prev) =>
        prev.map((s) =>
          s.questionId === questionId
            ? {
                ...s,
                response: {
                  selectedOptionIds: [selected],
                  isCorrect: result.isCorrect,
                  correctOptionIds: result.correctOptionIds,
                },
              }
            : s,
        ),
      );
    });
  }

  function toggleCurrentBookmark() {
    if (!current || pending) return;
    const questionId = current.questionId;
    startTransition(async () => {
      const result = await toggleBookmark({ attemptId, questionId });
      setSlots((prev) =>
        prev.map((s) =>
          s.questionId === questionId ? { ...s, bookmarked: result.bookmarked } : s,
        ),
      );
    });
  }

  function finish() {
    startTransition(async () => {
      await finishAttempt({ attemptId });
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="rounded border border-[var(--qd-accent-dim)] bg-[var(--qd-accent-dim)] px-2 py-0.5 font-mono text-[11px] tracking-widest text-[var(--qd-accent)] uppercase">
              {certCode}
            </span>
            <h1 className="font-display text-lg font-bold text-[var(--qd-text)]">{certName}</h1>
          </div>
          <p className="mt-1 font-mono text-[13px] text-[var(--qd-text-dim)]">
            {slots.length} questions
            {domainNames.length > 0 ? ` · ${domainNames.join(", ")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="font-mono text-xl leading-none font-bold text-[var(--qd-text)]">
              {answered}
            </div>
            <div className="mt-1 text-[10px] tracking-widest text-[var(--qd-text-dim)] uppercase">
              Answered
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xl leading-none font-bold text-[var(--qd-good)]">
              {correct}
            </div>
            <div className="mt-1 text-[10px] tracking-widest text-[var(--qd-text-dim)] uppercase">
              Correct
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xl leading-none font-bold text-[var(--qd-accent)]">
              {accuracy === null ? "—" : `${accuracy}%`}
            </div>
            <div className="mt-1 text-[10px] tracking-widest text-[var(--qd-text-dim)] uppercase">
              Accuracy
            </div>
          </div>
        </div>
      </div>

      <div className="mb-5 flex h-1.5 overflow-hidden rounded bg-[var(--qd-panel-2)]">
        <div
          className="h-full bg-[var(--qd-good)]"
          style={{ width: `${(100 * correct) / slots.length}%` }}
        />
        <div
          className="h-full bg-[var(--qd-bad)]"
          style={{ width: `${(100 * (answered - correct)) / slots.length}%` }}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => selectFilter(f.key)}
            className={`rounded-md border px-2.5 py-1.5 font-mono text-[12px] ${
              filter === f.key
                ? "border-[var(--qd-accent)] bg-[var(--qd-accent-dim)] text-[var(--qd-accent)]"
                : "border-[var(--qd-border)] text-[var(--qd-text-dim)] hover:border-[var(--qd-text-dim)] hover:text-[var(--qd-text)]"
            }`}
          >
            {f.key === "all" ? `All ${slots.length}` : f.label}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          onClick={shuffle}
          className="rounded-md border border-[var(--qd-border)] px-2.5 py-1.5 font-mono text-[12px] text-[var(--qd-text-dim)] hover:border-[var(--qd-text-dim)] hover:text-[var(--qd-text)]"
        >
          ⤮ Shuffle
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="rounded-md border border-[var(--qd-border)] px-2.5 py-1.5 font-mono text-[12px] text-[var(--qd-text-dim)] hover:border-[var(--qd-text-dim)] hover:text-[var(--qd-text)] disabled:opacity-40"
        >
          ↺ Reset
        </button>
      </div>

      {!current ? (
        <div className="rounded-xl border border-[var(--qd-border)] bg-[var(--qd-panel)] p-8 text-center">
          <p className="font-display text-lg text-[var(--qd-text)]">Nothing here</p>
          <p className="mt-2 text-sm text-[var(--qd-text-dim)]">Try a different filter.</p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-[var(--qd-border)] bg-[var(--qd-panel)] p-6 sm:p-7">
          <div
            className="absolute inset-x-0 top-0 h-0.5 opacity-60"
            style={{
              background: "linear-gradient(90deg, var(--qd-indigo), var(--qd-accent))",
            }}
          />

          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[13px] font-semibold text-[var(--qd-indigo)]">
                Q{current.position + 1}{" "}
                <span className="text-[var(--qd-text-dim)]">/ {slots.length}</span>
              </span>
              <span className="inline-block rounded-full bg-[var(--qd-accent-dim)] px-2.5 py-0.5 text-xs font-semibold text-[var(--qd-accent)]">
                {current.domainName}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleCurrentBookmark}
              disabled={pending}
              aria-pressed={current.bookmarked}
              aria-label={current.bookmarked ? "Remove bookmark" : "Bookmark this question"}
              className={`text-xl leading-none ${current.bookmarked ? "text-[var(--qd-amber)]" : "text-[var(--qd-text-dim)] hover:text-[var(--qd-text)]"}`}
            >
              {current.bookmarked ? "★" : "☆"}
            </button>
          </div>

          <fieldset disabled={Boolean(current.response) || pending}>
            <legend className="font-display mb-5 text-[16.5px] leading-relaxed font-medium text-[var(--qd-text)]">
              {current.stem}
            </legend>

            <div className="space-y-2">
              {current.options.map((option) => {
                const isChosen = selected === option.id;
                const isAnswer = current.response?.correctOptionIds.includes(option.id) ?? false;
                const isWrongChoice = Boolean(current.response) && isChosen && !isAnswer;
                const wasSelected =
                  current.response?.selectedOptionIds.includes(option.id) ?? false;

                return (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-[14.5px] text-[var(--qd-text)]"
                    style={{
                      borderColor: isAnswer
                        ? "var(--qd-good)"
                        : current.response && wasSelected && !isAnswer
                          ? "var(--qd-bad)"
                          : isChosen
                            ? "var(--qd-indigo)"
                            : "var(--qd-border)",
                      background: isAnswer
                        ? "var(--qd-good-bg)"
                        : current.response && wasSelected && !isAnswer
                          ? "var(--qd-bad-bg)"
                          : "var(--qd-panel-2)",
                    }}
                  >
                    <input
                      type="radio"
                      name={`q-${current.questionId}`}
                      value={option.id}
                      checked={current.response ? wasSelected : isChosen}
                      onChange={() => setSelected(option.id)}
                      className="mt-1.5 accent-[var(--qd-indigo)]"
                    />
                    <span className="font-mono text-sm font-semibold text-[var(--qd-text-dim)]">
                      {option.label}
                    </span>
                    <span className="flex-1">{option.body}</span>
                    {current.response && isAnswer ? (
                      <span className="self-center font-mono text-xs text-[var(--qd-good)]">
                        ✓ correct
                      </span>
                    ) : null}
                    {isWrongChoice ? (
                      <span className="self-center font-mono text-xs text-[var(--qd-bad)]">
                        ✗ your pick
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {current.response ? (
            <div className="mt-5 rounded-lg border border-[var(--qd-border)] bg-[var(--qd-panel-2)] p-4">
              <p className="mb-2 text-[10px] font-semibold tracking-widest text-[var(--qd-text-dim)] uppercase">
                {current.response.isCorrect ? "Correct" : "Not quite"} · Explanation
              </p>
              <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-[#c4cddb]">
                {current.explanation}
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => moveBy(-1)}
              disabled={posInFiltered <= 0}
              className="rounded-md border border-[var(--qd-border)] px-4 py-2 text-sm font-semibold text-[var(--qd-text)] hover:border-[var(--qd-text-dim)] disabled:opacity-40"
            >
              ← Prev
            </button>

            {!current.response ? (
              <button
                type="button"
                onClick={submit}
                disabled={!selected || pending}
                className="rounded-md bg-[var(--qd-indigo)] px-5 py-2.5 font-semibold text-white disabled:opacity-40"
              >
                {pending ? "Checking…" : "Check answer"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => moveBy(1)}
              disabled={posInFiltered === -1 || posInFiltered >= filteredIndices.length - 1}
              className="ml-auto rounded-md border border-[var(--qd-border)] px-4 py-2 text-sm font-semibold text-[var(--qd-text)] hover:border-[var(--qd-text-dim)] disabled:opacity-40"
            >
              {current.response ? "Next →" : "Skip →"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-[var(--qd-border)] bg-[var(--qd-panel)] p-3.5">
        <p className="mb-2.5 font-mono text-[11px] tracking-wide text-[var(--qd-text-dim)] uppercase">
          Question map — showing {filteredIndices.length} of {slots.length}
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(30px,1fr))] gap-1.5">
          {filteredIndices.map((i) => {
            const slot = slots[i]!;
            const isCurrent = i === currentIndex;
            const state = !slot.response
              ? "unanswered"
              : slot.response.isCorrect
                ? "correct"
                : "incorrect";

            return (
              <button
                key={slot.questionId}
                type="button"
                onClick={() => jumpTo(i)}
                aria-label={`Question ${slot.position + 1}${slot.bookmarked ? ", bookmarked" : ""}`}
                className="relative flex aspect-square items-center justify-center rounded font-mono text-[10.5px] transition-transform hover:scale-110"
                style={{
                  border: `1px solid ${isCurrent ? "var(--qd-indigo)" : "var(--qd-border)"}`,
                  outline: isCurrent ? "2px solid var(--qd-indigo)" : "none",
                  outlineOffset: 1,
                  background:
                    state === "correct"
                      ? "var(--qd-good-bg)"
                      : state === "incorrect"
                        ? "var(--qd-bad-bg)"
                        : "var(--qd-panel-2)",
                  color:
                    state === "correct"
                      ? "var(--qd-good)"
                      : state === "incorrect"
                        ? "var(--qd-bad)"
                        : "var(--qd-text-dim)",
                }}
              >
                {slot.position + 1}
                {slot.bookmarked ? (
                  <span
                    className="absolute -top-1.5 -right-1 text-[9px] text-[var(--qd-amber)]"
                    aria-hidden="true"
                  >
                    ★
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 text-right">
        <button
          type="button"
          onClick={finish}
          disabled={pending}
          className="text-sm text-[var(--qd-text-dim)] underline hover:text-[var(--qd-text)] disabled:opacity-40"
        >
          {pending ? "Scoring…" : "Finish and see results"}
        </button>
      </div>
    </div>
  );
}
