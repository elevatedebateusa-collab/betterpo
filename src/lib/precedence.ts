import type { Representative } from './supabase';

export interface ScoredRepresentative extends Representative {
  score: number;
  rank: number;
  isTied: boolean;
}

/**
 * Speech Precedence & Recency Score:
 * Score = (speeches_count * 10,000) + last_speech_order
 * Strictly lower score = higher recognition priority.
 */
export function calculateSpeechScore(rep: Representative): number {
  return (rep.speeches_count * 10000) + rep.last_speech_order;
}

/**
 * Questioning Precedence & Recency Score:
 * Score = (questions_count * 10,000) + last_question_order
 */
export function calculateQuestionScore(rep: Representative): number {
  return (rep.questions_count * 10000) + rep.last_question_order;
}

/**
 * Pure sorting function implementing NSDA parliamentary rules.
 * Active debaters are evaluated by score.
 * If score is identical (e.g. 0 speeches, 0 order at round start), they are flagged as tied.
 */
export function sortRepresentatives(
  reps: Representative[],
  mode: 'speech' | 'question' = 'speech'
): ScoredRepresentative[] {
  const getScore = mode === 'speech' ? calculateSpeechScore : calculateQuestionScore;

  // Clone and calculate score
  const withScores = reps.map((rep) => ({
    ...rep,
    score: getScore(rep),
  }));

  // Sort by score ascending (lowest score first), fallback to alphabetical order
  withScores.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    return a.name.localeCompare(b.name);
  });

  // Assign ranks and mark ties
  return withScores.map((rep, idx, arr) => {
    const isTied = arr.some(
      (other, otherIdx) => otherIdx !== idx && other.score === rep.score
    );

    // Standard parliamentary rank calculation
    const rank = arr.findIndex((r) => r.score === rep.score) + 1;

    return {
      ...rep,
      score: rep.score,
      rank,
      isTied,
    };
  });
}

/**
 * Resolves who has the right to the floor among debaters currently standing.
 * Highlights the clear winner or flags a tie (e.g. at round start before any speeches).
 */
export function resolveStandingWinner(
  standingIds: Set<string> | string[],
  allReps: Representative[],
  mode: 'speech' | 'question' = 'speech'
): {
  winner: Representative | null;
  isTie: boolean;
  tiedCandidates: Representative[];
  standings: ScoredRepresentative[];
} {
  const standingSet = standingIds instanceof Set ? standingIds : new Set(standingIds);
  if (standingSet.size === 0) {
    return {
      winner: null,
      isTie: false,
      tiedCandidates: [],
      standings: [],
    };
  }

  // Filter for standing, active, and present representatives
  const standingReps = allReps.filter((r) => standingSet.has(r.id) && r.active && r.is_present !== false);
  if (standingReps.length === 0) {
    return {
      winner: null,
      isTie: false,
      tiedCandidates: [],
      standings: [],
    };
  }

  const sortedStanding = sortRepresentatives(standingReps, mode);
  const bestScore = sortedStanding[0].score;
  const tiedCandidates = sortedStanding.filter((r) => r.score === bestScore);
  const isTie = tiedCandidates.length > 1;

  return {
    winner: sortedStanding[0],
    isTie,
    tiedCandidates,
    standings: sortedStanding,
  };
}

/**
 * Formats a human-readable explanation of why a candidate holds precedence/recency.
 */
export function formatPriorityReason(rep: Representative, mode: 'speech' | 'question' = 'speech'): string {
  if (mode === 'speech') {
    const countStr = `${rep.speeches_count} speech${rep.speeches_count === 1 ? '' : 'es'}`;
    const orderStr = rep.last_speech_order === 0 ? 'Never spoke' : `Spoke #${rep.last_speech_order}`;
    return `${countStr} • ${orderStr}`;
  } else {
    const countStr = `${rep.questions_count} question${rep.questions_count === 1 ? '' : 's'}`;
    const orderStr = rep.last_question_order === 0 ? 'Never asked' : `Asked #${rep.last_question_order}`;
    return `${countStr} • ${orderStr}`;
  }
}
