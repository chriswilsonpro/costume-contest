import {
  useEffect,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { isAdminUnlocked, lockAdmin, unlockAdmin } from '../lib/adminAuth';
import { getDataStore } from '../lib/dataStore';
import type { ContestBundle } from '../lib/types';

export function AdminPage() {
  const [unlocked, setUnlocked] = useState(isAdminUnlocked());
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<ContestBundle | null>(null);
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
  const mode = getDataStore().mode;

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const active = await getDataStore().getActiveContest();
      setBundle(active);
      if (active) setContestName(active.contest.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked) void refresh();
    // Load contest once when admin session is already unlocked (e.g. refresh).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount/unlock gate
  }, [unlocked]);

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

  async function handleRemoveContestant(id: string) {
    if (!bundle) return;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove contestant');
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
            Best Surprise.
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
                  Voting is{' '}
                  <strong>{bundle.contest.isOpen ? 'open' : 'closed'}</strong>
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleToggleOpen()}
              >
                {bundle.contest.isOpen ? 'Close voting' : 'Open voting'}
              </button>
            </div>
          </section>

          <section className="panel">
            <h2>Contestants</h2>
            <p className="muted hint">Click a name to edit it.</p>
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
              <ul className="manage-list">
                {bundle.contestants.map((contestant) => (
                  <li key={contestant.id}>
                    {editingContestantId === contestant.id ? (
                      <input
                        className="inline-edit"
                        value={editingContestantName}
                        onChange={(e) => setEditingContestantName(e.target.value)}
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
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void handleRemoveContestant(contestant.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2>Categories</h2>
            <p className="muted hint">Drag to reorder. Edit the name in place.</p>
            <ul className="manage-list category-list">
              {orderedCategories.map((category) => {
                const isDragging = dragCategoryId === category.id;
                const isDropTarget =
                  dropTargetId === category.id && dragCategoryId !== category.id;
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
                    onDragStart={(event) => onCategoryDragStart(event, category.id)}
                    onDragOver={(event) => onCategoryDragOver(event, category.id)}
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
                          void handleRenameCategory(category.id, e.target.value);
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
        </>
      )}
    </main>
  );
}
