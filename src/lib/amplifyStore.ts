import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import {
  DEFAULT_CATEGORIES,
  type Ballot,
  type Category,
  type Contest,
  type ContestBundle,
  type Contestant,
  type Vote,
} from './types';

const client = generateClient<Schema>({ authMode: 'apiKey' });

function sortByOrder<T extends { sortOrder?: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

async function listAllCategories(contestId: string): Promise<Category[]> {
  const { data, errors } = await client.models.Category.list({
    filter: { contestId: { eq: contestId } },
  });
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return sortByOrder(
    (data ?? []).map((c) => ({
      id: c.id,
      contestId: c.contestId,
      name: c.name,
      sortOrder: c.sortOrder ?? 0,
    })),
  );
}

async function listAllContestants(contestId: string): Promise<Contestant[]> {
  const { data, errors } = await client.models.Contestant.list({
    filter: { contestId: { eq: contestId } },
  });
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return sortByOrder(
    (data ?? []).map((c) => ({
      id: c.id,
      contestId: c.contestId,
      name: c.name,
      sortOrder: c.sortOrder ?? 0,
    })),
  );
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

  async getActiveContest(): Promise<ContestBundle | null> {
    const { data, errors } = await client.models.Contest.list();
    if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
    const contestRow = data?.[0];
    if (!contestRow) return null;

    const contest: Contest = {
      id: contestRow.id,
      name: contestRow.name,
      isOpen: contestRow.isOpen ?? true,
      createdAt: contestRow.createdAt ?? undefined,
      updatedAt: contestRow.updatedAt ?? undefined,
    };

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
        throw new Error(catErrors?.map((e) => e.message).join(', ') ?? 'Category create failed');
      }
      categories.push({
        id: cat.id,
        contestId: cat.contestId,
        name: cat.name,
        sortOrder: cat.sortOrder ?? index,
      });
    }

    return {
      contest: {
        id: contestRow.id,
        name: contestRow.name,
        isOpen: contestRow.isOpen ?? true,
      },
      categories,
      contestants: [],
    };
  },

  async updateContest(
    id: string,
    patch: Partial<Pick<Contest, 'name' | 'isOpen'>>,
  ): Promise<Contest> {
    const { data, errors } = await client.models.Contest.update({ id, ...patch });
    if (errors?.length || !data) {
      throw new Error(errors?.map((e) => e.message).join(', ') ?? 'Update failed');
    }
    return {
      id: data.id,
      name: data.name,
      isOpen: data.isOpen ?? true,
    };
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
    return {
      id: data.id,
      contestId: data.contestId,
      name: data.name,
      sortOrder: data.sortOrder ?? existing.length,
    };
  },

  async removeContestant(id: string): Promise<void> {
    const { data: votes } = await client.models.Vote.list({
      filter: { contestantId: { eq: id } },
    });
    await Promise.all(
      (votes ?? []).map((vote) => client.models.Vote.delete({ id: vote.id })),
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
    patch: Partial<Pick<Contestant, 'name' | 'sortOrder'>>,
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
    return {
      id: data.id,
      contestId: data.contestId,
      name: data.name,
      sortOrder: data.sortOrder ?? 0,
    };
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
    const { data, errors } = await client.models.Vote.list({
      filter: { ballotId: { eq: ballotId } },
    });
    if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
    return (data ?? []).map((v) => ({
      id: v.id,
      ballotId: v.ballotId,
      contestId: v.contestId,
      categoryId: v.categoryId,
      contestantId: v.contestantId,
    }));
  },

  async listVotes(contestId: string): Promise<Vote[]> {
    const { data, errors } = await client.models.Vote.list({
      filter: { contestId: { eq: contestId } },
    });
    if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
    return (data ?? []).map((v) => ({
      id: v.id,
      ballotId: v.ballotId,
      contestId: v.contestId,
      categoryId: v.categoryId,
      contestantId: v.contestantId,
    }));
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
        throw new Error(errors?.map((e) => e.message).join(', ') ?? 'Ballot create failed');
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
        throw new Error(errors?.map((e) => e.message).join(', ') ?? 'Ballot update failed');
      }
      ballot = {
        id: data.id,
        contestId: data.contestId,
        submittedAt: data.submittedAt,
        updatedAt: data.updatedAt ?? undefined,
      };
    }

    const existingVotes = await this.getVotesForBallot(input.ballotId);
    await Promise.all(
      existingVotes.map((vote) => client.models.Vote.delete({ id: vote.id })),
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
        throw new Error(errors?.map((e) => e.message).join(', ') ?? 'Vote create failed');
      }
      votes.push({
        id: data.id,
        ballotId: data.ballotId,
        contestId: data.contestId,
        categoryId: data.categoryId,
        contestantId: data.contestantId,
      });
    }

    return { ballot, votes };
  },

  async resetEverything(): Promise<void> {
    const deleteAll = async (
      list: () => Promise<{ data?: { id: string }[] | null; errors?: { message: string }[] }>,
      remove: (id: string) => Promise<{ errors?: { message: string }[] }>,
    ) => {
      const { data, errors } = await list();
      if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
      await Promise.all(
        (data ?? []).map(async (row) => {
          const result = await remove(row.id);
          if (result.errors?.length) {
            throw new Error(result.errors.map((e) => e.message).join(', '));
          }
        }),
      );
    };

    await deleteAll(
      () => client.models.Vote.list(),
      (id) => client.models.Vote.delete({ id }),
    );
    await deleteAll(
      () => client.models.Ballot.list(),
      (id) => client.models.Ballot.delete({ id }),
    );
    await deleteAll(
      () => client.models.Contestant.list(),
      (id) => client.models.Contestant.delete({ id }),
    );
    await deleteAll(
      () => client.models.Category.list(),
      (id) => client.models.Category.delete({ id }),
    );
    await deleteAll(
      () => client.models.Contest.list(),
      (id) => client.models.Contest.delete({ id }),
    );
  },
};
