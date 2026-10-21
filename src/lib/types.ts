export type Contest = {
  id: string;
  name: string;
  isOpen: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Category = {
  id: string;
  contestId: string;
  name: string;
  sortOrder: number;
};

export type Contestant = {
  id: string;
  contestId: string;
  name: string;
  sortOrder: number;
};

export type Ballot = {
  id: string;
  contestId: string;
  submittedAt?: string | null;
  updatedAt?: string;
};

export type Vote = {
  id: string;
  ballotId: string;
  contestId: string;
  categoryId: string;
  contestantId: string;
};

export type ContestBundle = {
  contest: Contest;
  categories: Category[];
  contestants: Contestant[];
};

export const DEFAULT_CATEGORIES = [
  'Best Costume',
  'Most Creative',
  'Spookiest',
  'Cutest',
  'Funniest',
  'Best Surprise',
] as const;
