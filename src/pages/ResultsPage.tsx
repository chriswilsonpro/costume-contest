import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDataStore } from '../lib/dataStore';
import type { ContestBundle, Vote } from '../lib/types';

type Ranked = {
  contestantId: string;
  name: string;
  count: number;
};

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
    return bundle.categories.map((category) => {
      const counts = new Map<string, number>();
      for (const contestant of bundle.contestants) {
        counts.set(contestant.id, 0);
      }
      for (const vote of votes) {
        if (vote.categoryId !== category.id) continue;
        counts.set(vote.contestantId, (counts.get(vote.contestantId) ?? 0) + 1);
      }
      const ranked: Ranked[] = bundle.contestants
        .map((contestant) => ({
          contestantId: contestant.id,
          name: contestant.name,
          count: counts.get(contestant.id) ?? 0,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

      return { category, ranked };
    });
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
          </p>
        </div>
        <Link className="btn btn-secondary" to="/">
          Back to voting
        </Link>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="results-grid">
        {rankings.map(({ category, ranked }) => {
          const leader = ranked[0];
          const leaderCount = leader?.count ?? 0;
          return (
            <section className="result-card" key={category.id}>
              <h2>{category.name}</h2>
              {ranked.length === 0 ? (
                <p className="muted">No contestants yet.</p>
              ) : (
                <ol className="rank-list">
                  {ranked.map((entry, index) => {
                    const isLeader = entry.count > 0 && entry.count === leaderCount;
                    const width =
                      leaderCount === 0
                        ? 0
                        : Math.round((entry.count / leaderCount) * 100);
                    return (
                      <li
                        key={entry.contestantId}
                        className={isLeader ? 'rank-row leader' : 'rank-row'}
                      >
                        <div className="rank-meta">
                          <span className="rank-place">{index + 1}</span>
                          <span className="rank-name">{entry.name}</span>
                          <span className="rank-count">{entry.count}</span>
                        </div>
                        <div className="rank-bar" aria-hidden="true">
                          <span style={{ width: `${width}%` }} />
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
