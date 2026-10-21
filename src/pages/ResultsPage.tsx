import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDataStore } from '../lib/dataStore';
import { computeCategoryRankings } from '../lib/rankings';
import type { ContestBundle, Vote } from '../lib/types';

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

          return (
            <section className="result-card" key={category.id}>
              <h2>{category.name}</h2>
              {winner ? (
                <p className="winner-line">
                  Leading: <strong>{winner.name}</strong>
                </p>
              ) : (
                <p className="muted winner-line">No winner yet</p>
              )}
              {ranked.length === 0 ? (
                <p className="muted">No contestants yet.</p>
              ) : (
                <ol className="rank-list">
                  {ranked.map((entry, index) => {
                    const width = Math.round((entry.count / barMax) * 100);
                    const rowClass = entry.isWinner
                      ? 'rank-row leader'
                      : entry.eligible
                        ? 'rank-row'
                        : 'rank-row ineligible';
                    return (
                      <li key={entry.contestantId} className={rowClass}>
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
