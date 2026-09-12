"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  abandonAttempt,
  finishAttempt,
  pauseAttempt,
  resumeAttempt,
  submitResponse,
  toggleBookmark,
} from "@/server/actions/attempts";
import { formatClock, remainingSeconds } from "@/lib/quiz/examTimer";

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

type TimerState = {
  status: "IN_PROGRESS" | "PAUSED";
  startedAt: string;
  pausedAt: string | null;
  pausedSeconds: number;
  timeLimitSeconds: number;
};

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

function matchesDomain(slot: Slot, selectedDomains: Set<string>): boolean {
  return selectedDomains.has(slot.domainName);
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
  timer: initialTimer,
}: {
  attemptId: string;
  certCode: string;
  certName: string;
  domainNames: string[];
  slots: Slot[];
  /** Present only for TIMED_EXAM attempts — every other mode is untimed. */
  timer: TimerState | null;
}) {
  const [slots, setSlots] = useState(initialSlots);
  const [timer, setTimer] = useState(initialTimer);
  const [, forceTick] = useState(0);
  const finishedRef = useRef(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(() => new Set(domainNames));
  const [domainMenuOpen, setDomainMenuOpen] = useState(false);
  const domainMenuRef = useRef<HTMLDivElement>(null);
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
        const saved = JSON.parse(raw) as {
          currentIndex?: number;
          filter?: Filter;
          selectedDomains?: string[];
        };
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
        if (Array.isArray(saved.selectedDomains)) {
          const valid = saved.selectedDomains.filter((d) => domainNames.includes(d));
          if (valid.length > 0) setSelectedDomains(new Set(valid));
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
      localStorage.setItem(
        storageKey(attemptId),
        JSON.stringify({ currentIndex, filter, selectedDomains: [...selectedDomains] }),
      );
    } catch {
      // Ignore — this is a convenience, not the source of truth.
    }
  }, [attemptId, currentIndex, filter, selectedDomains, hydrated]);

  // Tick the countdown once a second while the exam is running, and
  // auto-finish the instant it reaches zero. Remaining time is always
  // re-derived from timer state, never accumulated client-side, so this
  // effect only needs to force a re-render — it never mutates the numbers
  // the countdown is based on.
  useEffect(() => {
    if (!timer || timer.status !== "IN_PROGRESS") return;
    const interval = setInterval(() => {
      const remaining = remainingSeconds(
        {
          status: timer.status,
          startedAt: new Date(timer.startedAt),
          pausedAt: timer.pausedAt ? new Date(timer.pausedAt) : null,
          pausedSeconds: timer.pausedSeconds,
        },
        timer.timeLimitSeconds,
        new Date(),
      );
      if (remaining !== null && remaining <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        finish();
        return;
      }
      forceTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer]);

  // Close the domain dropdown on an outside click.
  useEffect(() => {
    if (!domainMenuOpen) return;
    function handleClick(event: MouseEvent) {
      if (domainMenuRef.current && !domainMenuRef.current.contains(event.target as Node)) {
        setDomainMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [domainMenuOpen]);

  function computeFilteredIndices(nextFilter: Filter, nextDomains: Set<string>) {
    return order.filter(
      (i) => matchesFilter(slots[i]!, nextFilter) && matchesDomain(slots[i]!, nextDomains),
    );
  }

  const filteredIndices = computeFilteredIndices(filter, selectedDomains);

  const posInFiltered = filteredIndices.indexOf(currentIndex);
  const current = posInFiltered >= 0 ? slots[currentIndex] : undefined;

  function selectFilter(next: Filter) {
    setFilter(next);
    setSelected(null);
    const nextFiltered = computeFilteredIndices(next, selectedDomains);
    if (!nextFiltered.includes(currentIndex) && nextFiltered.length > 0) {
      setCurrentIndex(nextFiltered[0]!);
    }
  }

  function applyDomains(next: Set<string>) {
    setSelectedDomains(next);
    setSelected(null);
    const nextFiltered = computeFilteredIndices(filter, next);
    if (!nextFiltered.includes(currentIndex) && nextFiltered.length > 0) {
      setCurrentIndex(nextFiltered[0]!);
    }
  }

  function toggleDomain(name: string) {
    const next = new Set(selectedDomains);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    if (next.size > 0) applyDomains(next);
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

  function pause() {
    if (pending || !timer) return;
    startTransition(async () => {
      await pauseAttempt({ attemptId });
      setTimer((prev) =>
        prev ? { ...prev, status: "PAUSED", pausedAt: new Date().toISOString() } : prev,
      );
    });
  }

  function resume() {
    if (pending || !timer?.pausedAt) return;
    startTransition(async () => {
      await resumeAttempt({ attemptId });
      setTimer((prev) => {
        if (!prev || !prev.pausedAt) return prev;
        const elapsed = (Date.now() - new Date(prev.pausedAt).getTime()) / 1000;
        return {
          ...prev,
          status: "IN_PROGRESS",
          pausedAt: null,
          pausedSeconds: prev.pausedSeconds + elapsed,
        };
      });
    });
  }

  const remaining = timer
    ? remainingSeconds(
        {
          status: timer.status,
          startedAt: new Date(timer.startedAt),
          pausedAt: timer.pausedAt ? new Date(timer.pausedAt) : null,
          pausedSeconds: timer.pausedSeconds,
        },
        timer.timeLimitSeconds,
        new Date(),
      )
    : null;
  const isPaused = timer?.status === "PAUSED";

  return (
    <div>
      {timer ? (
        <div
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
          style={{
            borderColor: isPaused
              ? "var(--qd-amber)"
              : remaining !== null && remaining < 300
                ? "var(--qd-bad)"
                : "var(--qd-border)",
            background: "var(--qd-panel)",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-2xl leading-none font-bold tabular-nums"
              style={{
                color: isPaused
                  ? "var(--qd-amber)"
                  : remaining !== null && remaining < 300
                    ? "var(--qd-bad)"
                    : "var(--qd-text)",
              }}
            >
              {formatClock(remaining ?? 0)}
            </span>
            <span className="font-mono text-[11px] tracking-widest text-[var(--qd-text-dim)] uppercase">
              {isPaused ? "Paused" : "Time remaining"}
            </span>
          </div>
          <button
            type="button"
            onClick={isPaused ? resume : pause}
            disabled={pending}
            className="rounded-md border border-[var(--qd-border)] px-3.5 py-1.5 font-mono text-[12px] font-semibold text-[var(--qd-text)] hover:border-[var(--qd-text-dim)] disabled:opacity-40"
          >
            {isPaused ? "▶ Resume" : "⏸ Pause"}
          </button>
        </div>
      ) : null}

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

        {domainNames.length > 1 ? (
          <div className="relative" ref={domainMenuRef}>
            <button
              type="button"
              onClick={() => setDomainMenuOpen((open) => !open)}
              className={`rounded-md border px-2.5 py-1.5 font-mono text-[12px] ${
                selectedDomains.size < domainNames.length
                  ? "border-[var(--qd-accent)] bg-[var(--qd-accent-dim)] text-[var(--qd-accent)]"
                  : "border-[var(--qd-border)] text-[var(--qd-text-dim)] hover:border-[var(--qd-text-dim)] hover:text-[var(--qd-text)]"
              }`}
            >
              Curriculum
              {selectedDomains.size < domainNames.length
                ? ` (${selectedDomains.size}/${domainNames.length})`
                : ""}{" "}
              ▾
            </button>

            {domainMenuOpen ? (
              <div className="absolute top-full left-0 z-10 mt-1.5 w-72 rounded-lg border border-[var(--qd-border)] bg-[var(--qd-panel)] p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => applyDomains(new Set(domainNames))}
                  className="mb-1 w-full rounded px-2 py-1 text-left font-mono text-[11px] text-[var(--qd-accent)] hover:bg-[var(--qd-panel-2)]"
                >
                  Select all
                </button>
                <div className="max-h-64 space-y-0.5 overflow-y-auto">
                  {domainNames.map((name) => (
                    <label
                      key={name}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-[var(--qd-text)] hover:bg-[var(--qd-panel-2)]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDomains.has(name)}
                        onChange={() => toggleDomain(name)}
                        className="accent-[var(--qd-accent)]"
                      />
                      {name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

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

      <div className="relative">
        {isPaused ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-[var(--qd-panel)]/90 backdrop-blur-sm">
            <div className="text-center">
              <p className="font-display text-lg text-[var(--qd-text)]">Paused</p>
              <p className="mt-2 text-sm text-[var(--qd-text-dim)]">
                The clock is stopped. Resume to keep going.
              </p>
              <button
                type="button"
                onClick={resume}
                disabled={pending}
                className="mt-4 rounded-md bg-[var(--qd-indigo)] px-5 py-2.5 font-semibold text-white disabled:opacity-40"
              >
                ▶ Resume
              </button>
            </div>
          </div>
        ) : null}

        <div
          aria-hidden={isPaused}
          style={isPaused ? { pointerEvents: "none", userSelect: "none" } : undefined}
        >
          <div className="mb-6 rounded-xl border border-[var(--qd-border)] bg-[var(--qd-panel)] p-3.5">
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
                    const isAnswer =
                      current.response?.correctOptionIds.includes(option.id) ?? false;
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
