import { generateClient } from 'aws-amplify/data';
import { getUrl, remove, uploadData } from 'aws-amplify/storage';
import type { Schema } from '../../amplify/data/resource';
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
  type ThemeColor,
  type ThemeFont,
  type ThemeSize,
  type Vote,
  type VotingSystem,
} from './types';

const client = generateClient<Schema>({ authMode: 'apiKey' });

function sortByOrder<T extends { sortOrder?: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function asVotingSystem(value: string | null | undefined): VotingSystem {
  return value === 'multiRound' ? 'multiRound' : 'classic';
}

function asResultsBackground(
  value: string | null | undefined,
): ResultsBackground {
  if (value === 'plain' || value === 'custom') return value;
  return 'halloween';
}

function asThemeColor(value: string | null | undefined): ThemeColor {
  if (value === 'light' || value === 'pumpkin' || value === 'neon') return value;
  return 'dark';
}

function asThemeFont(value: string | null | undefined): ThemeFont {
  if (
    value === 'sans' ||
    value === 'display' ||
    value === 'mono' ||
    value === 'bebas' ||
    value === 'cinzel' ||
    value === 'alfa' ||
    value === 'fredoka' ||
    value === 'righteous'
  ) {
    return value;
  }
  return 'serif';
}

function asThemeSize(value: string | null | undefined): ThemeSize {
  if (value === 'small' || value === 'large') return value;
  return 'medium';
}

function mapContest(row: {
  id: string;
  name: string;
  description?: string | null;
  isOpen?: boolean | null;
  votingSystem?: string | null;
  currentRound?: number | null;
  finalistIds?: (string | null)[] | null;
  themeColor?: string | null;
  titleFont?: string | null;
  bodyFont?: string | null;
  titleSize?: string | null;
  bodySize?: string | null;
  resultsBackground?: string | null;
  resultsBackgroundKey?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}): Contest {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    isOpen: row.isOpen ?? true,
    votingSystem: asVotingSystem(row.votingSystem),
    currentRound: row.currentRound ?? 1,
    finalistIds: (row.finalistIds ?? []).filter(
      (id): id is string => typeof id === 'string',
    ),
    themeColor: asThemeColor(row.themeColor),
    titleFont: asThemeFont(row.titleFont),
    bodyFont: asThemeFont(row.bodyFont ?? 'sans'),
    titleSize: asThemeSize(row.titleSize),
    bodySize: asThemeSize(row.bodySize),
    resultsBackground: asResultsBackground(row.resultsBackground),
    resultsBackgroundKey: row.resultsBackgroundKey ?? null,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}

function mapVote(v: {
  id: string;
  ballotId: string;
  contestId: string;
  categoryId?: string | null;
  contestantId: string;
  round?: number | null;
}): Vote {
  return {
    id: v.id,
    ballotId: v.ballotId,
    contestId: v.contestId,
    categoryId: v.categoryId ?? null,
    contestantId: v.contestantId,
    round: v.round ?? null,
  };
}

function mapContestant(c: {
  id: string;
  contestId: string;
  name: string;
  sortOrder?: number | null;
  imageKey?: string | null;
}): Contestant {
  return {
    id: c.id,
    contestId: c.contestId,
    name: c.name,
    sortOrder: c.sortOrder ?? 0,
    imageKey: c.imageKey ?? null,
  };
}

type ListPage<T> = {
  data?: T[] | null;
  errors?: { message: string }[];
  nextToken?: string | null;
};

const PAGE_LIMIT = 1000;
const DELETE_BATCH = 25;

/**
 * AppSync list queries scan one page and apply the filter to that page only,
 * so a filtered page can be empty or partial while more matches remain.
 * Always follow nextToken to the end.
 */
async function listAll<T>(
  fetchPage: (args: { limit: number; nextToken?: string }) => Promise<ListPage<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let nextToken: string | undefined;
  do {
    const { data, errors, nextToken: token } = await fetchPage({
      limit: PAGE_LIMIT,
      nextToken,
    });
    if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
    items.push(...(data ?? []));
    nextToken = token ?? undefined;
  } while (nextToken);
  return items;
}

async function deleteRows(
  ids: string[],
  removeRow: (id: string) => Promise<{ errors?: { message: string }[] }>,
): Promise<void> {
  for (let i = 0; i < ids.length; i += DELETE_BATCH) {
    await Promise.all(
      ids.slice(i, i + DELETE_BATCH).map(async (id) => {
        const result = await removeRow(id);
        if (result.errors?.length) {
          throw new Error(result.errors.map((e) => e.message).join(', '));
        }
      }),
    );
  }
}

async function listAllCategories(contestId: string): Promise<Category[]> {
  const data = await listAll((page) =>
    client.models.Category.list({
      filter: { contestId: { eq: contestId } },
      ...page,
    }),
  );
  return sortByOrder(
    data.map((c) => ({
      id: c.id,
      contestId: c.contestId,
      name: c.name,
      sortOrder: c.sortOrder ?? 0,
    })),
  );
}

async function listAllContestants(contestId: string): Promise<Contestant[]> {
  const data = await listAll((page) =>
    client.models.Contestant.list({
      filter: { contestId: { eq: contestId } },
      ...page,
    }),
  );
  return sortByOrder(data.map(mapContestant));
}

async function listVoteRows(filter: {
  contestId?: { eq: string };
  ballotId?: { eq: string };
  contestantId?: { eq: string };
}): Promise<Vote[]> {
  const data = await listAll((page) =>
    client.models.Vote.list({ filter, ...page }),
  );
  return data.map(mapVote);
}

export const amplifyStore = {
  subscribeVotes(
    contestId: string,
    listener: (votes: Vote[]) => void,
  ): () => void {
    let active = true;

    const refresh = async () => {
      const votes = await amplifyStore.listVotes(contestId);
      if (active) listener(votes);
    };

    void refresh();

    const subCreate = client.models.Vote.onCreate().subscribe({
      next: () => void refresh(),
    });
    const subUpdate = client.models.Vote.onUpdate().subscribe({
      next: () => void refresh(),
    });
    const subDelete = client.models.Vote.onDelete().subscribe({
      next: () => void refresh(),
    });

    return () => {
      active = false;
      subCreate.unsubscribe();
      subUpdate.unsubscribe();
      subDelete.unsubscribe();
    };
  },

  subscribeActiveContest(
    listener: (bundle: ContestBundle | null) => void,
  ): () => void {
    let active = true;

    const refresh = async () => {
      try {
        const bundle = await amplifyStore.getActiveContest();
        if (active) listener(bundle);
      } catch {
        if (active) listener(null);
      }
    };

    void refresh();

    const subs = [
      client.models.Contest.onCreate().subscribe({ next: () => void refresh() }),
      client.models.Contest.onUpdate().subscribe({ next: () => void refresh() }),
      client.models.Contest.onDelete().subscribe({ next: () => void refresh() }),
      client.models.Category.onCreate().subscribe({ next: () => void refresh() }),
      client.models.Category.onUpdate().subscribe({ next: () => void refresh() }),
      client.models.Category.onDelete().subscribe({ next: () => void refresh() }),
      client.models.Contestant.onCreate().subscribe({ next: () => void refresh() }),
      client.models.Contestant.onUpdate().subscribe({ next: () => void refresh() }),
      client.models.Contestant.onDelete().subscribe({ next: () => void refresh() }),
    ];

    return () => {
      active = false;
      for (const sub of subs) sub.unsubscribe();
    };
  },

  async getActiveContest(): Promise<ContestBundle | null> {
    const data = await listAll((page) => client.models.Contest.list(page));
    const contestRow = data[0];
    if (!contestRow) return null;

    const contest = mapContest(contestRow);
    const [categories, contestants] = await Promise.all([
      listAllCategories(contest.id),
      listAllContestants(contest.id),
    ]);

    return { contest, categories, contestants };
  },

  async createContest(name: string): Promise<ContestBundle> {
    const existing = await this.getActiveContest();
    if (existing) return existing;

    const { data: contestRow, errors } = await client.models.Contest.create({
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
    });
    if (errors?.length || !contestRow) {
      throw new Error(errors?.map((e) => e.message).join(', ') ?? 'Create failed');
    }

    const categories: Category[] = [];
    for (let index = 0; index < DEFAULT_CATEGORIES.length; index += 1) {
      const { data: cat, errors: catErrors } = await client.models.Category.create({
        contestId: contestRow.id,
        name: DEFAULT_CATEGORIES[index],
        sortOrder: index,
      });
      if (catErrors?.length || !cat) {
        throw new Error(
          catErrors?.map((e) => e.message).join(', ') ?? 'Category create failed',
        );
      }
      categories.push({
        id: cat.id,
        contestId: cat.contestId,
        name: cat.name,
        sortOrder: cat.sortOrder ?? index,
      });
    }

    return {
      contest: mapContest(contestRow),
      categories,
      contestants: [],
    };
  },

  async updateContest(
    id: string,
    patch: Partial<
      Pick<
        Contest,
        | 'name'
        | 'description'
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
    const { data, errors } = await client.models.Contest.update({
      id,
      ...patch,
    });
    if (errors?.length || !data) {
      throw new Error(errors?.map((e) => e.message).join(', ') ?? 'Update failed');
    }
    return mapContest(data);
  },

  async addContestant(contestId: string, name: string): Promise<Contestant> {
    const existing = await listAllContestants(contestId);
    const { data, errors } = await client.models.Contestant.create({
      contestId,
      name: name.trim(),
      sortOrder: existing.length,
    });
    if (errors?.length || !data) {
      throw new Error(errors?.map((e) => e.message).join(', ') ?? 'Create failed');
    }
    return mapContestant(data);
  },

  async removeContestant(id: string): Promise<void> {
    const { data: contestant } = await client.models.Contestant.get({ id });
    if (contestant?.imageKey) {
      try {
        await amplifyStore.deleteImage(contestant.imageKey);
      } catch {
        // Continue deleting the contestant even if the file is already gone.
      }
    }
    const votes = await listVoteRows({ contestantId: { eq: id } });
    await deleteRows(
      votes.map((vote) => vote.id),
      (voteId) => client.models.Vote.delete({ id: voteId }),
    );
    const { errors } = await client.models.Contestant.delete({ id });
    if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  },

  async updateCategory(
    id: string,
    patch: Partial<Pick<Category, 'name' | 'sortOrder'>>,
  ): Promise<Category> {
    const { data, errors } = await client.models.Category.update({ id, ...patch });
    if (errors?.length || !data) {
      throw new Error(errors?.map((e) => e.message).join(', ') ?? 'Update failed');
    }
    return {
      id: data.id,
      contestId: data.contestId,
      name: data.name,
      sortOrder: data.sortOrder ?? 0,
    };
  },

  async updateContestant(
    id: string,
    patch: Partial<Pick<Contestant, 'name' | 'sortOrder' | 'imageKey'>>,
  ): Promise<Contestant> {
    const payload = {
      id,
      ...patch,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    };
    const { data, errors } = await client.models.Contestant.update(payload);
    if (errors?.length || !data) {
      throw new Error(errors?.map((e) => e.message).join(', ') ?? 'Update failed');
    }
    return mapContestant(data);
  },

  async getBallot(ballotId: string): Promise<Ballot | null> {
    const { data, errors } = await client.models.Ballot.get({ id: ballotId });
    if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
    if (!data) return null;
    return {
      id: data.id,
      contestId: data.contestId,
      submittedAt: data.submittedAt,
      updatedAt: data.updatedAt ?? undefined,
    };
  },

  async getVotesForBallot(ballotId: string): Promise<Vote[]> {
    return listVoteRows({ ballotId: { eq: ballotId } });
  },

  async listVotes(contestId: string): Promise<Vote[]> {
    return listVoteRows({ contestId: { eq: contestId } });
  },

  async clearVotes(contestId: string): Promise<void> {
    const votes = await listVoteRows({ contestId: { eq: contestId } });
    await deleteRows(
      votes.map((vote) => vote.id),
      (id) => client.models.Vote.delete({ id }),
    );

    const ballots = await listAll((page) =>
      client.models.Ballot.list({
        filter: { contestId: { eq: contestId } },
        ...page,
      }),
    );
    await deleteRows(
      ballots.map((ballot) => ballot.id),
      (id) => client.models.Ballot.delete({ id }),
    );
  },

  async resetVoting(contestId: string): Promise<Contest> {
    await this.clearVotes(contestId);
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key?.startsWith('costume_ballot_complete_')) keysToRemove.push(key);
      }
      for (const key of keysToRemove) localStorage.removeItem(key);
    }
    return this.updateContest(contestId, {
      isOpen: false,
      currentRound: 1,
      finalistIds: [],
    });
  },

  async saveBallotVotes(input: {
    ballotId: string;
    contestId: string;
    selections: Record<string, string>;
  }): Promise<{ ballot: Ballot; votes: Vote[] }> {
    const bundle = await this.getActiveContest();
    if (!bundle || bundle.contest.id !== input.contestId) {
      throw new Error('Contest not found');
    }
    if (!bundle.contest.isOpen) throw new Error('Voting is closed');

    const contestantIds = Object.values(input.selections);
    if (new Set(contestantIds).size !== contestantIds.length) {
      throw new Error('Each contestant can only be selected once');
    }

    const now = new Date().toISOString();
    let ballot = await this.getBallot(input.ballotId);
    if (!ballot) {
      const { data, errors } = await client.models.Ballot.create({
        id: input.ballotId,
        contestId: input.contestId,
        submittedAt: now,
      });
      if (errors?.length || !data) {
        throw new Error(
          errors?.map((e) => e.message).join(', ') ?? 'Ballot create failed',
        );
      }
      ballot = {
        id: data.id,
        contestId: data.contestId,
        submittedAt: data.submittedAt,
      };
    } else {
      const { data, errors } = await client.models.Ballot.update({
        id: input.ballotId,
        submittedAt: ballot.submittedAt ?? now,
      });
      if (errors?.length || !data) {
        throw new Error(
          errors?.map((e) => e.message).join(', ') ?? 'Ballot update failed',
        );
      }
      ballot = {
        id: data.id,
        contestId: data.contestId,
        submittedAt: data.submittedAt,
        updatedAt: data.updatedAt ?? undefined,
      };
    }

    const existingVotes = await this.getVotesForBallot(input.ballotId);
    const classicVotes = existingVotes.filter(
      (vote) => vote.round == null || vote.round === 0,
    );
    await deleteRows(
      classicVotes.map((vote) => vote.id),
      (id) => client.models.Vote.delete({ id }),
    );

    const votes: Vote[] = [];
    for (const [categoryId, contestantId] of Object.entries(input.selections)) {
      const { data, errors } = await client.models.Vote.create({
        ballotId: input.ballotId,
        contestId: input.contestId,
        categoryId,
        contestantId,
      });
      if (errors?.length || !data) {
        throw new Error(
          errors?.map((e) => e.message).join(', ') ?? 'Vote create failed',
        );
      }
      votes.push(mapVote(data));
    }

    return { ballot, votes };
  },

  async saveRoundVote(input: {
    ballotId: string;
    contestId: string;
    round: number;
    contestantId: string | null;
  }): Promise<{ ballot: Ballot; votes: Vote[] }> {
    const bundle = await this.getActiveContest();
    if (!bundle || bundle.contest.id !== input.contestId) {
      throw new Error('Contest not found');
    }
    const { contest } = bundle;
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

    const now = new Date().toISOString();
    let ballot = await this.getBallot(input.ballotId);
    if (!ballot) {
      const { data, errors } = await client.models.Ballot.create({
        id: input.ballotId,
        contestId: input.contestId,
        submittedAt: now,
      });
      if (errors?.length || !data) {
        throw new Error(
          errors?.map((e) => e.message).join(', ') ?? 'Ballot create failed',
        );
      }
      ballot = {
        id: data.id,
        contestId: data.contestId,
        submittedAt: data.submittedAt,
      };
    } else {
      const { data, errors } = await client.models.Ballot.update({
        id: input.ballotId,
        submittedAt: ballot.submittedAt ?? now,
      });
      if (errors?.length || !data) {
        throw new Error(
          errors?.map((e) => e.message).join(', ') ?? 'Ballot update failed',
        );
      }
      ballot = {
        id: data.id,
        contestId: data.contestId,
        submittedAt: data.submittedAt,
        updatedAt: data.updatedAt ?? undefined,
      };
    }

    const existingVotes = await this.getVotesForBallot(input.ballotId);
    const roundVotes = existingVotes.filter((vote) => vote.round === input.round);
    await deleteRows(
      roundVotes.map((vote) => vote.id),
      (id) => client.models.Vote.delete({ id }),
    );

    const votes: Vote[] = [];
    if (input.contestantId) {
      const { data, errors } = await client.models.Vote.create({
        ballotId: input.ballotId,
        contestId: input.contestId,
        contestantId: input.contestantId,
        round: input.round,
      });
      if (errors?.length || !data) {
        throw new Error(
          errors?.map((e) => e.message).join(', ') ?? 'Vote create failed',
        );
      }
      votes.push(mapVote(data));
    }

    return { ballot, votes };
  },

  async uploadImage(kind: ImageKind, file: File): Promise<string> {
    const folder = kind === 'contestant' ? 'contestant-images' : 'backgrounds';
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const key = `${folder}/${createId()}-${safeName}`;
    await uploadData({
      path: key,
      data: file,
      options: {
        contentType: file.type || 'application/octet-stream',
      },
    }).result;
    return key;
  },

  async resolveImageUrl(key: string): Promise<string> {
    const result = await getUrl({
      path: key,
      options: {
        expiresIn: 60 * 60 * 24,
      },
    });
    return result.url.toString();
  },

  async deleteImage(key: string): Promise<void> {
    await remove({ path: key });
  },

  async resetEverything(): Promise<void> {
    const deleteAll = async (
      list: (page: { limit: number; nextToken?: string }) => Promise<
        ListPage<{ id: string }>
      >,
      removeRow: (id: string) => Promise<{ errors?: { message: string }[] }>,
    ) => {
      const rows = await listAll(list);
      await deleteRows(
        rows.map((row) => row.id),
        removeRow,
      );
    };

    const contestants = await listAll((page) => client.models.Contestant.list(page));
    await Promise.all(
      contestants.map(async (row) => {
        if (row.imageKey) {
          try {
            await amplifyStore.deleteImage(row.imageKey);
          } catch {
            // Ignore missing files.
          }
        }
      }),
    );

    const contests = await listAll((page) => client.models.Contest.list(page));
    await Promise.all(
      contests.map(async (row) => {
        if (row.resultsBackgroundKey) {
          try {
            await amplifyStore.deleteImage(row.resultsBackgroundKey);
          } catch {
            // Ignore missing files.
          }
        }
      }),
    );

    await deleteAll(
      (page) => client.models.Vote.list(page),
      (id) => client.models.Vote.delete({ id }),
    );
    await deleteAll(
      (page) => client.models.Ballot.list(page),
      (id) => client.models.Ballot.delete({ id }),
    );
    await deleteAll(
      (page) => client.models.Contestant.list(page),
      (id) => client.models.Contestant.delete({ id }),
    );
    await deleteAll(
      (page) => client.models.Category.list(page),
      (id) => client.models.Category.delete({ id }),
    );
    await deleteAll(
      (page) => client.models.Contest.list(page),
      (id) => client.models.Contest.delete({ id }),
    );
  },
};
