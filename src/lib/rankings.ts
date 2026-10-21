import type { Category, Contestant, Vote } from './types';

export type RankedEntry = {
  contestantId: string;
  name: string;
  count: number;
  /** Still eligible to win this category (has not won an earlier one). */
  eligible: boolean;
  /** Exclusive winner for this category under the one-win rule. */
  isWinner: boolean;
  /** Category id they already won, if ineligible here. */
  wonCategoryId?: string;
  wonCategoryName?: string;
};

export type CategoryRanking = {
  category: Category;
  ranked: RankedEntry[];
  winnerId: string | null;
};

/**
 * Assign at most one win per contestant, walking categories in sort order.
 * Raw vote counts stay as cast; the winner is the top eligible contestant
 * with at least one vote.
 */
export function computeCategoryRankings(
  categories: Category[],
  contestants: Contestant[],
  votes: Vote[],
): CategoryRanking[] {
  const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const wonBy = new Map<string, { categoryId: string; categoryName: string }>();
  const results: CategoryRanking[] = [];

  for (const category of ordered) {
    const counts = new Map<string, number>();
    for (const contestant of contestants) {
      counts.set(contestant.id, 0);
    }
    for (const vote of votes) {
      if (vote.categoryId !== category.id) continue;
      counts.set(vote.contestantId, (counts.get(vote.contestantId) ?? 0) + 1);
    }

    const ranked: RankedEntry[] = contestants
      .map((contestant) => {
        const prior = wonBy.get(contestant.id);
        return {
          contestantId: contestant.id,
          name: contestant.name,
          count: counts.get(contestant.id) ?? 0,
          eligible: !prior,
          isWinner: false,
          wonCategoryId: prior?.categoryId,
          wonCategoryName: prior?.categoryName,
        };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const winner =
      ranked.find((entry) => entry.eligible && entry.count > 0) ?? null;
    if (winner) {
      winner.isWinner = true;
      wonBy.set(winner.contestantId, {
        categoryId: category.id,
        categoryName: category.name,
      });
    }

    results.push({
      category,
      ranked,
      winnerId: winner?.contestantId ?? null,
    });
  }

  return results;
}

/** Contestants who currently hold an exclusive win in an earlier category. */
export function winnersOfEarlierCategories(
  categories: Category[],
  contestants: Contestant[],
  votes: Vote[],
  currentCategoryId: string,
): Map<string, { categoryId: string; categoryName: string }> {
  const rankings = computeCategoryRankings(categories, contestants, votes);
  const blocked = new Map<string, { categoryId: string; categoryName: string }>();

  for (const row of rankings) {
    if (row.category.id === currentCategoryId) break;
    if (!row.winnerId) continue;
    blocked.set(row.winnerId, {
      categoryId: row.category.id,
      categoryName: row.category.name,
    });
  }

  return blocked;
}
