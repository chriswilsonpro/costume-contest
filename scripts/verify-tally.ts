import assert from 'node:assert/strict';
import {
  computeFinalWinner,
  computeFinalists,
  rankRound,
} from '../src/lib/multiRound';
import { computeCategoryRankings } from '../src/lib/rankings';
import type { Category, Contestant, Vote } from '../src/lib/types';

const contestants: Contestant[] = ['Ana', 'Ben', 'Cal', 'Dee', 'Eve'].map(
  (name, i) => ({ id: name.toLowerCase(), contestId: 'c', name, sortOrder: i }),
);

let n = 0;
function vote(ballotId: string, contestantId: string, extra: Partial<Vote>): Vote {
  n += 1;
  return { id: `v${n}`, ballotId, contestId: 'c', contestantId, ...extra };
}

// 10 voters in round 1, plus classic votes that must not leak into rounds.
const r1Picks = ['ana', 'ana', 'ana', 'ben', 'ben', 'cal', 'cal', 'dee', 'dee', 'eve'];
const votes: Vote[] = r1Picks.map((c, i) => vote(`b${i}`, c, { round: 1 }));
votes.push(vote('b0', 'eve', { categoryId: 'cat1', round: null }));

const r1 = rankRound(contestants, votes, 1);
const total = r1.reduce((sum, e) => sum + e.count, 0);
assert.equal(total, 10, 'round 1 total equals number of round 1 voters');
assert.deepEqual(
  Object.fromEntries(r1.map((e) => [e.contestantId, e.count])),
  { ana: 3, ben: 2, cal: 2, dee: 2, eve: 1 },
);

// 3-way tie for 3rd → 4 finalists
const finals = computeFinalists(r1);
assert.deepEqual(
  finals.finalists.map((f) => f.contestantId),
  ['ana', 'ben', 'cal', 'dee'],
);
assert.equal(finals.hasCutoffTie, true);

// Round 2: same voters re-vote; round 1 votes must not count.
const finalistContestants = contestants.filter((c) =>
  finals.finalists.some((f) => f.contestantId === c.id),
);
const r2Votes = [
  ...votes,
  vote('b0', 'ben', { round: 2 }),
  vote('b1', 'ben', { round: 2 }),
  vote('b2', 'ana', { round: 2 }),
  vote('b3', 'ana', { round: 2 }),
];
const r2 = rankRound(finalistContestants, r2Votes, 2);
assert.equal(r2.reduce((s, e) => s + e.count, 0), 4);
const winner = computeFinalWinner(r2, r1);
assert.deepEqual(winner.winners.map((w) => w.contestantId), ['ana']);
assert.equal(winner.usedRound1Tiebreak, true);

// Classic: per-category totals and one-win rule
const categories: Category[] = [
  { id: 'cat1', contestId: 'c', name: 'Best', sortOrder: 0 },
  { id: 'cat2', contestId: 'c', name: 'Funny', sortOrder: 1 },
];
const classic: Vote[] = [
  vote('b1', 'ana', { categoryId: 'cat1' }),
  vote('b2', 'ana', { categoryId: 'cat1' }),
  vote('b1', 'ben', { categoryId: 'cat2' }),
  vote('b2', 'ana', { categoryId: 'cat2' }),
  vote('b3', 'ana', { categoryId: 'cat2' }),
  vote('b4', 'ana', { round: 1 }),
];
const rankings = computeCategoryRankings(categories, contestants, classic);
assert.equal(rankings[0].winnerId, 'ana');
const cat2Ana = rankings[1].ranked.find((e) => e.contestantId === 'ana');
assert.equal(cat2Ana?.count, 2, 'raw count kept; round votes excluded');
assert.equal(rankings[1].winnerId, 'ben', 'one-win rule passes to next eligible');

console.log('All tally checks passed');
