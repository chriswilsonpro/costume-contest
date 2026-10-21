import { Amplify } from 'aws-amplify';
import { amplifyStore } from './amplifyStore';
import { localStore } from './localStore';
import type {
  Ballot,
  Category,
  Contest,
  ContestBundle,
  Contestant,
  Vote,
} from './types';

export type DataStore = {
  mode: 'local' | 'amplify';
  getActiveContest(): Promise<ContestBundle | null>;
  createContest(name: string): Promise<ContestBundle>;
  updateContest(
    id: string,
    patch: Partial<Pick<Contest, 'name' | 'isOpen'>>,
  ): Promise<Contest>;
  addContestant(contestId: string, name: string): Promise<Contestant>;
  removeContestant(id: string): Promise<void>;
  resetEverything(): Promise<void>;
  updateCategory(
    id: string,
    patch: Partial<Pick<Category, 'name' | 'sortOrder'>>,
  ): Promise<Category>;
  updateContestant(
    id: string,
    patch: Partial<Pick<Contestant, 'name' | 'sortOrder'>>,
  ): Promise<Contestant>;
  getBallot(ballotId: string): Promise<Ballot | null>;
  getVotesForBallot(ballotId: string): Promise<Vote[]>;
  listVotes(contestId: string): Promise<Vote[]>;
  saveBallotVotes(input: {
    ballotId: string;
    contestId: string;
    selections: Record<string, string>;
  }): Promise<{ ballot: Ballot; votes: Vote[] }>;
  subscribeVotes(
    contestId: string,
    listener: (votes: Vote[]) => void,
  ): () => void;
};

function hasAmplifyDataConfig(): boolean {
  try {
    const config = Amplify.getConfig();
    return Boolean(config.API?.GraphQL?.endpoint && config.API?.GraphQL?.apiKey);
  } catch {
    return false;
  }
}

function forceLocal(): boolean {
  return import.meta.env.VITE_USE_LOCAL === 'true';
}

function createStore(): DataStore {
  if (!forceLocal() && hasAmplifyDataConfig()) {
    return {
      mode: 'amplify',
      getActiveContest: () => amplifyStore.getActiveContest(),
      createContest: (name) => amplifyStore.createContest(name),
      updateContest: (id, patch) => amplifyStore.updateContest(id, patch),
      addContestant: (contestId, name) =>
        amplifyStore.addContestant(contestId, name),
      removeContestant: (id) => amplifyStore.removeContestant(id),
      resetEverything: () => amplifyStore.resetEverything(),
      updateCategory: (id, patch) => amplifyStore.updateCategory(id, patch),
      updateContestant: (id, patch) => amplifyStore.updateContestant(id, patch),
      getBallot: (ballotId) => amplifyStore.getBallot(ballotId),
      getVotesForBallot: (ballotId) => amplifyStore.getVotesForBallot(ballotId),
      listVotes: (contestId) => amplifyStore.listVotes(contestId),
      saveBallotVotes: (input) => amplifyStore.saveBallotVotes(input),
      subscribeVotes: (contestId, listener) =>
        amplifyStore.subscribeVotes(contestId, listener),
    };
  }

  return {
    mode: 'local',
    getActiveContest: () => localStore.getActiveContest(),
    createContest: (name) => localStore.createContest(name),
    updateContest: (id, patch) => localStore.updateContest(id, patch),
    addContestant: (contestId, name) =>
      localStore.addContestant(contestId, name),
    removeContestant: (id) => localStore.removeContestant(id),
    resetEverything: () => localStore.resetEverything(),
    updateCategory: (id, patch) => localStore.updateCategory(id, patch),
    updateContestant: (id, patch) => localStore.updateContestant(id, patch),
    getBallot: (ballotId) => localStore.getBallot(ballotId),
    getVotesForBallot: (ballotId) => localStore.getVotesForBallot(ballotId),
    listVotes: (contestId) => localStore.listVotes(contestId),
    saveBallotVotes: (input) => localStore.saveBallotVotes(input),
    subscribeVotes: (_contestId, listener) => localStore.subscribeVotes(listener),
  };
}

let store: DataStore | null = null;

export function getDataStore(): DataStore {
  if (!store) store = createStore();
  return store;
}
