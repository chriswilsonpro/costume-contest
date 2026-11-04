import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ContestantAvatar } from "../components/ContestantAvatar";
import { ResultsBackground } from "../components/ResultsBackground";
import { VoteQrLauncher } from "../components/VoteQrLauncher";
import { WinnerConfetti } from "../components/WinnerConfetti";
import { getDataStore } from "../lib/dataStore";
import {
  computeFinalists,
  computeFinalWinner,
  rankRound,
  type RoundRankedEntry,
} from "../lib/multiRound";
import { computeCategoryRankings } from "../lib/rankings";
import type { ContestBundle, Vote } from "../lib/types";

const ROW_HEIGHT = 58;

function ClassicResults({
  bundle,
  votes,
  error,
}: {
  bundle: ContestBundle;
  votes: Vote[];
  error: string | null;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const rankings = useMemo(() => {
    return computeCategoryRankings(
      bundle.categories,
      bundle.contestants,
      votes,
    );
  }, [bundle, votes]);

  const totalBallots = useMemo(() => {
    const ids = new Set(
      votes
        .filter((v) => v.categoryId && (v.round == null || v.round === 0))
        .map((v) => v.ballotId),
    );
    return ids.size;
  }, [votes]);

  return (
    <>
      <header className="results-header">
        <div>
          <p className="eyebrow live-pill">Live</p>
          <h1 className="brand">{bundle.contest.name}</h1>
          <p className="lede">
            {totalBallots} ballot{totalBallots === 1 ? "" : "s"} counted
            {bundle.contest.isOpen ? " · voting open" : " · voting closed"}
            {" · "}
            one win per costume
          </p>
        </div>
        <Link className="btn btn-secondary" to="/">
          Back to voting
        </Link>
      </header>

      {error && <p className="error results-header-error">{error}</p>}

      <VoteQrLauncher />

      <div className="results-body">
      <div className="results-grid">
        {rankings.map(({ category, ranked, winnerId }) => {
          const winner = ranked.find((entry) => entry.contestantId === winnerId);
          const winnerContestant = winner
            ? bundle.contestants.find((c) => c.id === winner.contestantId)
            : null;
          const runnerUps = ranked
            .filter((entry) => entry.contestantId !== winnerId)
            .slice(0, 6);
          const barMax = Math.max(
            ...runnerUps.filter((e) => e.eligible).map((e) => e.count),
            1,
          );

          const stableRows = [...runnerUps].sort((a, b) =>
            a.name.localeCompare(b.name),
          );

          const isExpanded = Boolean(expandedCategories[category.id]);

          return (
            <section className="result-card" key={category.id}>
              <div className="result-card-header">
                <h2>{category.name}</h2>
                {isMobile && runnerUps.length > 0 && (
                  <button
                    type="button"
                    className={
                      isExpanded
                        ? "runner-ups-toggle expanded"
                        : "runner-ups-toggle"
                    }
                    aria-expanded={isExpanded}
                    aria-label={
                      isExpanded ? "Hide runner-ups" : "Show runner-ups"
                    }
                    onClick={() =>
                      setExpandedCategories((prev) => ({
                        ...prev,
                        [category.id]: !prev[category.id],
                      }))
                    }
                  >
                    <span className="runner-ups-caret" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div
                className={
                  winner ? "winner-spotlight has-winner" : "winner-spotlight empty"
                }
                key={winner?.contestantId ?? "none"}
              >
                {winner && !bundle.contest.isOpen && <WinnerConfetti />}
                <div className="winner-spotlight-content">
                  {winnerContestant && (
                    <ContestantAvatar
                      name={winnerContestant.name}
                      imageKey={winnerContestant.imageKey}
                      size="xl"
                    />
                  )}
                  <span className="winner-spotlight-label">
                    {winner ? "Winning" : "Waiting for votes"}
                  </span>
                  <p className="winner-spotlight-name">{winner?.name ?? "—"}</p>
                  {winner && (
                    <span className="winner-spotlight-count">
                      {winner.count} vote{winner.count === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </div>

              {ranked.length === 0 ? (
                <p className="muted">No contestants yet.</p>
              ) : runnerUps.length === 0 ? (
                <p className="muted">No runner-ups yet.</p>
              ) : (
                (!isMobile || isExpanded) && (
                  <ol
                    className="rank-list rank-list-animated"
                    style={{ height: runnerUps.length * ROW_HEIGHT }}
                  >
                    {stableRows.map((entry) => {
                      const index = runnerUps.findIndex(
                        (row) => row.contestantId === entry.contestantId,
                      );
                      const place = index + 2;
                      const width = Math.round((entry.count / barMax) * 100);
                      const rowClass = entry.eligible
                        ? "rank-row"
                        : "rank-row ineligible";
                      const contestant = bundle.contestants.find(
                        (c) => c.id === entry.contestantId,
                      );

                      return (
                        <li
                          key={entry.contestantId}
                          className={rowClass}
                          style={{
                            transform: `translateY(${index * ROW_HEIGHT}px)`,
                            zIndex: entry.eligible ? 2 : 1,
                          }}
                        >
                          <div className="rank-meta">
                            <span className="rank-place">{place}</span>
                            {contestant && (
                              <ContestantAvatar
                                name={contestant.name}
                                imageKey={contestant.imageKey}
                                size="sm"
                              />
                            )}
                            <span className="rank-name">
                              {entry.name}
                              {!entry.eligible && entry.wonCategoryName && (
                                <span className="won-elsewhere">
                                  {" "}
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
                )
              )}
            </section>
          );
        })}
      </div>
      </div>
    </>
  );
}

const RESULT_BAR_TONES = ["tone-a", "tone-b", "tone-c", "tone-d"] as const;

function RoundResultCards({
  ranked,
  contestants,
  advancingIds,
  highlightWinners = false,
  showConfetti = false,
}: {
  ranked: RoundRankedEntry[];
  contestants: ContestBundle["contestants"];
  advancingIds?: Set<string>;
  highlightWinners?: boolean;
  showConfetti?: boolean;
}) {
  const totalVotes = ranked.reduce((sum, entry) => sum + entry.count, 0);
  const leadCount = ranked[0]?.count ?? 0;

  return (
    <ul className="result-card-grid">
      {ranked.map((entry, index) => {
        const percent =
          totalVotes > 0 ? Math.round((entry.count / totalVotes) * 100) : 0;
        const contestant = contestants.find((c) => c.id === entry.contestantId);
        const isLeader =
          highlightWinners && entry.count > 0 && entry.count === leadCount;
        const advancing = advancingIds?.has(entry.contestantId);
        const tone = RESULT_BAR_TONES[index % RESULT_BAR_TONES.length];
        const classes = [
          "result-entry-card",
          isLeader ? "is-winner" : "",
          advancing && !isLeader ? "is-advancing" : "",
          tone,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <li key={entry.contestantId} className={classes}>
            {isLeader && showConfetti && <WinnerConfetti />}
            <div className="result-entry-media">
              {isLeader && (
                <span className="result-winner-badge">
                  <span className="result-winner-cup" aria-hidden="true" />
                  Winner
                </span>
              )}
              {!isLeader && advancing && (
                <span className="result-advance-badge">Advancing</span>
              )}
              {contestant ? (
                <ContestantAvatar
                  name={contestant.name}
                  imageKey={contestant.imageKey}
                  size="xl"
                />
              ) : (
                <span className="contestant-avatar avatar-xl avatar-fallback">
                  ?
                </span>
              )}
            </div>
            <div className="result-entry-footer">
              <p className="result-entry-name">{entry.name}</p>
              <div className="result-entry-stats">
                <span className="result-entry-percent">{percent}%</span>
                <span className="result-entry-votes">
                  {entry.count} vote{entry.count === 1 ? "" : "s"}
                </span>
              </div>
              <div className="result-entry-bar" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RoundResults({
  bundle,
  votes,
  error,
}: {
  bundle: ContestBundle;
  votes: Vote[];
  error: string | null;
}) {
  const round = bundle.contest.currentRound;
  const roundClosed = !bundle.contest.isOpen;

  const round1Ranked = useMemo(
    () => rankRound(bundle.contestants, votes, 1),
    [bundle.contestants, votes],
  );

  const finalistsInfo = useMemo(
    () => computeFinalists(round1Ranked),
    [round1Ranked],
  );

  const finalistContestants = useMemo(() => {
    const ids =
      round === 2 && bundle.contest.finalistIds.length > 0
        ? new Set(bundle.contest.finalistIds)
        : new Set(finalistsInfo.finalists.map((f) => f.contestantId));
    return bundle.contestants.filter((c) => ids.has(c.id));
  }, [bundle, round, finalistsInfo]);

  const round2Ranked = useMemo(
    () => rankRound(finalistContestants, votes, 2),
    [finalistContestants, votes],
  );

  const finalResult = useMemo(
    () => computeFinalWinner(round2Ranked, round1Ranked),
    [round2Ranked, round1Ranked],
  );

  const advancingIds = useMemo(
    () => new Set(finalistsInfo.finalists.map((f) => f.contestantId)),
    [finalistsInfo],
  );

  const totalBallots = useMemo(() => {
    const ids = new Set(
      votes.filter((v) => v.round === round).map((v) => v.ballotId),
    );
    return ids.size;
  }, [votes, round]);

  const showFinal =
    round === 2 && roundClosed && finalResult.winners.length > 0;

  return (
    <>
      <header className="results-header">
        <div>
          <p className="eyebrow live-pill">
            {showFinal ? "Final" : `Round ${round} · Live`}
          </p>
          <h1 className="brand">{bundle.contest.name}</h1>
          <p className="lede">
            {showFinal
              ? "Winner takes all"
              : `${totalBallots} ballot${totalBallots === 1 ? "" : "s"} in Round ${round}${
                  bundle.contest.isOpen ? " · voting open" : " · voting closed"
                }`}
          </p>
        </div>
        <Link className="btn btn-secondary" to="/">
          Back to voting
        </Link>
      </header>

      {error && <p className="error results-header-error">{error}</p>}

      <VoteQrLauncher />

      <section className="results-body">
        {showFinal ? (
          <>
            <div className="results-body-intro">
              <h2>Final results</h2>
            </div>
            <RoundResultCards
              ranked={round2Ranked}
              contestants={bundle.contestants}
              highlightWinners
              showConfetti
            />
            {finalResult.usedRound1Tiebreak && (
              <p className="muted tiebreak-note">
                {finalResult.isCoWinner
                  ? "Round 2 and Round 1 votes tied — co-winners."
                  : "Round 2 tied; decided by Round 1 vote totals."}
              </p>
            )}
          </>
        ) : round === 2 ? (
          <>
            <div className="results-body-intro">
              <h2>Finalists</h2>
              <p className="muted hint">Counts reset for Round 2.</p>
            </div>
            {round2Ranked.length === 0 ? (
              <p className="muted">No finalists yet.</p>
            ) : (
              <RoundResultCards
                ranked={round2Ranked}
                contestants={bundle.contestants}
              />
            )}
          </>
        ) : (
          <>
            <div className="results-body-intro">
              <h2>Round 1 leaderboard</h2>
              {finalistsInfo.hasCutoffTie && (
                <p className="muted hint">
                  Tie at 3rd — more than three costumes are advancing.
                </p>
              )}
            </div>
            {round1Ranked.length === 0 ? (
              <p className="muted">No contestants yet.</p>
            ) : (
              <RoundResultCards
                ranked={round1Ranked}
                contestants={bundle.contestants}
                advancingIds={
                  roundClosed || finalistsInfo.finalists.length > 0
                    ? advancingIds
                    : undefined
                }
              />
            )}
          </>
        )}
      </section>
    </>
  );
}

export function ResultsPage() {
  const [bundle, setBundle] = useState<ContestBundle | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeVotes = () => {};
    let unsubscribeContest = () => {};
    let cancelled = false;
    let subscribedContestId: string | null = null;

    function watchVotes(contestId: string) {
      if (subscribedContestId === contestId) return;
      unsubscribeVotes();
      subscribedContestId = contestId;
      unsubscribeVotes = getDataStore().subscribeVotes(contestId, (nextVotes) => {
        if (!cancelled) setVotes(nextVotes);
      });
    }

    try {
      unsubscribeContest = getDataStore().subscribeActiveContest((active) => {
        if (cancelled) return;
        setBundle(active);
        setLoading(false);
        if (active) {
          watchVotes(active.contest.id);
        } else {
          unsubscribeVotes();
          subscribedContestId = null;
          setVotes([]);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results");
      setLoading(false);
    }

    return () => {
      cancelled = true;
      unsubscribeVotes();
      unsubscribeContest();
    };
  }, []);

  if (loading) {
    return (
      <main className="page results-page">
        <ResultsBackground kind="halloween" />
        <div className="results-foreground">
          <p className="muted">Loading live results…</p>
        </div>
      </main>
    );
  }

  if (!bundle) {
    return (
      <main className="page results-page">
        <ResultsBackground kind="halloween" />
        <div className="results-foreground">
          <h1 className="brand">Live results</h1>
          <p className="lede">No contest yet.</p>
          {error && <p className="error">{error}</p>}
          <Link className="text-link" to="/admin">
            Set up the contest
          </Link>
        </div>
      </main>
    );
  }

  const sceneBg = bundle.contest.resultsBackground !== "plain";

  return (
    <main className={sceneBg ? "page results-page scene-bg" : "page results-page"}>
      <ResultsBackground
        kind={bundle.contest.resultsBackground}
        imageKey={bundle.contest.resultsBackgroundKey}
      />
      <div className="results-foreground">
        {bundle.contest.votingSystem === "multiRound" ? (
          <RoundResults bundle={bundle} votes={votes} error={error} />
        ) : (
          <ClassicResults bundle={bundle} votes={votes} error={error} />
        )}
      </div>
    </main>
  );
}
