export type VotingSystem = 'classic' | 'multiRound';
export type ResultsBackground = 'halloween' | 'custom';

export type Contest = {
  id: string;
  name: string;
  isOpen: boolean;
  votingSystem: VotingSystem;
  currentRound: number;
  finalistIds: string[];
  resultsBackground: ResultsBackground;
  resultsBackgroundKey?: string | null;
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
  imageKey?: string | null;
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
  categoryId?: string | null;
  contestantId: string;
  round?: number | null;
};

export type ContestBundle = {
  contest: Contest;
  categories: Category[];
  contestants: Contestant[];
};

export type ImageKind = 'contestant' | 'background';

export const DEFAULT_CATEGORIES = [
  'Best Costume',
  'Most Creative',
  'Spookiest',
  'Cutest',
  'Funniest',
  'Best Surprise',
] as const;

export const RESULTS_BACKGROUND_PRESETS: {
  id: ResultsBackground;
  label: string;
}[] = [
  { id: 'halloween', label: 'Halloween night' },
  { id: 'custom', label: 'Custom image' },
];
