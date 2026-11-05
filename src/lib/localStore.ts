import { createId } from './id';
import {
  DEFAULT_CATEGORIES,
  type Ballot,
  type Category,
  type Contest,
  type ContestBundle,
  type Contestant,
  type ImageKind,
  type ResultsBackground,
  type Vote,
  type VotingSystem,
} from './types';

const STORAGE_KEY = 'costume_contest_db_v1';
const MEDIA_PREFIX = 'costume_contest_media_';

type Db = {
  contests: Contest[];
  categories: Category[];
  contestants: Contestant[];
  ballots: Ballot[];
  votes: Vote[];
};

type VoteListener = (votes: Vote[]) => void;
type ContestListener = (bundle: ContestBundle | null) => void;

const voteListeners = new Set<VoteListener>();
const contestListeners = new Set<ContestListener>();

function emptyDb(): Db {
  return {
    contests: [],
    categories: [],
    contestants: [],
    ballots: [],
    votes: [],
  };
}

function normalizeContest(raw: Contest): Contest {
  return {
    ...raw,
    votingSystem: raw.votingSystem ?? 'classic',
    currentRound: raw.currentRound ?? 1,
    finalistIds: raw.finalistIds ?? [],
    themeColor: raw.themeColor ?? 'dark',
    titleFont: raw.titleFont ?? 'serif',
    bodyFont: raw.bodyFont ?? 'sans',
    titleSize: raw.titleSize ?? 'medium',
    bodySize: raw.bodySize ?? 'medium',
    resultsBackground: raw.resultsBackground ?? 'halloween',
    resultsBackgroundKey: raw.resultsBackgroundKey ?? null,
  };
}

function readDb(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    const parsed = { ...emptyDb(), ...JSON.parse(raw) } as Db;
    parsed.contests = (parsed.contests ?? []).map(normalizeContest);
    return parsed;
  } catch {
    return emptyDb();
  }
}

function sortByOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function activeBundleFromDb(db: Db): ContestBundle | null {
  const contest = db.contests[0] ?? null;
  if (!contest) return null;
  return {
    contest: normalizeContest(contest),
    categories: sortByOrder(
      db.categories.filter((c) => c.contestId === contest.id),
    ),
    contestants: sortByOrder(
      db.contestants.filter((c) => c.contestId === contest.id),
    ),
  };
}

function notifyListeners(db: Db): void {
  for (const listener of voteListeners) {
    listener(db.votes);
  }
  const bundle = activeBundleFromDb(db);
  for (const listener of contestListeners) {
    listener(bundle);
  }
}

function writeDb(db: Db): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  notifyListeners(db);
}

function mediaStorageKey(key: string): string {
  return `${MEDIA_PREFIX}${key}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read file'));
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function ensureBallot(
  db: Db,
  ballotId: string,
  contestId: string,
): Promise<Ballot> {
  const now = new Date().toISOString();
  let ballot = db.ballots.find((b) => b.id === ballotId);
  if (!ballot) {
    ballot = {
      id: ballotId,
      contestId,
      submittedAt: now,
      updatedAt: now,
    };
    db.ballots.push(ballot);
  } else {
    if (ballot.contestId !== contestId) {
      throw new Error('Ballot belongs to a different contest');
    }
    ballot.submittedAt = ballot.submittedAt ?? now;
    ballot.updatedAt = now;
  }
  return ballot;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && !event.key?.startsWith(MEDIA_PREFIX)) return;
    notifyListeners(readDb());
  });
}

export const localStore = {
  subscribeVotes(listener: VoteListener): () => void {
    voteListeners.add(listener);
    listener(readDb().votes);
    return () => voteListeners.delete(listener);
  },

  subscribeActiveContest(listener: ContestListener): () => void {
    contestListeners.add(listener);
    listener(activeBundleFromDb(readDb()));
    return () => contestListeners.delete(listener);
  },

  async getActiveContest(): Promise<ContestBundle | null> {
    return activeBundleFromDb(readDb());
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
      votingSystem: 'classic',
      currentRound: 1,
      finalistIds: [],
      themeColor: 'dark',
      titleFont: 'serif',
      bodyFont: 'sans',
      titleSize: 'medium',
      bodySize: 'medium',
      resultsBackground: 'halloween',
      resultsBackgroundKey: null,
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
    patch: Partial<
      Pick<
        Contest,
        | 'name'
        | 'isOpen'
        | 'votingSystem'
        | 'currentRound'
        | 'finalistIds'
        | 'themeColor'
        | 'titleFont'
        | 'bodyFont'
        | 'titleSize'
        | 'bodySize'
        | 'resultsBackground'
        | 'resultsBackgroundKey'
      >
    >,
  ): Promise<Contest> {
    const db = readDb();
    const index = db.contests.findIndex((c) => c.id === id);
    if (index < 0) throw new Error('Contest not found');
    db.contests[index] = normalizeContest({
      ...db.contests[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    });
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
      imageKey: null,
    };
    db.contestants.push(contestant);
    writeDb(db);
    return contestant;
  },

  async removeContestant(id: string): Promise<void> {
    const db = readDb();
    const contestant = db.contestants.find((c) => c.id === id);
    if (contestant?.imageKey) {
      localStorage.removeItem(mediaStorageKey(contestant.imageKey));
    }
    db.contestants = db.contestants.filter((c) => c.id !== id);
    db.votes = db.votes.filter((v) => v.contestantId !== id);
    writeDb(db);
  },

  async resetEverything(): Promise<void> {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(MEDIA_PREFIX)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) localStorage.removeItem(key);
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
    patch: Partial<Pick<Contestant, 'name' | 'sortOrder' | 'imageKey'>>,
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

  async clearVotes(contestId: string): Promise<void> {
    const db = readDb();
    db.votes = db.votes.filter((v) => v.contestId !== contestId);
    db.ballots = db.ballots.filter((b) => b.contestId !== contestId);
    writeDb(db);
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

    const ballot = await ensureBallot(db, input.ballotId, input.contestId);

    // Keep multi-round votes; only replace classic category votes for this ballot.
    db.votes = db.votes.filter(
      (v) =>
        v.ballotId !== input.ballotId ||
        (v.round != null && v.round > 0),
    );

    const votes: Vote[] = categoryIds.map((categoryId) => ({
      id: createId(),
      ballotId: input.ballotId,
      contestId: input.contestId,
      categoryId,
      contestantId: input.selections[categoryId],
      round: null,
    }));

    db.votes.push(...votes);
    writeDb(db);
    return { ballot, votes };
  },

  async saveRoundVote(input: {
    ballotId: string;
    contestId: string;
    round: number;
    contestantId: string | null;
  }): Promise<{ ballot: Ballot; votes: Vote[] }> {
    const db = readDb();
    const contest = normalizeContest(
      db.contests.find((c) => c.id === input.contestId) ??
        (() => {
          throw new Error('Contest not found');
        })(),
    );
    if (!contest.isOpen) throw new Error('Voting is closed');
    if (contest.votingSystem !== 'multiRound') {
      throw new Error('Contest is not multi-round');
    }
    if (contest.currentRound !== input.round) {
      throw new Error(`Round ${input.round} is not active`);
    }
    if (input.round === 2 && input.contestantId) {
      if (!contest.finalistIds.includes(input.contestantId)) {
        throw new Error('Contestant is not a finalist');
      }
    }

    const ballot = await ensureBallot(db, input.ballotId, input.contestId);

    db.votes = db.votes.filter(
      (v) => !(v.ballotId === input.ballotId && v.round === input.round),
    );

    const votes: Vote[] = [];
    if (input.contestantId) {
      const vote: Vote = {
        id: createId(),
        ballotId: input.ballotId,
        contestId: input.contestId,
        categoryId: null,
        contestantId: input.contestantId,
        round: input.round,
      };
      db.votes.push(vote);
      votes.push(vote);
    }

    writeDb(db);
    return { ballot, votes };
  },

  async uploadImage(kind: ImageKind, file: File): Promise<string> {
    const folder = kind === 'contestant' ? 'contestant-images' : 'backgrounds';
    const key = `local:${folder}/${createId()}-${file.name}`;
    const dataUrl = await fileToDataUrl(file);
    try {
      localStorage.setItem(mediaStorageKey(key), dataUrl);
    } catch {
      throw new Error(
        'Image too large for local storage. Use a smaller file or Amplify mode.',
      );
    }
    return key;
  },

  async resolveImageUrl(key: string): Promise<string> {
    if (key.startsWith('local:')) {
      const dataUrl = localStorage.getItem(mediaStorageKey(key));
      if (!dataUrl) throw new Error('Image not found');
      return dataUrl;
    }
    throw new Error('Image not found in local storage');
  },

  async deleteImage(key: string): Promise<void> {
    if (key.startsWith('local:')) {
      localStorage.removeItem(mediaStorageKey(key));
    }
  },
};

export type ContestPatch = Partial<
  Pick<
    Contest,
    | 'name'
    | 'isOpen'
    | 'votingSystem'
    | 'currentRound'
    | 'finalistIds'
    | 'themeColor'
    | 'titleFont'
    | 'bodyFont'
    | 'titleSize'
    | 'bodySize'
    | 'resultsBackground'
    | 'resultsBackgroundKey'
  >
>;

export type { VotingSystem, ResultsBackground };
