import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ContestantAvatar } from '../components/ContestantAvatar';
import { ensureBallotId } from '../lib/ballotCookie';
import { getDataStore } from '../lib/dataStore';
import type { ContestBundle, Contestant } from '../lib/types';

type Phase = 'loading' | 'voting' | 'done' | 'closed' | 'empty';

function buildSelectionsFromVotes(
  votes: { categoryId?: string | null; contestantId: string; round?: number | null }[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const vote of votes) {
    if (!vote.categoryId) continue;
    if (vote.round != null && vote.round > 0) continue;
    map[vote.categoryId] = vote.contestantId;
  }
  return map;
}

function completeFlagKey(ballotId: string, round?: number): string {
  if (round != null) return `costume_ballot_complete_${ballotId}_r${round}`;
  return `costume_ballot_complete_${ballotId}`;
}

function isBallotMarkedComplete(ballotId: string, round?: number): boolean {
  return localStorage.getItem(completeFlagKey(ballotId, round)) === '1';
}

function markBallotComplete(ballotId: string, round?: number): void {
  localStorage.setItem(completeFlagKey(ballotId, round), '1');
}

function clearBallotComplete(ballotId: string, round?: number): void {
  localStorage.removeItem(completeFlagKey(ballotId, round));
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

/** Contestants still free on this ballot (ignores other voters). */
function availableForCategory(
  categoryId: string,
  contestants: ContestBundle['contestants'],
  selections: Record<string, string>,
): ContestBundle['contestants'] {
  const taken = new Set<string>();
  for (const [id, contestantId] of Object.entries(selections)) {
    if (id === categoryId) continue;
    taken.add(contestantId);
  }
  return contestants.filter((c) => !taken.has(c.id));
}

function ClassicBallot({
  bundle,
  ballotId,
  initialSelections,
  initiallyComplete,
}: {
  bundle: ContestBundle;
  ballotId: string;
  initialSelections: Record<string, string>;
  initiallyComplete: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(
    initiallyComplete
      ? 'done'
      : bundle.contest.isOpen
        ? 'voting'
        : 'closed',
  );
  const [step, setStep] = useState(() =>
    firstOpenStep(bundle.categories, initialSelections, new Set()),
  );
  const [selections, setSelections] =
    useState<Record<string, string>>(initialSelections);
  const [skipped, setSkipped] = useState<Set<string>>(() => {
    if (!initiallyComplete) return new Set();
    return new Set(
      bundle.categories
        .filter((category) => !initialSelections[category.id])
        .map((category) => category.id),
    );
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  const categories = bundle.categories;
  const contestants = bundle.contestants;
  const currentCategory = categories[step];

  const takenContestantIds = useMemo(() => {
    const taken = new Set<string>();
    for (const [categoryId, contestantId] of Object.entries(selections)) {
      if (currentCategory && categoryId === currentCategory.id) continue;
      taken.add(contestantId);
    }
    return taken;
  }, [selections, currentCategory]);

  const availableContestants = contestants.filter(
    (c) => !takenContestantIds.has(c.id),
  );

  const ballotResolved =
    categories.length > 0 &&
    categories.every(
      (category) =>
        Boolean(selections[category.id]) || skipped.has(category.id),
    );

  async function persistSelections(next: Record<string, string>) {
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

  function advanceFrom(
    stepIndex: number,
    nextSkipped: Set<string>,
    nextSelections: Record<string, string>,
  ) {
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
        nextSelections,
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
    if (!currentCategory) return;
    if (takenContestantIds.has(contestantId)) return;

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
    if (!currentCategory) return;

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
    const nextSkipped = new Set(skipped);
    for (const category of categories) {
      if (!selections[category.id]) nextSkipped.add(category.id);
    }
    setSkipped(nextSkipped);
    finishBallot();
  }

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
    if (!bundle.contest.isOpen) {
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
                  <strong className="summary-with-avatar">
                    {contestant && (
                      <ContestantAvatar
                        name={contestant.name}
                        imageKey={contestant.imageKey}
                        size="sm"
                      />
                    )}
                    {contestant?.name ?? '—'}
                  </strong>
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
                <strong className="summary-with-avatar">
                  {contestant && (
                    <ContestantAvatar
                      name={contestant.name}
                      imageKey={contestant.imageKey}
                      size="sm"
                    />
                  )}
                  {wasSkipped ? 'Skipped' : contestant?.name ?? '—'}
                </strong>
              </li>
            );
          })}
        </ul>
        <div className="actions">
          {bundle.contest.isOpen && (
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
        <p className="eyebrow">{bundle.contest.name}</p>
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
                const selected =
                  selections[currentCategory.id] === contestant.id;
                return (
                  <li key={contestant.id}>
                    <button
                      type="button"
                      className={selected ? 'choice selected' : 'choice'}
                      onClick={() => selectContestant(contestant.id)}
                      disabled={saving}
                    >
                      <ContestantAvatar
                        name={contestant.name}
                        imageKey={contestant.imageKey}
                        size="lg"
                      />
                      <span>{contestant.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
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
              disabled={
                saving ||
                (!hasSelection && !noContestantsLeft && !ballotResolved)
              }
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

function RoundBallot({
  bundle,
  ballotId,
  round,
  eligible,
  initialContestantId,
  initiallyComplete,
}: {
  bundle: ContestBundle;
  ballotId: string;
  round: number;
  eligible: Contestant[];
  initialContestantId: string | null;
  initiallyComplete: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(
    initiallyComplete
      ? 'done'
      : bundle.contest.isOpen
        ? 'voting'
        : 'closed',
  );
  const [selection, setSelection] = useState<string | null>(initialContestantId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  const selectedContestant = eligible.find((c) => c.id === selection) ?? null;

  async function persist(contestantId: string | null) {
    setSaving(true);
    setError(null);
    try {
      await getDataStore().saveRoundVote({
        ballotId,
        contestId: bundle.contest.id,
        round,
        contestantId,
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
    setSelection(contestantId);
    void persist(contestantId);
  }

  function finish() {
    if (!selection) return;
    markBallotComplete(ballotId, round);
    setPhase('done');
  }

  async function changeVote() {
    if (!bundle.contest.isOpen) {
      setPhase('closed');
      return;
    }
    clearBallotComplete(ballotId, round);
    setPhase('voting');
    setError(null);
  }

  if (phase === 'closed') {
    return (
      <main className="page">
        <h1 className="brand">Costume Contest</h1>
        <p className="lede">
          Round {round} voting is closed
          {round === 1 ? '. Wait for the final round.' : '.'}
        </p>
        {selectedContestant && (
          <ul className="ballot-summary">
            <li>
              <span>Your pick</span>
              <strong className="summary-with-avatar">
                <ContestantAvatar
                  name={selectedContestant.name}
                  imageKey={selectedContestant.imageKey}
                  size="sm"
                />
                {selectedContestant.name}
              </strong>
            </li>
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
        <p className="eyebrow">Round {round} saved</p>
        <h1 className="brand">Thanks for voting!</h1>
        <p className="lede">
          {round === 1
            ? 'Your Round 1 pick is in. Come back when the final round opens.'
            : 'Your final pick is locked to this browser.'}
        </p>
        {selectedContestant && (
          <ul className="ballot-summary">
            <li>
              <span>Your pick</span>
              <strong className="summary-with-avatar">
                <ContestantAvatar
                  name={selectedContestant.name}
                  imageKey={selectedContestant.imageKey}
                  size="sm"
                />
                {selectedContestant.name}
              </strong>
            </li>
          </ul>
        )}
        <div className="actions">
          {bundle.contest.isOpen && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void changeVote()}
            >
              Change my vote
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
        <p className="eyebrow">
          {bundle.contest.name} · Round {round}
        </p>
        <h1 className="brand">
          {round === 1 ? 'Pick your favorite' : 'Pick the winner'}
        </h1>
        <p className="lede">
          {round === 1
            ? 'Choose one costume. The top three advance to the final.'
            : 'Only the finalists remain. Everyone votes again from scratch.'}
          {saveFlash && <span className="save-flash"> · Saved</span>}
          {saving && !saveFlash && <span className="muted"> · Saving…</span>}
        </p>
      </header>

      {eligible.length === 0 ? (
        <p className="muted">No contestants available for this round.</p>
      ) : (
        <ul className="choice-list round-choice-list">
          {eligible.map((contestant) => {
            const selected = selection === contestant.id;
            return (
              <li key={contestant.id}>
                <button
                  type="button"
                  className={selected ? 'choice selected' : 'choice'}
                  onClick={() => selectContestant(contestant.id)}
                  disabled={saving}
                >
                  <ContestantAvatar
                    name={contestant.name}
                    imageKey={contestant.imageKey}
                    size="xl"
                  />
                  <span>{contestant.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="error">{error}</p>}

      <div className="actions sticky-actions">
        <span />
        <button
          type="button"
          className="btn btn-primary"
          onClick={finish}
          disabled={!selection || saving}
        >
          Finish
        </button>
      </div>
    </main>
  );
}

export function VotePage() {
  const [bundle, setBundle] = useState<ContestBundle | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [classicSelections, setClassicSelections] = useState<
    Record<string, string>
  >({});
  const [classicComplete, setClassicComplete] = useState(false);
  const [roundSelection, setRoundSelection] = useState<string | null>(null);
  const [roundComplete, setRoundComplete] = useState(false);
  const ballotId = useMemo(() => ensureBallotId(), []);

  useEffect(() => {
    let cancelled = false;

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
        const existingVotes = await store.getVotesForBallot(ballotId);
        if (cancelled) return;

        if (active.contest.votingSystem === 'multiRound') {
          const round = active.contest.currentRound;
          const roundVote = existingVotes.find((v) => v.round === round);
          setRoundSelection(roundVote?.contestantId ?? null);
          setRoundComplete(isBallotMarkedComplete(ballotId, round));
          if (!active.contest.isOpen && !roundVote) {
            setPhase('closed');
            return;
          }
          setPhase('voting');
          return;
        }

        const map = buildSelectionsFromVotes(existingVotes);
        setClassicSelections(map);
        const complete = isBallotMarkedComplete(ballotId);
        setClassicComplete(complete);

        if (complete) {
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
    };
  }, [ballotId]);

  if (phase === 'loading') {
    return (
      <main className="page">
        <p className="muted">Loading the contest…</p>
      </main>
    );
  }

  if (phase === 'empty' || !bundle) {
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

  if (bundle.contest.votingSystem === 'multiRound') {
    if (phase === 'closed') {
      return (
        <main className="page">
          <h1 className="brand">Costume Contest</h1>
          <p className="lede">
            Round {bundle.contest.currentRound} voting is closed for now.
          </p>
          <Link className="text-link" to="/results">
            See live results
          </Link>
        </main>
      );
    }

    const round = bundle.contest.currentRound;
    const eligible =
      round === 2
        ? bundle.contestants.filter((c) =>
            bundle.contest.finalistIds.includes(c.id),
          )
        : bundle.contestants;

    return (
      <RoundBallot
        key={`round-${round}-${bundle.contest.isOpen}`}
        bundle={bundle}
        ballotId={ballotId}
        round={round}
        eligible={eligible}
        initialContestantId={roundSelection}
        initiallyComplete={roundComplete}
      />
    );
  }

  if (phase === 'closed' && !classicComplete) {
    return (
      <main className="page">
        <h1 className="brand">Costume Contest</h1>
        <p className="lede">Voting is closed for now.</p>
        <Link className="text-link" to="/results">
          See live results
        </Link>
      </main>
    );
  }

  return (
    <ClassicBallot
      key={bundle.contest.id}
      bundle={bundle}
      ballotId={ballotId}
      initialSelections={classicSelections}
      initiallyComplete={classicComplete}
    />
  );
}
