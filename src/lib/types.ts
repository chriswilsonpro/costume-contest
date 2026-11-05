export type VotingSystem = 'classic' | 'multiRound';
export type ResultsBackground = 'plain' | 'halloween' | 'custom';
export type ThemeColor = 'dark' | 'light' | 'pumpkin' | 'neon';
export type ThemeFont =
  | 'serif'
  | 'sans'
  | 'display'
  | 'mono'
  | 'bebas'
  | 'cinzel'
  | 'alfa'
  | 'fredoka'
  | 'righteous';
export type ThemeSize = 'small' | 'medium' | 'large';

export type Contest = {
  id: string;
  name: string;
  description: string;
  isOpen: boolean;
  votingSystem: VotingSystem;
  currentRound: number;
  finalistIds: string[];
  themeColor: ThemeColor;
  titleFont: ThemeFont;
  bodyFont: ThemeFont;
  titleSize: ThemeSize;
  bodySize: ThemeSize;
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

export const THEME_COLOR_PRESETS: {
  id: ThemeColor;
  label: string;
  swatch: string;
}[] = [
  { id: 'dark', label: 'Dark', swatch: 'linear-gradient(135deg, #241038, #a100ff)' },
  { id: 'light', label: 'Light', swatch: 'linear-gradient(135deg, #f7f2ff, #a100ff)' },
  { id: 'pumpkin', label: 'Pumpkin', swatch: 'linear-gradient(135deg, #1a0c05, #ff7a18)' },
  { id: 'neon', label: 'Neon', swatch: 'linear-gradient(135deg, #050510, #ff2bd6 50%, #2ef2ff)' },
];

export const THEME_FONT_OPTIONS: {
  id: ThemeFont;
  label: string;
  sampleFamily: string;
}[] = [
  { id: 'serif', label: 'Serif', sampleFamily: '"Fraunces", Georgia, serif' },
  { id: 'sans', label: 'Sans-serif', sampleFamily: '"Manrope", system-ui, sans-serif' },
  { id: 'display', label: 'Display', sampleFamily: '"Bungee", cursive' },
  { id: 'mono', label: 'Mono', sampleFamily: '"Space Mono", ui-monospace, monospace' },
  { id: 'bebas', label: 'Bebas Neue', sampleFamily: '"Bebas Neue", sans-serif' },
  { id: 'cinzel', label: 'Cinzel', sampleFamily: '"Cinzel", Georgia, serif' },
  { id: 'alfa', label: 'Alfa Slab', sampleFamily: '"Alfa Slab One", Georgia, serif' },
  { id: 'fredoka', label: 'Fredoka', sampleFamily: '"Fredoka", system-ui, sans-serif' },
  { id: 'righteous', label: 'Righteous', sampleFamily: '"Righteous", cursive' },
];

export const THEME_SIZE_OPTIONS: {
  id: ThemeSize;
  label: string;
}[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
];

export const RESULTS_BACKGROUND_PRESETS: {
  id: ResultsBackground;
  label: string;
}[] = [
  { id: 'plain', label: 'Plain' },
  { id: 'halloween', label: 'Halloween night' },
  { id: 'custom', label: 'Custom image' },
];
