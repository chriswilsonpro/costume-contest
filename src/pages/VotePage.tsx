import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ensureBallotId } from '../lib/ballotCookie';
import { getDataStore } from '../lib/dataStore';
import { winnersOfEarlierCategories } from '../lib/rankings';
import type { ContestBundle, Vote } from '../lib/types';

type Phase = 'loading' | 'voting' | 'done' | 'closed' | 'empty';

function buildSelectionsFromVotes(
  votes: { categoryId: string; contestantId: string }[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const vote of votes) {
    map[vote.categoryId] = vote.contestantId;
  }
  return map;
}

function completeFlagKey(ballotId: string): string {
  return `costume_ballot_complete_${ballotId}`;
}

function isBallotMarkedComplete(ballotId: string): boolean {
  return localStorage.getItem(completeFlagKey(ballotId)) === '1';
}

function markBallotComplete(ballotId: string): void {
  localStorage.setItem(completeFlagKey(ballotId), '1');
}

function clearBallotComplete(ballotId: string): void {
  localStorage.removeItem(completeFlagKey(ballotId));
}

function firstOpenStep(
  categories: { id: string }[],
  selections: Record<string, string>,
  skipped: Set<string>,
): number {
  const index = categories.findIndex(
    (category) => !selections[category.id] && !skipped.has(category.id),
  );
  return index >= 0 ? index : Math.max(categories.length - 1, 0);
}

/** Drop picks that violate the one-win-per-contestant rule given live totals. */
function pruneIneligibleSelections(
  categories: ContestBundle['categories'],
  contestants: ContestBundle['contestants'],
  liveVotes: Vote[],
  selections: Record<string, string>,
): Record<string, string> {
  const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const next = { ...selections };
  let changed = false;

  for (const category of ordered) {
    const selectedId = next[category.id];
    if (!selectedId) continue;
    const blocked = winnersOfEarlierCategories(
      categories,
      contestants,
      liveVotes,
      category.id,
    );
    if (blocked.has(selectedId)) {
      delete next[category.id];
      changed = true;
    }
  }

  return changed ? next : selections;
}

function availableForCategory(
  categoryId: string,
  contestants: ContestBundle['contestants'],
  categories: ContestBundle['categories'],
  selections: Record<string, string>,
  liveVotes: Vote[],
): ContestBundle['contestants'] {
  const blocked = winnersOfEarlierCategories(
    categories,
    contestants,
    liveVotes,
    categoryId,
  );
  const taken = new Set<string>();
  for (const [id, contestantId] of Object.entries(selections)) {
    if (id === categoryId) continue;
    taken.add(contestantId);
  }
  return contestants.filter((c) => !taken.has(c.id) && !blocked.has(c.id));
}

export function VotePage() {
  const [bundle, setBundle] = useState<ContestBundle | null>(null);
  const [liveVotes, setLiveVotes] = useState<Vote[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const ballotId = useMemo(() => ensureBallotId(), []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    async function load() {
      try {
        const store = getDataStore();
        const active = await store.getActiveContest();
        if (cancelled) return;

        if (!active) {
          setPhase('empty');
          return;
        }

        setBundle(active);
        unsubscribe = store.subscribeVotes(active.contest.id, (votes) => {
          if (!cancelled) setLiveVotes(votes);
        });

        const existingVotes = await store.getVotesForBallot(ballotId);
        if (cancelled) return;

        if (existingVotes.length > 0 || isBallotMarkedComplete(ballotId)) {
          const map = buildSelectionsFromVotes(existingVotes);
          setSelections(map);

          if (isBallotMarkedComplete(ballotId)) {
            // Mark unvoted categories as skipped for the summary.
            const skippedIds = new Set(
              active.categories
                .filter((category) => !map[category.id])
                .map((category) => category.id),
            );
            setSkipped(skippedIds);
            setPhase('done');
            return;
          }

          if (!active.contest.isOpen) {
            setPhase('closed');
            return;
          }

          setStep(firstOpenStep(active.categories, map, new Set()));
          setPhase('voting');
          return;
        }

        if (!active.contest.isOpen) {
          setPhase('closed');
          return;
        }

        setPhase('voting');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load contest');
          setPhase('empty');
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [ballotId]);

  // Clear ballot picks that became illegal as live leaders shift.
  useEffect(() => {
    if (!bundle || phase !== 'voting') return;
    const pruned = pruneIneligibleSelections(
      bundle.categories,
      bundle.contestants,
      liveVotes,
      selections,
    );
    if (pruned === selections) return;
    setSelections(pruned);
    void (async () => {
      try {
        await getDataStore().saveBallotVotes({
          ballotId,
          contestId: bundle.contest.id,
          selections: pruned,
        });
      } catch {
        // Keep UI state; next user action can retry.
      }
    })();
  }, [bundle, liveVotes, phase, selections, ballotId]);

  const categories = bundle?.categories ?? [];
  const contestants = bundle?.contestants ?? [];
  const currentCategory = categories[step];

  const blockedByEarlierWin = useMemo(() => {
    if (!currentCategory || !bundle) {
      return new Map<string, { categoryId: string; categoryName: string }>();
    }
    return winnersOfEarlierCategories(
      bundle.categories,
      bundle.contestants,
      liveVotes,
      currentCategory.id,
    );
  }, [bundle, liveVotes, currentCategory]);

  const takenContestantIds = useMemo(() => {
    const taken = new Set<string>();
    for (const [categoryId, contestantId] of Object.entries(selections)) {
      if (currentCategory && categoryId === currentCategory.id) continue;
      taken.add(contestantId);
    }
    return taken;
  }, [selections, currentCategory]);

  const availableContestants = contestants.filter(
    (c) => !takenContestantIds.has(c.id) && !blockedByEarlierWin.has(c.id),
  );

  const blockedContestants = contestants.filter((c) =>
    blockedByEarlierWin.has(c.id),
  );

  const ballotResolved =
    categories.length > 0 &&
    categories.every(
      (category) =>
        Boolean(selections[category.id]) || skipped.has(category.id),
    );

  async function persistSelections(next: Record<string, string>) {
    if (!bundle) return;
    setSaving(true);
    setError(null);
    try {
      await getDataStore().saveBallotVotes({
        ballotId,
        contestId: bundle.contest.id,
        selections: next,
      });
      setSaveFlash(true);
      window.setTimeout(() => setSaveFlash(false), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save vote');
    } finally {
      setSaving(false);
    }
  }

  function finishBallot() {
    markBallotComplete(ballotId);
    setPhase('done');
  }

  function advanceFrom(stepIndex: number, nextSkipped: Set<string>, nextSelections: Record<string, string>) {
    if (!bundle) return;

    // Auto-skip remaining categories that have nobody left to pick.
    let index = stepIndex + 1;
    const autoSkipped = new Set(nextSkipped);
    while (index < categories.length) {
      const category = categories[index];
      if (nextSelections[category.id] || autoSkipped.has(category.id)) {
        index += 1;
        continue;
      }
      const available = availableForCategory(
        category.id,
        contestants,
        categories,
        nextSelections,
        liveVotes,
      );
      if (available.length === 0) {
        autoSkipped.add(category.id);
        index += 1;
        continue;
      }
      break;
    }

    setSkipped(autoSkipped);

    if (index >= categories.length) {
      finishBallot();
      return;
    }

    setStep(index);
  }

  function selectContestant(contestantId: string) {
    if (!currentCategory || !bundle) return;
    if (blockedByEarlierWin.has(contestantId)) return;

    const next: Record<string, string> = {
      ...selections,
      [currentCategory.id]: contestantId,
    };
    for (const [categoryId, selectedId] of Object.entries(next)) {
      if (categoryId !== currentCategory.id && selectedId === contestantId) {
        delete next[categoryId];
      }
    }

    const nextSkipped = new Set(skipped);
    nextSkipped.delete(currentCategory.id);

    setSelections(next);
    setSkipped(nextSkipped);
    void persistSelections(next);
  }

  function skipCategory() {
    if (!currentCategory || !bundle) return;

    const nextSelections = { ...selections };
    delete nextSelections[currentCategory.id];
    const nextSkipped = new Set(skipped);
    nextSkipped.add(currentCategory.id);

    setSelections(nextSelections);
    setSkipped(nextSkipped);
    void persistSelections(nextSelections);
    advanceFrom(step, nextSkipped, nextSelections);
  }

  function goNext() {
    if (!currentCategory || !selections[currentCategory.id]) return;
    advanceFrom(step, skipped, selections);
  }

  function goBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  function finish() {
    if (!ballotResolved && availableContestants.length > 0) return;
    // Mark any still-open empty categories as skipped.
    const nextSkipped = new Set(skipped);
    for (const category of categories) {
      if (!selections[category.id]) nextSkipped.add(category.id);
    }
    setSkipped(nextSkipped);
    finishBallot();
  }

  // If the current category has no one left, skip it automatically.
  useEffect(() => {
    if (phase !== 'voting' || !currentCategory || saving) return;
    if (availableContestants.length > 0) return;
    if (selections[currentCategory.id]) return;
    if (skipped.has(currentCategory.id)) return;

    const nextSkipped = new Set(skipped);
    nextSkipped.add(currentCategory.id);
    setSkipped(nextSkipped);
    advanceFrom(step, nextSkipped, selections);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to empty availability
  }, [
    phase,
    currentCategory?.id,
    availableContestants.length,
    saving,
    skipped,
    selections,
    step,
  ]);

  async function changeVotes() {
    if (!bundle?.contest.isOpen) {
      setPhase('closed');
      return;
    }
    clearBallotComplete(ballotId);
    setSelections({});
    setSkipped(new Set());
    setStep(0);
    setPhase('voting');
    setError(null);
    try {
      await getDataStore().saveBallotVotes({
        ballotId,
        contestId: bundle.contest.id,
        selections: {},
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset ballot');
    }
  }

  if (phase === 'loading') {
    return (
      <main className="page">
        <p className="muted">Loading the contest…</p>
      </main>
    );
  }

  if (phase === 'empty') {
    return (
      <main className="page">
        <h1 className="brand">Costume Contest</h1>
        <p className="lede">No contest is set up yet.</p>
        {error && <p className="error">{error}</p>}
        <p className="muted">
          Ask the host to open the <Link to="/admin">admin page</Link> and add
          contestants.
        </p>
      </main>
    );
  }

  if (phase === 'closed') {
    return (
      <main className="page">
        <h1 className="brand">Costume Contest</h1>
        <p className="lede">Voting is closed for now.</p>
        {Object.keys(selections).length > 0 && (
          <ul className="ballot-summary">
            {categories.map((category) => {
              const contestant = contestants.find(
                (c) => c.id === selections[category.id],
              );
              return (
                <li key={category.id}>
                  <span>{category.name}</span>
                  <strong>{contestant?.name ?? '—'}</strong>
                </li>
              );
            })}
          </ul>
        )}
        <Link className="text-link" to="/results">
          See live results
        </Link>
      </main>
    );
  }

  if (phase === 'done') {
    return (
      <main className="page">
        <p className="eyebrow">Ballot saved</p>
        <h1 className="brand">Thanks for voting!</h1>
        <p className="lede">
          Your picks are locked to this browser. You can still change them while
          voting is open.
        </p>
        <ul className="ballot-summary">
          {categories.map((category) => {
            const contestant = contestants.find(
              (c) => c.id === selections[category.id],
            );
            const wasSkipped = skipped.has(category.id) && !contestant;
            return (
              <li key={category.id}>
                <span>{category.name}</span>
                <strong>{wasSkipped ? 'Skipped' : contestant?.name ?? '—'}</strong>
              </li>
            );
          })}
        </ul>
        <div className="actions">
          {bundle?.contest.isOpen && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void changeVotes()}
            >
              Change my votes
            </button>
          )}
          <Link className="btn btn-primary" to="/results">
            Watch live results
          </Link>
        </div>
      </main>
    );
  }

  const isLastStep = step >= categories.length - 1;
  const hasSelection = Boolean(currentCategory && selections[currentCategory.id]);
  const noContestantsLeft = availableContestants.length === 0;
  const allowSkip = categories.length > contestants.length;

  return (
    <main className="page vote-page">
      <header className="vote-header">
        <p className="eyebrow">{bundle?.contest.name}</p>
        <h1 className="brand">Cast your votes</h1>
        <p className="lede">
          Each costume can only win one category.
          {allowSkip
            ? ' You can skip a category if you want — and once everyone has been picked, the rest are skipped for you.'
            : ' Once a costume is picked, it can’t be chosen again on your ballot.'}
        </p>
      </header>

      <div className="progress" aria-hidden="true">
        {categories.map((category, index) => (
          <span
            key={category.id}
            className={
              index === step
                ? 'progress-dot active'
                : selections[category.id]
                  ? 'progress-dot filled'
                  : skipped.has(category.id)
                    ? 'progress-dot skipped'
                    : 'progress-dot'
            }
          />
        ))}
      </div>

      {currentCategory && (
        <section className="category-panel" key={currentCategory.id}>
          <p className="step-label">
            Category {step + 1} of {categories.length}
            {saveFlash && <span className="save-flash"> · Saved</span>}
            {saving && !saveFlash && <span className="muted"> · Saving…</span>}
          </p>
          <h2>{currentCategory.name}</h2>
          {noContestantsLeft ? (
            <p className="muted">
              No contestants left for this category — skipping…
            </p>
          ) : (
            <ul className="choice-list">
              {availableContestants.map((contestant) => {
                const selected = selections[currentCategory.id] === contestant.id;
                return (
                  <li key={contestant.id}>
                    <button
                      type="button"
                      className={selected ? 'choice selected' : 'choice'}
                      onClick={() => selectContestant(contestant.id)}
                      disabled={saving}
                    >
                      {contestant.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {blockedContestants.length > 0 && (
            <p className="muted blocked-note">
              Already winning earlier:{' '}
              {blockedContestants
                .map((c) => {
                  const win = blockedByEarlierWin.get(c.id);
                  return `${c.name} (${win?.categoryName ?? 'earlier'})`;
                })
                .join(', ')}
            </p>
          )}
        </section>
      )}

      {error && <p className="error">{error}</p>}

      <div className="actions sticky-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={goBack}
          disabled={step === 0}
        >
          Back
        </button>
        <div className="actions">
          {allowSkip && !noContestantsLeft && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={skipCategory}
              disabled={saving}
            >
              Skip
            </button>
          )}
          {isLastStep || ballotResolved ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={finish}
              disabled={saving || (!hasSelection && !noContestantsLeft && !ballotResolved)}
            >
              Finish
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={goNext}
              disabled={!hasSelection || saving}
            >
              Next category
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
