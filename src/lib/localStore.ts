import { createId } from './id';
import {
  DEFAULT_CATEGORIES,
  type Ballot,
  type Category,
  type Contest,
  type ContestBundle,
  type Contestant,
  type Vote,
} from './types';

const STORAGE_KEY = 'costume_contest_db_v1';

type Db = {
  contests: Contest[];
  categories: Category[];
  contestants: Contestant[];
  ballots: Ballot[];
  votes: Vote[];
};

type VoteListener = (votes: Vote[]) => void;

const listeners = new Set<VoteListener>();

function emptyDb(): Db {
  return {
    contests: [],
    categories: [],
    contestants: [],
    ballots: [],
    votes: [],
  };
}

function readDb(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    return { ...emptyDb(), ...JSON.parse(raw) } as Db;
  } catch {
    return emptyDb();
  }
}

function writeDb(db: Db): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  for (const listener of listeners) {
    listener(db.votes);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    const votes = readDb().votes;
    for (const listener of listeners) {
      listener(votes);
    }
  });
}

function sortByOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

export const localStore = {
  subscribeVotes(listener: VoteListener): () => void {
    listeners.add(listener);
    listener(readDb().votes);
    return () => listeners.delete(listener);
  },

  async getActiveContest(): Promise<ContestBundle | null> {
    const db = readDb();
    const contest = db.contests[0] ?? null;
    if (!contest) return null;
    return {
      contest,
      categories: sortByOrder(
        db.categories.filter((c) => c.contestId === contest.id),
      ),
      contestants: sortByOrder(
        db.contestants.filter((c) => c.contestId === contest.id),
      ),
    };
  },

  async createContest(name: string): Promise<ContestBundle> {
    const db = readDb();
    if (db.contests.length > 0) {
      const existing = await this.getActiveContest();
      if (existing) return existing;
    }

    const now = new Date().toISOString();
    const contest: Contest = {
      id: createId(),
      name,
      isOpen: true,
      createdAt: now,
      updatedAt: now,
    };
    const categories: Category[] = DEFAULT_CATEGORIES.map((catName, index) => ({
      id: createId(),
      contestId: contest.id,
      name: catName,
      sortOrder: index,
    }));

    db.contests = [contest];
    db.categories = categories;
    db.contestants = [];
    db.ballots = [];
    db.votes = [];
    writeDb(db);

    return { contest, categories, contestants: [] };
  },

  async updateContest(
    id: string,
    patch: Partial<Pick<Contest, 'name' | 'isOpen'>>,
  ): Promise<Contest> {
    const db = readDb();
    const index = db.contests.findIndex((c) => c.id === id);
    if (index < 0) throw new Error('Contest not found');
    db.contests[index] = {
      ...db.contests[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    writeDb(db);
    return db.contests[index];
  },

  async addContestant(contestId: string, name: string): Promise<Contestant> {
    const db = readDb();
    const existing = db.contestants.filter((c) => c.contestId === contestId);
    const contestant: Contestant = {
      id: createId(),
      contestId,
      name: name.trim(),
      sortOrder: existing.length,
    };
    db.contestants.push(contestant);
    writeDb(db);
    return contestant;
  },

  async removeContestant(id: string): Promise<void> {
    const db = readDb();
    db.contestants = db.contestants.filter((c) => c.id !== id);
    db.votes = db.votes.filter((v) => v.contestantId !== id);
    writeDb(db);
  },

  async resetEverything(): Promise<void> {
    writeDb(emptyDb());
  },

  async updateCategory(
    id: string,
    patch: Partial<Pick<Category, 'name' | 'sortOrder'>>,
  ): Promise<Category> {
    const db = readDb();
    const index = db.categories.findIndex((c) => c.id === id);
    if (index < 0) throw new Error('Category not found');
    db.categories[index] = { ...db.categories[index], ...patch };
    writeDb(db);
    return db.categories[index];
  },

  async updateContestant(
    id: string,
    patch: Partial<Pick<Contestant, 'name' | 'sortOrder'>>,
  ): Promise<Contestant> {
    const db = readDb();
    const index = db.contestants.findIndex((c) => c.id === id);
    if (index < 0) throw new Error('Contestant not found');
    const nextName = patch.name?.trim();
    db.contestants[index] = {
      ...db.contestants[index],
      ...patch,
      ...(nextName !== undefined ? { name: nextName } : {}),
    };
    writeDb(db);
    return db.contestants[index];
  },

  async getBallot(ballotId: string): Promise<Ballot | null> {
    return readDb().ballots.find((b) => b.id === ballotId) ?? null;
  },

  async getVotesForBallot(ballotId: string): Promise<Vote[]> {
    return readDb().votes.filter((v) => v.ballotId === ballotId);
  },

  async listVotes(contestId: string): Promise<Vote[]> {
    return readDb().votes.filter((v) => v.contestId === contestId);
  },

  async saveBallotVotes(input: {
    ballotId: string;
    contestId: string;
    selections: Record<string, string>;
  }): Promise<{ ballot: Ballot; votes: Vote[] }> {
    const db = readDb();
    const contest = db.contests.find((c) => c.id === input.contestId);
    if (!contest) throw new Error('Contest not found');
    if (!contest.isOpen) throw new Error('Voting is closed');

    const categoryIds = Object.keys(input.selections);
    const contestantIds = Object.values(input.selections);

    if (new Set(contestantIds).size !== contestantIds.length) {
      throw new Error('Each contestant can only be selected once');
    }

    const now = new Date().toISOString();
    let ballot = db.ballots.find((b) => b.id === input.ballotId);
    if (!ballot) {
      ballot = {
        id: input.ballotId,
        contestId: input.contestId,
        submittedAt: now,
        updatedAt: now,
      };
      db.ballots.push(ballot);
    } else {
      ballot.submittedAt = ballot.submittedAt ?? now;
      ballot.updatedAt = now;
      if (ballot.contestId !== input.contestId) {
        throw new Error('Ballot belongs to a different contest');
      }
    }

    db.votes = db.votes.filter((v) => v.ballotId !== input.ballotId);

    const votes: Vote[] = categoryIds.map((categoryId) => ({
      id: createId(),
      ballotId: input.ballotId,
      contestId: input.contestId,
      categoryId,
      contestantId: input.selections[categoryId],
    }));

    db.votes.push(...votes);
    writeDb(db);
    return { ballot, votes };
  },
};
