import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDataStore } from '../lib/dataStore';
import { computeCategoryRankings } from '../lib/rankings';
import type { ContestBundle, Vote } from '../lib/types';

const ROW_HEIGHT = 58;

export function ResultsPage() {
  const [bundle, setBundle] = useState<ContestBundle | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;

    async function load() {
      try {
        const store = getDataStore();
        const active = await store.getActiveContest();
        if (cancelled) return;
        if (!active) {
          setLoading(false);
          return;
        }
        setBundle(active);
        unsubscribe = store.subscribeVotes(active.contest.id, (nextVotes) => {
          if (!cancelled) setVotes(nextVotes);
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load results');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const rankings = useMemo(() => {
    if (!bundle) return [];
    return computeCategoryRankings(
      bundle.categories,
      bundle.contestants,
      votes,
    );
  }, [bundle, votes]);

  const totalBallots = useMemo(() => {
    const ids = new Set(votes.map((v) => v.ballotId));
    return ids.size;
  }, [votes]);

  if (loading) {
    return (
      <main className="page">
        <p className="muted">Loading live results…</p>
      </main>
    );
  }

  if (!bundle) {
    return (
      <main className="page">
        <h1 className="brand">Live results</h1>
        <p className="lede">No contest yet.</p>
        {error && <p className="error">{error}</p>}
        <Link className="text-link" to="/admin">
          Set up the contest
        </Link>
      </main>
    );
  }

  return (
    <main className="page results-page">
      <header className="results-header">
        <div>
          <p className="eyebrow live-pill">Live</p>
          <h1 className="brand">{bundle.contest.name}</h1>
          <p className="lede">
            {totalBallots} ballot{totalBallots === 1 ? '' : 's'} counted
            {bundle.contest.isOpen ? ' · voting open' : ' · voting closed'}
            {' · '}
            one win per costume
          </p>
        </div>
        <Link className="btn btn-secondary" to="/">
          Back to voting
        </Link>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="results-grid">
        {rankings.map(({ category, ranked, winnerId }) => {
          const winner = ranked.find((entry) => entry.contestantId === winnerId);
          const barMax = Math.max(
            winner?.count ?? 0,
            ...ranked.filter((e) => e.eligible).map((e) => e.count),
            1,
          );

          // Stable DOM order so transforms can slide rows between ranks.
          const stableRows = [...ranked].sort((a, b) =>
            a.name.localeCompare(b.name),
          );

          return (
            <section className="result-card" key={category.id}>
              <h2>{category.name}</h2>

              <div
                className={
                  winner ? 'winner-spotlight has-winner' : 'winner-spotlight empty'
                }
                key={winner?.contestantId ?? 'none'}
              >
                <span className="winner-spotlight-label">
                  {winner ? 'Winning' : 'Waiting for votes'}
                </span>
                <p className="winner-spotlight-name">
                  {winner?.name ?? '—'}
                </p>
                {winner && (
                  <span className="winner-spotlight-count">
                    {winner.count} vote{winner.count === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {ranked.length === 0 ? (
                <p className="muted">No contestants yet.</p>
              ) : (
                <ol
                  className="rank-list rank-list-animated"
                  style={{ height: ranked.length * ROW_HEIGHT }}
                >
                  {stableRows.map((entry) => {
                    const index = ranked.findIndex(
                      (row) => row.contestantId === entry.contestantId,
                    );
                    const width = Math.round((entry.count / barMax) * 100);
                    const rowClass = entry.isWinner
                      ? 'rank-row leader'
                      : entry.eligible
                        ? 'rank-row'
                        : 'rank-row ineligible';

                    return (
                      <li
                        key={entry.contestantId}
                        className={rowClass}
                        style={{
                          transform: `translateY(${index * ROW_HEIGHT}px)`,
                          zIndex: entry.isWinner ? 3 : entry.eligible ? 2 : 1,
                        }}
                      >
                        <div className="rank-meta">
                          <span className="rank-place">{index + 1}</span>
                          <span className="rank-name">
                            {entry.name}
                            {!entry.eligible && entry.wonCategoryName && (
                              <span className="won-elsewhere">
                                {' '}
                                (won {entry.wonCategoryName})
                              </span>
                            )}
                          </span>
                          <span className="rank-count">{entry.count}</span>
                        </div>
                        <div className="rank-bar" aria-hidden="true">
                          <span
                            style={{
                              width: `${entry.eligible ? width : 0}%`,
                              opacity: entry.eligible ? 1 : 0.25,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
