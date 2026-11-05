import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { ConfirmModal } from '../components/ConfirmModal';
import { ContestantAvatar } from '../components/ContestantAvatar';
import { isAdminUnlocked, lockAdmin, unlockAdmin } from '../lib/adminAuth';
import { getDataStore } from '../lib/dataStore';
import { prepareImageUpload, useImageUrl } from '../lib/media';
import {
  computeFinalists,
  rankRound,
} from '../lib/multiRound';
import type {
  ContestBundle,
  ResultsBackground,
  ThemeColor,
  ThemeFont,
  ThemeSize,
  Vote,
  VotingSystem,
} from '../lib/types';
import {
  RESULTS_BACKGROUND_PRESETS,
  THEME_COLOR_PRESETS,
  THEME_FONT_OPTIONS,
  THEME_SIZE_OPTIONS,
} from '../lib/types';

type PendingDelete = { id: string; name: string };

function BackgroundPreview({
  kind,
  imageKey,
}: {
  kind: ResultsBackground;
  imageKey?: string | null;
}) {
  const url = useImageUrl(kind === 'custom' ? imageKey : null);
  if (kind === 'custom' && url) {
    return (
      <div className="bg-preview custom">
        <img src={url} alt="" />
      </div>
    );
  }
  if (kind === 'plain') {
    return (
      <div className="bg-preview plain" aria-hidden="true">
        <span>Plain</span>
      </div>
    );
  }
  return (
    <div className="bg-preview halloween" aria-hidden="true">
      <span>Halloween night</span>
    </div>
  );
}

export function AdminPage() {
  const [unlocked, setUnlocked] = useState(isAdminUnlocked());
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<ContestBundle | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [contestName, setContestName] = useState('Halloween Costume Contest');
  const [newContestant, setNewContestant] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragCategoryId, setDragCategoryId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [editingContestantId, setEditingContestantId] = useState<string | null>(
    null,
  );
  const [editingContestantName, setEditingContestantName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmResetVoting, setConfirmResetVoting] = useState(false);
  const [confirmSystemChange, setConfirmSystemChange] =
    useState<VotingSystem | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const mode = getDataStore().mode;

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const store = getDataStore();
      const active = await store.getActiveContest();
      setBundle(active);
      if (active) {
        setContestName(active.contest.name);
        setVotes(await store.listVotes(active.contest.id));
      } else {
        setVotes([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount/unlock gate
  }, [unlocked]);

  const hasVotes = votes.length > 0;
  const isMultiRound = bundle?.contest.votingSystem === 'multiRound';

  const round1Preview = useMemo(() => {
    if (!bundle || !isMultiRound) return null;
    const ranked = rankRound(bundle.contestants, votes, 1);
    return computeFinalists(ranked);
  }, [bundle, votes, isMultiRound]);

  function handleUnlock(event: FormEvent) {
    event.preventDefault();
    if (!unlockAdmin(password)) {
      setAuthError('Incorrect password');
      return;
    }
    setAuthError(null);
    setUnlocked(true);
  }

  async function handleCreateContest(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const created = await getDataStore().createContest(contestName.trim());
      setBundle(created);
      setVotes([]);
      setMessage('Contest created with default categories.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create contest');
    }
  }

  async function handleToggleOpen() {
    if (!bundle) return;
    setError(null);
    try {
      const updated = await getDataStore().updateContest(bundle.contest.id, {
        isOpen: !bundle.contest.isOpen,
      });
      setBundle({ ...bundle, contest: updated });
      setMessage(updated.isOpen ? 'Voting is open.' : 'Voting is closed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update contest');
    }
  }

  async function applyVotingSystem(system: VotingSystem) {
    if (!bundle) return;
    setModalBusy(true);
    setError(null);
    try {
      if (hasVotes) {
        await getDataStore().clearVotes(bundle.contest.id);
        setVotes([]);
      }
      const updated = await getDataStore().updateContest(bundle.contest.id, {
        votingSystem: system,
        isOpen: system === 'classic' ? (hasVotes ? true : bundle.contest.isOpen) : false,
        currentRound: 1,
        finalistIds: [],
      });
      setBundle({ ...bundle, contest: updated });
      setMessage(
        system === 'multiRound'
          ? hasVotes
            ? 'Switched to multi-round (votes cleared). Open Round 1 when ready.'
            : 'Multi-round selected. Open Round 1 when ready.'
          : hasVotes
            ? 'Switched to classic voting (votes cleared).'
            : 'Classic voting selected.',
      );
      setConfirmSystemChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change voting system');
    } finally {
      setModalBusy(false);
    }
  }

  function requestVotingSystem(system: VotingSystem) {
    if (!bundle || system === bundle.contest.votingSystem) return;
    if (hasVotes) {
      setConfirmSystemChange(system);
      return;
    }
    void applyVotingSystem(system);
  }

  async function openRound(round: 1 | 2) {
    if (!bundle) return;
    setError(null);
    try {
      if (round === 2) {
        const ranked = rankRound(bundle.contestants, votes, 1);
        const { finalists } = computeFinalists(ranked);
        if (finalists.length === 0) {
          setError('No Round 1 votes yet — cannot open Round 2.');
          return;
        }
        const updated = await getDataStore().updateContest(bundle.contest.id, {
          currentRound: 2,
          finalistIds: finalists.map((f) => f.contestantId),
          isOpen: true,
        });
        setBundle({ ...bundle, contest: updated });
        setMessage(
          `Round 2 open with ${finalists.length} finalist${finalists.length === 1 ? '' : 's'}.`,
        );
      } else {
        const updated = await getDataStore().updateContest(bundle.contest.id, {
          currentRound: 1,
          finalistIds: [],
          isOpen: true,
        });
        setBundle({ ...bundle, contest: updated });
        setMessage('Round 1 is open.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open round');
    }
  }

  async function closeRound() {
    if (!bundle) return;
    setError(null);
    try {
      const updated = await getDataStore().updateContest(bundle.contest.id, {
        isOpen: false,
      });
      setBundle({ ...bundle, contest: updated });
      setMessage(
        bundle.contest.currentRound === 2
          ? 'Round 2 closed — final results are ready.'
          : 'Round 1 closed. Review finalists, then open Round 2.',
      );
      if (bundle.contest.currentRound === 1) {
        setVotes(await getDataStore().listVotes(bundle.contest.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close round');
    }
  }

  async function handleAddContestant(event: FormEvent) {
    event.preventDefault();
    if (!bundle || !newContestant.trim()) return;
    setError(null);
    try {
      const contestant = await getDataStore().addContestant(
        bundle.contest.id,
        newContestant,
      );
      setBundle({
        ...bundle,
        contestants: [...bundle.contestants, contestant],
      });
      setNewContestant('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add contestant');
    }
  }

  async function confirmRemoveContestant() {
    if (!bundle || !pendingDelete) return;
    const { id } = pendingDelete;
    setModalBusy(true);
    setError(null);
    try {
      await getDataStore().removeContestant(id);
      setBundle({
        ...bundle,
        contestants: bundle.contestants.filter((c) => c.id !== id),
      });
      if (editingContestantId === id) {
        setEditingContestantId(null);
        setEditingContestantName('');
      }
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove contestant');
    } finally {
      setModalBusy(false);
    }
  }

  async function runResetVoting() {
    if (!bundle) return;
    setModalBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await getDataStore().resetVoting(bundle.contest.id);
      setBundle({ ...bundle, contest: updated });
      setVotes([]);
      setConfirmResetVoting(false);
      setMessage(
        'Voting was reset. Ballots are cleared and the contest is closed at Round 1. Theme and contestants were kept.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset voting');
    } finally {
      setModalBusy(false);
    }
  }

  async function confirmResetEverything() {
    setModalBusy(true);
    setError(null);
    setMessage(null);
    try {
      await getDataStore().resetEverything();
      setBundle(null);
      setVotes([]);
      setContestName('Halloween Costume Contest');
      setNewContestant('');
      setEditingContestantId(null);
      setEditingContestantName('');
      setConfirmReset(false);
      setMessage('Everything was reset. Create a new contest to start over.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset');
    } finally {
      setModalBusy(false);
    }
  }

  function startEditContestant(id: string, name: string) {
    setEditingContestantId(id);
    setEditingContestantName(name);
  }

  async function commitEditContestant() {
    if (!bundle || !editingContestantId) return;
    const trimmed = editingContestantName.trim();
    const existing = bundle.contestants.find((c) => c.id === editingContestantId);
    setEditingContestantId(null);
    setEditingContestantName('');
    if (!existing || !trimmed || trimmed === existing.name) return;

    setError(null);
    try {
      const updated = await getDataStore().updateContestant(editingContestantId, {
        name: trimmed,
      });
      setBundle({
        ...bundle,
        contestants: bundle.contestants.map((c) =>
          c.id === updated.id ? updated : c,
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename contestant');
    }
  }

  function onContestantEditKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commitEditContestant();
    }
    if (event.key === 'Escape') {
      setEditingContestantId(null);
      setEditingContestantName('');
    }
  }

  async function handleContestantPhoto(
    contestantId: string,
    fileList: FileList | null,
  ) {
    if (!bundle || !fileList?.[0]) return;
    setUploadingId(contestantId);
    setError(null);
    try {
      const prepared = await prepareImageUpload(fileList[0]);
      const existing = bundle.contestants.find((c) => c.id === contestantId);
      const key = await getDataStore().uploadImage('contestant', prepared);
      const updated = await getDataStore().updateContestant(contestantId, {
        imageKey: key,
      });
      if (existing?.imageKey) {
        try {
          await getDataStore().deleteImage(existing.imageKey);
        } catch {
          // Ignore orphan cleanup failures.
        }
      }
      setBundle({
        ...bundle,
        contestants: bundle.contestants.map((c) =>
          c.id === updated.id ? updated : c,
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo');
    } finally {
      setUploadingId(null);
    }
  }

  async function removeContestantPhoto(contestantId: string) {
    if (!bundle) return;
    const existing = bundle.contestants.find((c) => c.id === contestantId);
    if (!existing?.imageKey) return;
    setUploadingId(contestantId);
    setError(null);
    try {
      await getDataStore().deleteImage(existing.imageKey);
      const updated = await getDataStore().updateContestant(contestantId, {
        imageKey: null,
      });
      setBundle({
        ...bundle,
        contestants: bundle.contestants.map((c) =>
          c.id === updated.id ? updated : c,
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove photo');
    } finally {
      setUploadingId(null);
    }
  }

  async function patchTheme(
    patch: Partial<{
      themeColor: ThemeColor;
      titleFont: ThemeFont;
      bodyFont: ThemeFont;
      titleSize: ThemeSize;
      bodySize: ThemeSize;
      resultsBackground: ResultsBackground;
      resultsBackgroundKey: string | null;
    }>,
  ) {
    if (!bundle) return;
    setError(null);
    try {
      const updated = await getDataStore().updateContest(bundle.contest.id, patch);
      setBundle({ ...bundle, contest: updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update theme');
    }
  }

  async function setResultsBackground(kind: ResultsBackground) {
    await patchTheme({
      resultsBackground: kind,
      ...(kind !== 'custom' ? { resultsBackgroundKey: null } : {}),
    });
  }

  async function handleBackgroundUpload(fileList: FileList | null) {
    if (!bundle || !fileList?.[0]) return;
    setUploadingId('background');
    setError(null);
    try {
      const prepared = await prepareImageUpload(fileList[0]);
      const key = await getDataStore().uploadImage('background', prepared);
      const previous = bundle.contest.resultsBackgroundKey;
      const updated = await getDataStore().updateContest(bundle.contest.id, {
        resultsBackground: 'custom',
        resultsBackgroundKey: key,
      });
      if (previous) {
        try {
          await getDataStore().deleteImage(previous);
        } catch {
          // Ignore orphan cleanup failures.
        }
      }
      setBundle({ ...bundle, contest: updated });
      setMessage('Custom results background saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload background');
    } finally {
      setUploadingId(null);
    }
  }

  async function handleRenameCategory(id: string, name: string) {
    if (!bundle || !name.trim()) return;
    try {
      const updated = await getDataStore().updateCategory(id, {
        name: name.trim(),
      });
      setBundle({
        ...bundle,
        categories: bundle.categories.map((c) =>
          c.id === id ? updated : c,
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename category');
    }
  }

  function onCategoryDragStart(event: DragEvent, categoryId: string) {
    setDragCategoryId(categoryId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', categoryId);
  }

  function onCategoryDragOver(event: DragEvent, categoryId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dropTargetId !== categoryId) setDropTargetId(categoryId);
  }

  function onCategoryDragEnd() {
    setDragCategoryId(null);
    setDropTargetId(null);
  }

  async function onCategoryDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    if (!bundle || !dragCategoryId || dragCategoryId === targetId) {
      onCategoryDragEnd();
      return;
    }

    const ordered = [...bundle.categories].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const fromIndex = ordered.findIndex((c) => c.id === dragCategoryId);
    const toIndex = ordered.findIndex((c) => c.id === targetId);
    if (fromIndex < 0 || toIndex < 0) {
      onCategoryDragEnd();
      return;
    }

    const next = [...ordered];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    const withOrder = next.map((category, index) => ({
      ...category,
      sortOrder: index,
    }));

    setBundle({ ...bundle, categories: withOrder });
    onCategoryDragEnd();
    setError(null);

    try {
      await Promise.all(
        withOrder.map((category) =>
          getDataStore().updateCategory(category.id, {
            sortOrder: category.sortOrder,
          }),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reorder categories');
      void refresh();
    }
  }

  if (!unlocked) {
    return (
      <main className="page narrow">
        <h1 className="brand">Admin</h1>
        <p className="lede">Enter the host password to manage the contest.</p>
        <form className="stack-form" onSubmit={handleUnlock}>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {authError && <p className="error">{authError}</p>}
          <button type="submit" className="btn btn-primary">
            Unlock
          </button>
        </form>
      </main>
    );
  }

  const orderedCategories = bundle
    ? [...bundle.categories].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  const roundLabel = bundle
    ? `Round ${bundle.contest.currentRound}`
    : '';

  return (
    <main className="page admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Host controls · {mode} data</p>
          <h1 className="brand">Contest setup</h1>
        </div>
        <div className="actions">
          <Link className="btn btn-ghost" to="/">
            Voting
          </Link>
          <Link className="btn btn-ghost" to="/results">
            Results
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              lockAdmin();
              setUnlocked(false);
            }}
          >
            Lock
          </button>
        </div>
      </header>

      {loading && <p className="muted">Loading…</p>}
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      {!bundle ? (
        <section className="panel">
          <h2>Create contest</h2>
          <p className="muted">
            Seeds Best Costume, Most Creative, Spookiest, Cutest, Funniest, and
            Best Surprise for classic mode.
          </p>
          <form className="stack-form" onSubmit={handleCreateContest}>
            <label>
              Contest name
              <input
                value={contestName}
                onChange={(e) => setContestName(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary">
              Create contest
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="panel-row">
              <div>
                <h2>{bundle.contest.name}</h2>
                <p className="muted">
                  {isMultiRound ? (
                    <>
                      {roundLabel} ·{' '}
                      <strong>
                        {bundle.contest.isOpen ? 'open' : 'closed'}
                      </strong>
                    </>
                  ) : (
                    <>
                      Voting is{' '}
                      <strong>
                        {bundle.contest.isOpen ? 'open' : 'closed'}
                      </strong>
                    </>
                  )}
                </p>
              </div>
              {!isMultiRound && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleToggleOpen()}
                >
                  {bundle.contest.isOpen ? 'Close voting' : 'Open voting'}
                </button>
              )}
            </div>
          </section>

          <section className="panel">
            <h2>Voting system</h2>
            <p className="muted hint">
              Classic uses categories with one win per costume. Multi-round is a
              single overall pick: top 3 advance, then a final vote.
              {hasVotes
                ? ' Changing systems resets all votes.'
                : ''}
            </p>
            <div className="system-toggle">
              <button
                type="button"
                className={
                  bundle.contest.votingSystem === 'classic'
                    ? 'btn btn-primary'
                    : 'btn btn-secondary'
                }
                onClick={() => requestVotingSystem('classic')}
              >
                Classic
              </button>
              <button
                type="button"
                className={
                  bundle.contest.votingSystem === 'multiRound'
                    ? 'btn btn-primary'
                    : 'btn btn-secondary'
                }
                onClick={() => requestVotingSystem('multiRound')}
              >
                Multi-round
              </button>
            </div>
          </section>

          {isMultiRound && (
            <section className="panel">
              <h2>Round controls</h2>
              <p className="muted">
                Round 1: everyone votes for one costume. Round 2: only finalists,
                starting from 0 votes. Round 1 totals break final ties.
              </p>
              <div className="actions wrap-actions">
                {bundle.contest.currentRound === 1 && !bundle.contest.isOpen && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void openRound(1)}
                  >
                    Open Round 1
                  </button>
                )}
                {bundle.contest.currentRound === 1 && bundle.contest.isOpen && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void closeRound()}
                  >
                    Close Round 1
                  </button>
                )}
                {bundle.contest.currentRound === 1 &&
                  !bundle.contest.isOpen &&
                  (round1Preview?.finalists.length ?? 0) > 0 && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void openRound(2)}
                    >
                      Open Round 2
                    </button>
                  )}
                {bundle.contest.currentRound === 2 && bundle.contest.isOpen && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void closeRound()}
                  >
                    Close Round 2
                  </button>
                )}
                {bundle.contest.currentRound === 2 && !bundle.contest.isOpen && (
                  <p className="success">Final round complete.</p>
                )}
              </div>

              {round1Preview && round1Preview.finalists.length > 0 && (
                <div className="finalist-preview">
                  <h3>
                    {bundle.contest.currentRound === 2
                      ? 'Locked finalists'
                      : 'Projected finalists'}
                  </h3>
                  {round1Preview.hasCutoffTie && (
                    <p className="muted hint">
                      Tie at 3rd place — more than three costumes advance.
                    </p>
                  )}
                  <ul className="finalist-chips">
                    {(bundle.contest.currentRound === 2
                      ? bundle.contestants.filter((c) =>
                          bundle.contest.finalistIds.includes(c.id),
                        )
                      : round1Preview.finalists.map(
                          (f) =>
                            bundle.contestants.find(
                              (c) => c.id === f.contestantId,
                            )!,
                        ).filter(Boolean)
                    ).map((contestant) => (
                      <li key={contestant.id}>
                        <ContestantAvatar
                          name={contestant.name}
                          imageKey={contestant.imageKey}
                          size="sm"
                        />
                        <span>{contestant.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section className="panel">
            <h2>Theme</h2>
            <p className="muted hint">
              Applies to the voting and results pages. Admin keeps its own look.
            </p>

            <h3 className="theme-subheader">Colors</h3>
            <div className="theme-swatches">
              {THEME_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={
                    bundle.contest.themeColor === preset.id
                      ? 'theme-swatch selected'
                      : 'theme-swatch'
                  }
                  onClick={() => void patchTheme({ themeColor: preset.id })}
                >
                  <span
                    className="theme-swatch-chip"
                    style={{ background: preset.swatch }}
                    aria-hidden="true"
                  />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>

            <h3 className="theme-subheader">Title font</h3>
            <div className="theme-font-row">
              {THEME_FONT_OPTIONS.map((option) => (
                <button
                  key={`title-${option.id}`}
                  type="button"
                  className={
                    bundle.contest.titleFont === option.id
                      ? 'theme-font-btn selected'
                      : 'theme-font-btn'
                  }
                  onClick={() => void patchTheme({ titleFont: option.id })}
                >
                  <span
                    className="theme-font-sample"
                    style={{ fontFamily: option.sampleFamily }}
                  >
                    Aa
                  </span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            <div className="theme-size-row" role="group" aria-label="Title size">
              {THEME_SIZE_OPTIONS.map((option) => (
                <button
                  key={`title-size-${option.id}`}
                  type="button"
                  className={
                    bundle.contest.titleSize === option.id
                      ? 'theme-size-btn selected'
                      : 'theme-size-btn'
                  }
                  onClick={() => void patchTheme({ titleSize: option.id })}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <h3 className="theme-subheader">Body font</h3>
            <div className="theme-font-row">
              {THEME_FONT_OPTIONS.map((option) => (
                <button
                  key={`body-${option.id}`}
                  type="button"
                  className={
                    bundle.contest.bodyFont === option.id
                      ? 'theme-font-btn selected'
                      : 'theme-font-btn'
                  }
                  onClick={() => void patchTheme({ bodyFont: option.id })}
                >
                  <span
                    className="theme-font-sample"
                    style={{ fontFamily: option.sampleFamily }}
                  >
                    Aa
                  </span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            <div className="theme-size-row" role="group" aria-label="Body size">
              {THEME_SIZE_OPTIONS.map((option) => (
                <button
                  key={`body-size-${option.id}`}
                  type="button"
                  className={
                    bundle.contest.bodySize === option.id
                      ? 'theme-size-btn selected'
                      : 'theme-size-btn'
                  }
                  onClick={() => void patchTheme({ bodySize: option.id })}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <h3 className="theme-subheader">Results background</h3>
            <div className="bg-options">
              {RESULTS_BACKGROUND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={
                    bundle.contest.resultsBackground === preset.id
                      ? 'bg-option selected'
                      : 'bg-option'
                  }
                  onClick={() => void setResultsBackground(preset.id)}
                >
                  <BackgroundPreview
                    kind={preset.id}
                    imageKey={bundle.contest.resultsBackgroundKey}
                  />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
            <label className="file-upload">
              <span className="btn btn-secondary">
                {uploadingId === 'background'
                  ? 'Uploading…'
                  : 'Upload custom image'}
              </span>
              <input
                type="file"
                accept="image/png,image/webp,image/jpeg,image/gif"
                disabled={uploadingId === 'background'}
                onChange={(e) => {
                  void handleBackgroundUpload(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>

            <h3 className="theme-subheader">Preview</h3>
            <div
              className="theme-preview theme-root"
              data-color={bundle.contest.themeColor}
              data-title-font={bundle.contest.titleFont}
              data-body-font={bundle.contest.bodyFont}
              data-title-size={bundle.contest.titleSize}
              data-body-size={bundle.contest.bodySize}
            >
              <p className="theme-preview-eyebrow">Live sample</p>
              <h4 className="theme-preview-title">Costume Contest</h4>
              <p className="theme-preview-body">
                Title and body fonts update here so you can compare before voters
                see them.
              </p>
              <button type="button" className="choice theme-preview-choice">
                Sample contestant
              </button>
              <div className="theme-preview-bar" aria-hidden="true">
                <span style={{ width: '62%' }} />
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>Contestants</h2>
            <p className="muted hint">
              Click a name to edit. PNG/WebP photos keep transparent backgrounds.
            </p>
            <form className="inline-form" onSubmit={handleAddContestant}>
              <input
                value={newContestant}
                onChange={(e) => setNewContestant(e.target.value)}
                placeholder="Contestant name"
                required
              />
              <button type="submit" className="btn btn-primary">
                Add
              </button>
            </form>
            {bundle.contestants.length === 0 ? (
              <p className="muted">No contestants yet.</p>
            ) : (
              <ul className="manage-list contestant-manage-list">
                {bundle.contestants.map((contestant) => (
                  <li key={contestant.id}>
                    <div className="contestant-admin-row">
                      <ContestantAvatar
                        name={contestant.name}
                        imageKey={contestant.imageKey}
                        size="md"
                      />
                      <div className="contestant-admin-main">
                        {editingContestantId === contestant.id ? (
                          <input
                            className="inline-edit"
                            value={editingContestantName}
                            onChange={(e) =>
                              setEditingContestantName(e.target.value)
                            }
                            onBlur={() => void commitEditContestant()}
                            onKeyDown={onContestantEditKeyDown}
                            autoFocus
                            aria-label={`Edit ${contestant.name}`}
                          />
                        ) : (
                          <button
                            type="button"
                            className="editable-name"
                            onClick={() =>
                              startEditContestant(contestant.id, contestant.name)
                            }
                          >
                            {contestant.name}
                          </button>
                        )}
                        <div className="contestant-photo-actions">
                          <label className="file-upload compact">
                            <span className="btn btn-ghost">
                              {uploadingId === contestant.id
                                ? 'Uploading…'
                                : contestant.imageKey
                                  ? 'Replace photo'
                                  : 'Add photo'}
                            </span>
                            <input
                              type="file"
                              accept="image/png,image/webp,image/jpeg,image/gif"
                              disabled={uploadingId === contestant.id}
                              onChange={(e) => {
                                void handleContestantPhoto(
                                  contestant.id,
                                  e.target.files,
                                );
                                e.target.value = '';
                              }}
                            />
                          </label>
                          {contestant.imageKey && (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={uploadingId === contestant.id}
                              onClick={() =>
                                void removeContestantPhoto(contestant.id)
                              }
                            >
                              Remove photo
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() =>
                          setPendingDelete({
                            id: contestant.id,
                            name: contestant.name,
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!isMultiRound && (
            <section className="panel">
              <h2>Categories</h2>
              <p className="muted hint">Drag to reorder. Edit the name in place.</p>
              <ul className="manage-list category-list">
                {orderedCategories.map((category) => {
                  const isDragging = dragCategoryId === category.id;
                  const isDropTarget =
                    dropTargetId === category.id &&
                    dragCategoryId !== category.id;
                  return (
                    <li
                      key={category.id}
                      className={[
                        'category-row',
                        isDragging ? 'dragging' : '',
                        isDropTarget ? 'drop-target' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      draggable
                      onDragStart={(event) =>
                        onCategoryDragStart(event, category.id)
                      }
                      onDragOver={(event) =>
                        onCategoryDragOver(event, category.id)
                      }
                      onDrop={(event) => void onCategoryDrop(event, category.id)}
                      onDragEnd={onCategoryDragEnd}
                    >
                      <span className="drag-handle" aria-hidden="true">
                        ⋮⋮
                      </span>
                      <input
                        defaultValue={category.name}
                        onBlur={(e) => {
                          if (e.target.value !== category.name) {
                            void handleRenameCategory(
                              category.id,
                              e.target.value,
                            );
                          }
                        }}
                        aria-label={`Rename ${category.name}`}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="panel danger-panel">
        <h2>Danger zone</h2>
        <div className="danger-actions">
          <div>
            <p className="muted">
              Reset voting clears all ballots and votes, closes voting, and
              returns to Round 1. Theme, fonts, backgrounds, and contestants are
              kept.
            </p>
            <button
              type="button"
              className="btn btn-danger"
              disabled={!bundle}
              onClick={() => setConfirmResetVoting(true)}
            >
              Reset voting
            </button>
          </div>
          <div>
            <p className="muted">
              Reset everything clears the contest, categories, contestants,
              ballots, votes, and uploaded images. This cannot be undone.
            </p>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setConfirmReset(true)}
            >
              Reset everything
            </button>
          </div>
        </div>
      </section>

      {pendingDelete && (
        <ConfirmModal
          title="Remove contestant?"
          message={`Remove “${pendingDelete.name}” from the contest? Their votes will be deleted too.`}
          confirmLabel="Remove"
          danger
          busy={modalBusy}
          onConfirm={() => void confirmRemoveContestant()}
          onCancel={() => {
            if (!modalBusy) setPendingDelete(null);
          }}
        />
      )}

      {confirmResetVoting && (
        <ConfirmModal
          title="Reset voting?"
          message="This deletes all ballots and votes, closes voting, and returns to Round 1. Contestants and theme settings stay as they are."
          confirmLabel="Reset voting"
          danger
          busy={modalBusy}
          onConfirm={() => void runResetVoting()}
          onCancel={() => {
            if (!modalBusy) setConfirmResetVoting(false);
          }}
        />
      )}

      {confirmReset && (
        <ConfirmModal
          title="Reset everything?"
          message="This deletes the contest, all categories, contestants, ballots, votes, and images. You’ll need to create a new contest afterward."
          confirmLabel="Reset everything"
          danger
          busy={modalBusy}
          onConfirm={() => void confirmResetEverything()}
          onCancel={() => {
            if (!modalBusy) setConfirmReset(false);
          }}
        />
      )}

      {confirmSystemChange && (
        <ConfirmModal
          title="Change voting system?"
          message="Switching systems clears all existing votes so ballots stay consistent. Continue?"
          confirmLabel="Change and reset votes"
          danger
          busy={modalBusy}
          onConfirm={() => void applyVotingSystem(confirmSystemChange)}
          onCancel={() => {
            if (!modalBusy) setConfirmSystemChange(null);
          }}
        />
      )}
    </main>
  );
}
