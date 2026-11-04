import type { Contestant, Vote } from './types';

export type RoundRankedEntry = {
  contestantId: string;
  name: string;
  count: number;
  imageKey?: string | null;
};

export type FinalistsResult = {
  finalists: RoundRankedEntry[];
  /** True when more than 3 advance because of a tie at 3rd place. */
  hasCutoffTie: boolean;
};

export type FinalWinnerResult = {
  winners: RoundRankedEntry[];
  /** True when Round 1 counts were used to break a Round 2 tie. */
  usedRound1Tiebreak: boolean;
  /** True when Round 1 could not break the tie (co-winners). */
  isCoWinner: boolean;
};

function sortRanked(a: RoundRankedEntry, b: RoundRankedEntry): number {
  return b.count - a.count || a.name.localeCompare(b.name);
}

/** Rank contestants by votes for a given round (0 counts included). */
export function rankRound(
  contestants: Contestant[],
  votes: Vote[],
  round: number,
): RoundRankedEntry[] {
  const counts = new Map<string, number>();
  for (const contestant of contestants) {
    counts.set(contestant.id, 0);
  }
  for (const vote of votes) {
    if (vote.round !== round) continue;
    counts.set(vote.contestantId, (counts.get(vote.contestantId) ?? 0) + 1);
  }

  return contestants
    .map((contestant) => ({
      contestantId: contestant.id,
      name: contestant.name,
      count: counts.get(contestant.id) ?? 0,
      imageKey: contestant.imageKey,
    }))
    .sort(sortRanked);
}

/**
 * Top 3 by Round 1 votes. Everyone tied for 3rd place advances,
 * so there can be more than 3 finalists.
 */
export function computeFinalists(round1Ranked: RoundRankedEntry[]): FinalistsResult {
  const withVotes = round1Ranked.filter((entry) => entry.count > 0);
  if (withVotes.length === 0) {
    return { finalists: [], hasCutoffTie: false };
  }

  if (withVotes.length <= 3) {
    return { finalists: withVotes, hasCutoffTie: false };
  }

  const thirdPlaceCount = withVotes[2].count;
  const finalists = withVotes.filter((entry) => entry.count >= thirdPlaceCount);
  const atCutoff = withVotes.filter((entry) => entry.count === thirdPlaceCount);

  return {
    finalists,
    hasCutoffTie: atCutoff.length > 1 && finalists.length > 3,
  };
}

/**
 * Round 2 winner(s). Ties broken by Round 1 counts; remaining ties are co-winners.
 */
export function computeFinalWinner(
  round2Ranked: RoundRankedEntry[],
  round1Ranked: RoundRankedEntry[],
): FinalWinnerResult {
  if (round2Ranked.length === 0) {
    return { winners: [], usedRound1Tiebreak: false, isCoWinner: false };
  }

  const topCount = round2Ranked[0].count;
  if (topCount <= 0) {
    return { winners: [], usedRound1Tiebreak: false, isCoWinner: false };
  }

  const tied = round2Ranked.filter((entry) => entry.count === topCount);
  if (tied.length === 1) {
    return {
      winners: tied,
      usedRound1Tiebreak: false,
      isCoWinner: false,
    };
  }

  const round1Counts = new Map(
    round1Ranked.map((entry) => [entry.contestantId, entry.count]),
  );
  const withRound1 = tied
    .map((entry) => ({
      ...entry,
      round1Count: round1Counts.get(entry.contestantId) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.round1Count - a.round1Count || a.name.localeCompare(b.name),
    );

  const bestRound1 = withRound1[0].round1Count;
  const winners = withRound1
    .filter((entry) => entry.round1Count === bestRound1)
    .map(({ contestantId, name, count, imageKey }) => ({
      contestantId,
      name,
      count,
      imageKey,
    }));

  return {
    winners,
    usedRound1Tiebreak: true,
    isCoWinner: winners.length > 1,
  };
}
