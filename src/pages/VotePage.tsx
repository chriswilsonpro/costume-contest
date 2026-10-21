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

function firstIncompleteStep(
  categories: { id: string }[],
  selections: Record<string, string>,
): number {
  const index = categories.findIndex((category) => !selections[category.id]);
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

export function VotePage() {
  const [bundle, setBundle] = useState<ContestBundle | null>(null);
  const [liveVotes, setLiveVotes] = useState<Vote[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
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

        if (existingVotes.length > 0) {
          const map = buildSelectionsFromVotes(existingVotes);
          setSelections(map);
          const complete = active.categories.every((category) =>
            Boolean(map[category.id]),
          );

          if (complete) {
            setPhase('done');
            return;
          }

          if (!active.contest.isOpen) {
            setPhase('closed');
            return;
          }

          setStep(firstIncompleteStep(active.categories, map));
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

  const allSelected =
    categories.length > 0 &&
    categories.every((category) => Boolean(selections[category.id]));

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

    setSelections(next);
    void persistSelections(next);
  }

  function goNext() {
    if (step < categories.length - 1) setStep((s) => s + 1);
  }

  function goBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  function finish() {
    if (!allSelected) return;
    setPhase('done');
  }

  async function changeVotes() {
    if (!bundle?.contest.isOpen) {
      setPhase('closed');
      return;
    }
    // Start over from category 1 with a blank ballot so every contestant
    // is selectable again (aside from live exclusive winners).
    setSelections({});
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
            return (
              <li key={category.id}>
                <span>{category.name}</span>
                <strong>{contestant?.name ?? '—'}</strong>
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

  return (
    <main className="page vote-page">
      <header className="vote-header">
        <p className="eyebrow">{bundle?.contest.name}</p>
        <h1 className="brand">Cast your votes</h1>
        <p className="lede">
          Each costume can only win one category. If someone is leading an earlier
          award, they drop out of the later ones — on your ballot and on the live
          board.
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
          {availableContestants.length === 0 ? (
            <p className="muted">No contestants left for this category.</p>
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
        {step < categories.length - 1 ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={goNext}
            disabled={!currentCategory || !selections[currentCategory.id] || saving}
          >
            Next category
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={finish}
            disabled={!allSelected || saving}
          >
            Finish
          </button>
        )}
      </div>
    </main>
  );
}
